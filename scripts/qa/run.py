"""Functional QA lifecycle. Never load application credentials or target a hosted site."""

import argparse
import contextlib
import fnmatch
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import uuid

import yaml


ROOT = Path(__file__).resolve().parents[2]
CONFIG = Path(".factory/skills/qa/config.yaml")
RESULTS = Path("qa-results")
STATUSES = {"PASS", "FAIL", "BLOCKED", "FLAKY", "INCONCLUSIVE"}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None


def local_opener():
    return urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())


def load_config(root=ROOT):
    config = yaml.safe_load((root / CONFIG).read_text())
    for value in (config["video_evidence"], config["droid_control"]["compose"]):
        if type(value) is not bool:
            raise ValueError("Evidence and Compose switches must be booleans")
    if config["imagemagick"] is not False:
        raise ValueError("This QA installation does not permit ImageMagick")
    if config["default_target"] != "local_demo":
        raise ValueError("PR QA must target the isolated local demo")
    if config["failure_learning"] != "suggest_in_report":
        raise ValueError("Only report suggestions are authorized")
    return config


def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args])


def scope_diff(root, config, base, head):
    # Resolve refs before use; leading dashes cannot become git options.
    base_sha = git(root, "rev-parse", "--verify", f"{base}^{{commit}}").decode().strip()
    head_sha = git(root, "rev-parse", "--verify", f"{head}^{{commit}}").decode().strip()
    paths = git(root, "diff", "--name-only", "--no-renames", "-z",
                f"{base_sha}...{head_sha}", "--").decode().split("\0")
    paths = [p for p in paths if p]
    apps = []
    for app, settings in config["apps"].items():
        if any(
            any(fnmatch.fnmatchcase(p, pattern) for pattern in settings["path_patterns"])
            and not any(fnmatch.fnmatchcase(p, pattern)
                        for pattern in settings.get("exclude_patterns", []))
            for p in paths
        ):
            apps.append(app)
    return {"base": base_sha, "head": head_sha, "paths": paths, "apps": apps}


def clean_environment(home):
    # Do not inherit NODE_OPTIONS, NEXT_PUBLIC_*, integration keys, agent keys,
    # proxies, telemetry settings, or shell startup configuration.
    return {
        "PATH": os.defpath,
        "HOME": str(home),
        "TMPDIR": str(home),
        "LANG": "en_US.UTF-8",
        "NODE_ENV": "development",
        "NEXT_TELEMETRY_DISABLED": "1",
        "CI": "1",
    }


def copy_source(root, target):
    names = git(root, "ls-files", "--cached", "--others", "--exclude-standard", "-z")
    for name in names.decode().split("\0"):
        if not name:
            continue
        relative = Path(name)
        if relative.is_absolute() or ".." in relative.parts:
            raise ValueError("Unsafe source path")
        if any(part.startswith(".env") for part in relative.parts):
            continue
        if relative.parts[0] in {".git", "node_modules", ".next", "qa-results"}:
            continue
        source = root / relative
        # Never follow a repository symlink to a developer's private files.
        if any(parent.is_symlink() for parent in [source, *source.parents]
               if parent != root and root in parent.parents):
            raise ValueError(f"Symlink not allowed in QA source: {relative}")
        if not source.is_file():
            continue
        destination = target / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    (target / "node_modules").symlink_to(root / "node_modules", target_is_directory=True)


def choose_port():
    for port in [3101, 0]:
        with socket.socket() as sock:
            try:
                sock.bind(("127.0.0.1", port))
                return sock.getsockname()[1]
            except OSError:
                continue
    raise RuntimeError("No free loopback port")


def stop_group(process):
    # Children (Next workers, agent tools) share this QA-owned process group.
    # The leader may already have exited while a child is still alive.
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    process.wait()


def wait_ready(url, process, seconds):
    deadline = time.monotonic() + seconds
    opener = local_opener()
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError("QA demo process exited before readiness")
        try:
            # A TCP listener alone is not a ready Next application.
            with opener.open(url + "/demo", timeout=min(5, seconds)) as response:
                if response.status == 200 and process.poll() is None:
                    return
        except (OSError, urllib.error.URLError):
            pass
        time.sleep(0.5)
    raise TimeoutError("QA demo did not become ready within the startup deadline")


@contextlib.contextmanager
def demo_server(root, results, config):
    with tempfile.TemporaryDirectory(prefix="hoasis-qa-") as temporary:
        run_dir = Path(temporary)
        source = run_dir / "app"
        source.mkdir()
        home = run_dir / "home"
        home.mkdir()
        profile = run_dir / "browser-profile"
        browser_config = run_dir / "browser.json"
        browser_config.write_text("{}\n")
        # A short socket directory keeps agent-browser under the Unix socket path limit.
        socket_dir = run_dir / "s"
        socket_dir.mkdir()
        copy_source(root, source)
        node = shutil.which("node")
        if not node:
            raise RuntimeError("Node is missing")
        port = choose_port()
        url = f"http://127.0.0.1:{port}"
        command = [node, str(root / "node_modules/next/dist/bin/next"), "dev",
                   str(source), "--webpack", "--hostname", "127.0.0.1", "--port", str(port)]
        with (results / "server.log").open("w") as log:
            process = subprocess.Popen(command, cwd=source, env=clean_environment(home),
                                       stdout=log, stderr=subprocess.STDOUT,
                                       start_new_session=True)
            try:
                wait_ready(url, process, config["ci"]["readiness_seconds"])
                yield {"url": url, "profile": str(profile), "source": str(source),
                       "browser_config": str(browser_config), "socket_dir": str(socket_dir)}
            finally:
                stop_group(process)


def setup_report(results, scope, summary, result="BLOCKED"):
    results.mkdir(parents=True, exist_ok=True)
    data = {"tests": [{"id": "setup", "app": "setup", "persona": "none",
                      "result": result, "summary": summary, "evidence": []}],
            "actions": [] if result == "INCONCLUSIVE" else [summary],
            "suggested_updates": []}
    (results / "report.json").write_text(json.dumps(data, indent=2) + "\n")
    (results / "report.md").write_text("## QA Report\n")
    return finalize(results, scope, generated=True)


def validate_report(results, scope, generated=False):
    markdown = results / "report.md"
    if not markdown.is_file() or markdown.is_symlink() or not markdown.read_text().startswith("## QA Report"):
        raise ValueError("Missing or invalid Markdown report")
    report = results / "report.json"
    if not report.is_file() or report.is_symlink():
        raise ValueError("Missing JSON report")
    data = json.loads(report.read_text())
    tests = data["tests"]
    if not isinstance(tests, list) or not tests:
        raise ValueError("Report has no test rows")
    ids = set()
    for row in tests:
        if not isinstance(row["id"], str) or not row["id"] or row["id"] in ids:
            raise ValueError("Report test IDs must be unique")
        ids.add(row["id"])
        if row["result"] not in STATUSES:
            raise ValueError("Unknown QA status")
        for key in ["app", "persona", "summary"]:
            if not isinstance(row[key], str) or not row[key].strip():
                raise ValueError(f"Missing row {key}")
        evidence = row["evidence"]
        if not isinstance(evidence, list) or (row["result"] == "PASS" and not evidence):
            raise ValueError("PASS requires captured evidence")
        for name in evidence:
            relative = Path(name)
            path = results / relative
            if (relative.is_absolute() or ".." in relative.parts
                    or path.is_symlink() or not path.is_file()
                    or results.resolve() not in path.resolve().parents
                    or path.stat().st_size == 0
                    or path.suffix not in {".txt", ".png", ".webm", ".mp4"}):
                raise ValueError("Evidence must be a nonempty, run-owned capture")
    if not generated:
        if any(app not in {r["app"] for r in tests} for app in scope["apps"]):
            raise ValueError("Report omitted an affected app")
        if "backend" in scope["apps"] and not any(
                r["app"] == "backend" and r["result"] in {"BLOCKED", "FAIL"} for r in tests):
            raise ValueError("Backend-dependent coverage cannot pass from demo evidence")
    if any(r["result"] == "FAIL" for r in tests):
        outcome = "FAIL"
    elif any(r["result"] == "BLOCKED" for r in tests):
        outcome = "BLOCKED"
    elif any(r["result"] != "PASS" for r in tests):
        outcome = "INCONCLUSIVE"
    else:
        outcome = "PASS"
    if not scope["apps"] and all(r["result"] == "INCONCLUSIVE" for r in tests):
        if not generated:
            raise ValueError("Only the runner may mark a no-app diff not applicable")
        return data, "INCONCLUSIVE", True
    return data, outcome, outcome == "PASS"


def render_report(results, scope, data, outcome):
    def cell(value):
        return str(value).replace("|", "\\|").replace("\n", " ")

    rows = "\n".join(
        "| " + " | ".join(cell(row[k]) for k in
                         ["id", "app", "persona", "result", "summary"]) + " |"
        for row in data["tests"])
    evidence = []
    for name in dict.fromkeys(n for row in data["tests"] for n in row["evidence"]):
        path = results / name
        if path.suffix == ".txt":
            # Keep PR comments bounded and escape evidence-controlled fences.
            content = path.read_text()[:4000].replace("```", "'''")
            evidence.append(f"#### {cell(name)}\n\n```text\n{content}\n```")
        else:
            evidence.append(f"- `{cell(name)}`: download from the run artifacts.")
    updates = []
    for update in data.get("suggested_updates", []):
        if update["file"] not in {".factory/skills/qa-web/SKILL.md",
                                  ".factory/skills/qa-backend/SKILL.md"}:
            raise ValueError("Invalid skill suggestion target")
        text = update["markdown"].replace("```", "'''")
        updates.append(
            f"<details>\n<summary>Add to {update['file']}, Known Failure Modes</summary>\n\n"
            f"```markdown\n{text}\n```\n</details>")
    replacements = {
        "OUTCOME": outcome, "TARGET": scope.get("target", "Isolated local branch demo"),
        "BASE": scope["base"], "HEAD": scope["head"], "ROWS": rows,
        "EVIDENCE": "\n\n".join(evidence) or "No application evidence captured.",
        "ACTIONS": "\n".join("- " + cell(a) for a in data.get("actions", [])) or "None.",
        "SUGGESTED_UPDATES": "### Suggested Skill Updates\n\n" + "\n\n".join(updates) if updates else "",
    }
    template = (ROOT / ".factory/skills/qa/REPORT-TEMPLATE.md").read_text()
    for key, value in replacements.items():
        template = template.replace("{{" + key + "}}", value)
    (results / "report.md").write_text(template)


def finalize(results, scope, agent_exit=0, generated=False):
    data, outcome, passed = validate_report(results, scope, generated)
    if agent_exit != 0:
        outcome, passed = "FAIL", False
        data.setdefault("actions", []).append(f"QA agent failed with exit code {agent_exit}.")
    render_report(results, scope, data, outcome)
    (results / "status.json").write_text(json.dumps(
        {"outcome": outcome, "passed": passed, "applicable": bool(scope["apps"])},
        indent=2) + "\n")
    return 0 if passed else 1


def run_agent(root, results, scope, server, config):
    run_id = str(uuid.uuid4())
    session = browser_session(run_id)
    environment = {k: v for k, v in os.environ.items()
                   if k in {"PATH", "HOME", "LANG", "TMPDIR", "FACTORY_API_KEY"}}
    environment.update({
        "CI": "true", "FACTORY_DISABLE_KEYRING": "true",
        "QA_BASE_URL": server["url"], "QA_BROWSER_PROFILE": server["profile"],
        "QA_RUN_ID": run_id, "AGENT_BROWSER_SESSION": session,
        "AGENT_BROWSER_PROFILE": server["profile"],
        "AGENT_BROWSER_CONFIG": server["browser_config"],
        "AGENT_BROWSER_SOCKET_DIR": server["socket_dir"],
        "AGENT_BROWSER_NAMESPACE": run_id,
        "QA_RESULTS_DIR": str(results), "QA_DIFF_BASE": scope["base"],
        "QA_DIFF_HEAD": scope["head"],
    })
    prompt = (
        "Non-interactive CI functional QA. No human is available. Do not use AskUser "
        "or wait for confirmations. Run the qa skill using the existing QA_BASE_URL. "
        "Read runtime evidence/Compose switches from config. Use one run-scoped browser "
        "profile. Read scope.json and the actual diff. Do not run CI suites or edit code. "
        "Never access hosted services, credentials files, or production. Do not post, "
        "upload, commit, push, create PRs, or deploy. Write BOTH report.md and report.json "
        "to QA_RESULTS_DIR using the qa skill contract. Close only your browser session."
    )
    with (results / "agent.log").open("w") as log:
        process = subprocess.Popen(["droid", "exec", "--auto", "medium", prompt],
                                   cwd=root, env=environment, stdout=log,
                                   stderr=subprocess.STDOUT, start_new_session=True)
        try:
            return process.wait(timeout=config["ci"]["agent_timeout_seconds"])
        except subprocess.TimeoutExpired:
            return 124
        finally:
            stop_group(process)
            # agent-browser's daemon can outlive the agent process group.
            # Close the exact run session even when the agent times out.
            browser = shutil.which("agent-browser")
            if browser:
                close_session(browser, session, root, environment, log)


def browser_session(run_id):
    # agent-browser names a Unix socket after the session. A full UUID pushed
    # the path past the 103-byte socket limit on GitHub's Linux runners.
    return "qa-" + run_id.split("-")[0]


def close_session(browser, session, root, environment, log):
    # A failed close must not replace the agent's report: the run's evidence
    # still decides the result, and the runner owns the process group.
    cleanup_env = {k: v for k, v in environment.items() if k != "FACTORY_API_KEY"}
    log.flush()
    try:
        closed = subprocess.run([browser, "--session", session, "close"],
                                cwd=root, env=cleanup_env, stdout=log,
                                stderr=subprocess.STDOUT, timeout=15)
        message = None if closed.returncode == 0 else f"exited {closed.returncode}"
    except (OSError, subprocess.TimeoutExpired) as error:
        message = str(error)
    if message:
        log.write(f"Browser session {session} close failed: {message}\n")
        print(f"Warning: browser session {session} close failed: {message}")
    return message is None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["scope", "run", "smoke", "finalize", "blocked"])
    parser.add_argument("--base", required=True)
    parser.add_argument("--head", default="HEAD")
    parser.add_argument("--reason", default="QA setup did not complete; inspect the job log.")
    args = parser.parse_args()
    results = (ROOT / RESULTS).resolve()
    results.mkdir(exist_ok=True)
    scope = {"base": args.base, "head": args.head, "paths": [], "apps": ["setup"]}
    try:
        config = load_config()
        scope = scope_diff(ROOT, config, args.base, args.head)
        if args.command == "scope":
            (results / "scope.json").write_text(json.dumps(scope, indent=2) + "\n")
            outputs = {
                "applicable": bool(scope["apps"]),
                "video": config["video_evidence"],
                "compose": config["video_evidence"] and config["droid_control"]["compose"],
            }
            if os.getenv("GITHUB_OUTPUT"):
                with open(os.environ["GITHUB_OUTPUT"], "a") as output:
                    for key, value in outputs.items():
                        output.write(f"{key}={str(value).lower()}\n")
            print(json.dumps(outputs))
            return 0
        if args.command == "blocked":
            return setup_report(results, scope, args.reason)
        if args.command == "finalize":
            return finalize(results, scope)
        # Refuse stale reports rather than turning a previous run into evidence.
        if any((results / name).exists() for name in ["report.md", "report.json", "status.json"]):
            print("Use a fresh qa-results directory; preserve previous evidence elsewhere")
            return 1
        (results / "scope.json").write_text(json.dumps(scope, indent=2) + "\n")
        if os.getenv("QA_AUTHORIZED") == "false":
            return setup_report(results, scope, "Fork PR setup blocked: no authorized credentials. "
                                "Do not expose repository secrets to fork code.")
        if not scope["apps"] and args.command != "smoke":
            return setup_report(results, scope, "No app code changed; QA not applicable.",
                                result="INCONCLUSIVE")
        if args.command == "run" and not os.getenv("FACTORY_API_KEY"):
            return setup_report(results, scope, "Missing FACTORY_API_KEY for functional QA agent.")
        with demo_server(ROOT, results, config) as server:
            scope["target"] = server["url"]
            (results / "scope.json").write_text(json.dumps(scope, indent=2) + "\n")
            if args.command == "smoke":
                # Installation verification, not an app QA result.
                opener = local_opener()
                with opener.open(server["url"] + "/demo", timeout=30) as response:
                    (results / "startup-smoke.txt").write_text(
                        f"GET /demo: {response.status}\nFresh isolated source served.\n")
                try:
                    opener.open(server["url"] + "/api/health", timeout=30)
                    raise ValueError("Isolated demo unexpectedly reported healthy real integrations")
                except urllib.error.HTTPError as error:
                    if error.code != 503:
                        raise
                    health = error.read().decode()
                    (results / "startup-health.txt").write_text(health)
                print("PASS: isolated local demo startup; not a functional QA report")
                return 0
            agent_exit = run_agent(ROOT, results, scope, server, config)
        try:
            return finalize(results, scope, agent_exit)
        except (ValueError, KeyError, TypeError, OSError) as error:
            return setup_report(results, scope, f"Agent/report failure: {error}", result="FAIL")
    except (ValueError, KeyError, TypeError, OSError, RuntimeError,
            subprocess.SubprocessError, yaml.YAMLError) as error:
        return setup_report(results, scope, f"QA setup blocked: {error}")


if __name__ == "__main__":
    raise SystemExit(main())
