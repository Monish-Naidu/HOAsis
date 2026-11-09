"""Offline contract tests. No GitHub comments, hosted services, or app credentials."""

import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import yaml

spec = importlib.util.spec_from_file_location("qa_runner", Path(__file__).with_name("run.py"))
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)


class QAContracts(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="hoasis-qa-contract-")
        self.directory = Path(self.temporary.name)
        self.scope = {"base": "base", "head": "head", "apps": ["web"]}

    def tearDown(self):
        self.temporary.cleanup()

    def report(self, result="PASS", app="web", evidence=True):
        (self.directory / "capture.txt").write_text("Observed success\n")
        (self.directory / "report.md").write_text("## QA Report\n")
        data = {"tests": [{"id": "flow", "app": app, "persona": "resident",
                          "result": result, "summary": "Observed result",
                          "evidence": ["capture.txt"] if evidence else []}],
                "actions": [], "suggested_updates": []}
        (self.directory / "report.json").write_text(json.dumps(data))
        return data

    def test_every_generated_yaml_and_json_parses(self):
        files = [qa.ROOT / qa.CONFIG,
                 qa.ROOT / ".factory/skills/qa/.install-progress.yaml",
                 *sorted((qa.ROOT / ".github/workflows").glob("qa*.yml"))]
        for file in files:
            with self.subTest(file=file):
                self.assertIsInstance(yaml.safe_load(file.read_text()), dict)
        settings = json.loads((qa.ROOT / ".factory/settings.json").read_text())
        self.assertIs(settings["enabledPlugins"]["droid-control@factory-plugins"], True)

    def test_frontmatter_and_mirrors(self):
        for name in ["qa", "qa-web", "qa-backend"]:
            file = qa.ROOT / f".factory/skills/{name}/SKILL.md"
            content = file.read_text()
            metadata = yaml.safe_load(content.split("---", 2)[1])
            self.assertEqual(metadata["name"], name)
            self.assertTrue(metadata["description"])
            self.assertEqual(content, (qa.ROOT / f".claude/skills/{name}/SKILL.md").read_text())

    def test_workflow_plugin_status_formats(self):
        workflow = yaml.safe_load((qa.ROOT / ".github/workflows/qa.yml").read_text())
        step = next(step for step in workflow["jobs"]["functional"]["steps"]
                    if step.get("name") == "Install Droid and browser prerequisites")
        script = step["run"].split("python3 - <<'PY'\n", 1)[1].split("\nPY", 1)[0]
        header = "PLUGIN                         STATUS   SOURCE   VERSION\n"
        plugin = "droid-control@factory-plugins"
        cases = [
            (header + f"{plugin}  Enabled  project  e63e519a7361\n", True),
            (header + f"{plugin}\tEnabled\tproject\te63e519a7361\n", True),
            (f"Active:\n  {plugin} (e63e519)\n\nDisabled:\n", True),
            (header + f"{plugin}  Disabled  project  e63e519a7361\n", False),
            (header + f"{plugin}  Enabled  user  e63e519a7361\n", False),
            (header + f"other-{plugin}  Enabled  project  e63e519a7361\n", False),
            (header + f"{plugin}-other  Enabled  project  e63e519a7361\n", False),
            (f"Active:\n  other-plugin\n\nDisabled:\n  {plugin}\n", False),
            (f"Active:\n  other-{plugin}\n", False),
            ("", False),
        ]
        for listing, expected in cases:
            with self.subTest(listing=listing):
                (self.directory / "qa-plugins.txt").write_text(listing)
                result = subprocess.run([sys.executable, "-c", script], capture_output=True,
                                        env={**os.environ, "RUNNER_TEMP": str(self.directory)})
                self.assertEqual(result.returncode == 0, expected, result.stderr.decode())

    def test_environment_is_allowlisted_not_blanked(self):
        with patch.dict(os.environ, {"STRIPE_SECRET_KEY": "sentinel", "NODE_OPTIONS": "sentinel",
                                     "NEXT_PUBLIC_SUPABASE_URL": "sentinel", "FACTORY_API_KEY": "sentinel"}):
            environment = qa.clean_environment(self.directory)
        self.assertEqual(set(environment), {
            "PATH", "HOME", "TMPDIR", "LANG", "NODE_ENV", "NEXT_TELEMETRY_DISABLED", "CI"})
        self.assertNotIn("sentinel", environment.values())

    def test_copy_omits_all_next_env_candidates_and_build_output(self):
        names = [".env", ".env.local", ".env.development", ".env.development.local",
                 ".env.test", ".env.test.local", ".env.production", ".env.production.local",
                 ".env.example", "src/.env.local", "src/page.tsx", ".next/server.js"]
        source, destination = self.directory / "source", self.directory / "copy"
        source.mkdir()
        destination.mkdir()
        for name in names:
            path = source / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("sentinel" if ".env" in name else "source")
        with patch.object(qa, "git", return_value="\0".join(names).encode()):
            qa.copy_source(source, destination)
        self.assertEqual((destination / "src/page.tsx").read_text(), "source")
        self.assertFalse(list(destination.rglob(".env*")))
        self.assertFalse((destination / ".next").exists())

    def test_source_symlinks_are_not_followed(self):
        source, destination = self.directory / "source", self.directory / "copy"
        source.mkdir()
        destination.mkdir()
        (source / "private.ts").symlink_to("/etc/hosts")
        with patch.object(qa, "git", return_value=b"private.ts\0"):
            with self.assertRaisesRegex(ValueError, "Symlink"):
                qa.copy_source(source, destination)

    def test_scope_selects_shared_mutations_and_server_only_files(self):
        config = qa.load_config()
        cases = [
            ("docs/guide.md", []), (".factory/skills/qa/config.yaml", []),
            ("next.config.ts", []), ("src/app/resident/pay/page.tsx", ["web"]),
            ("src/app/api/stripe/payment-intent/route.ts", ["backend"]),
            ("src/app/auth/callback/route.ts", ["web", "backend"]),
            ("src/app/auth/reset/page.tsx", ["web", "backend"]),
            ("src/proxy.ts", ["web", "backend"]),
            ("src/lib/app-state/money.ts", ["web", "backend"]),
            ("src/lib/data/remote.ts", ["web", "backend"]),
            ("src/lib/email/send.ts", ["backend"]),
            ("supabase/migrations/1000_fix.sql", ["backend"]),
        ]
        for path, expected in cases:
            with self.subTest(path=path):
                with patch.object(qa, "git", side_effect=[b"a\n", b"b\n", path.encode() + b"\0"]):
                    self.assertEqual(qa.scope_diff(qa.ROOT, config, "base", "head")["apps"], expected)

    def test_scope_disables_rename_collapsing(self):
        with patch.object(qa, "git", side_effect=[b"a\n", b"b\n", b"src/old.ts\0docs/new.md\0"]) as git:
            self.assertEqual(qa.scope_diff(qa.ROOT, qa.load_config(), "base", "head")["apps"], ["web"])
            self.assertIn("--no-renames", git.call_args.args)

    def test_pass_and_failure_status_matrix(self):
        for result, expected, code in [
                ("PASS", "PASS", 0), ("FAIL", "FAIL", 1), ("BLOCKED", "BLOCKED", 1),
                ("FLAKY", "INCONCLUSIVE", 1), ("INCONCLUSIVE", "INCONCLUSIVE", 1)]:
            with self.subTest(result=result):
                self.report(result)
                self.assertEqual(qa.finalize(self.directory, self.scope), code)
                status = json.loads((self.directory / "status.json").read_text())
                self.assertEqual(status["outcome"], expected)

    def test_agent_error_overrides_pass(self):
        self.report()
        self.assertEqual(qa.finalize(self.directory, self.scope, agent_exit=124), 1)
        self.assertIn("exit code 124", (self.directory / "report.md").read_text())

    def test_missing_report_fails(self):
        self.report()
        (self.directory / "report.md").unlink()
        with self.assertRaisesRegex(ValueError, "Markdown"):
            qa.finalize(self.directory, self.scope)

    def test_missing_json_report_fails(self):
        self.report()
        (self.directory / "report.json").unlink()
        with self.assertRaisesRegex(ValueError, "JSON"):
            qa.finalize(self.directory, self.scope)

    def test_empty_report_fails(self):
        self.report()
        (self.directory / "report.json").write_text('{"tests":[]}')
        with self.assertRaisesRegex(ValueError, "no test"):
            qa.finalize(self.directory, self.scope)

    def test_missing_evidence_and_traversal_fail(self):
        for evidence in [[], ["../outside.txt"], ["/etc/hosts"], ["missing.txt"]]:
            with self.subTest(evidence=evidence):
                data = self.report()
                data["tests"][0]["evidence"] = evidence
                (self.directory / "report.json").write_text(json.dumps(data))
                with self.assertRaises(ValueError):
                    qa.finalize(self.directory, self.scope)

    def test_omitted_affected_app_fails(self):
        self.report()
        with self.assertRaisesRegex(ValueError, "omitted"):
            qa.finalize(self.directory, {**self.scope, "apps": ["web", "backend"]})

    def test_backend_cannot_pass_from_demo(self):
        self.report(app="backend")
        with self.assertRaisesRegex(ValueError, "Backend-dependent"):
            qa.finalize(self.directory, {**self.scope, "apps": ["backend"]})

    def test_no_app_is_only_passing_inconclusive(self):
        scope = {**self.scope, "apps": []}
        self.assertEqual(qa.setup_report(self.directory, scope, "No app code changed", "INCONCLUSIVE"), 0)
        with self.assertRaisesRegex(ValueError, "omitted"):
            qa.finalize(self.directory, self.scope)
        self.assertIn("INCONCLUSIVE", (self.directory / "report.md").read_text())

    def test_blocked_setup_and_fork_fail(self):
        for apps in [[], ["web"], ["backend"]]:
            self.assertEqual(qa.setup_report(self.directory, {**self.scope, "apps": apps},
                                            "Fork PR setup blocked"), 1)

    def test_evidence_fences_cannot_break_snapshot(self):
        self.report()
        (self.directory / "capture.txt").write_text("``` @someone <script>test</script>")
        self.assertEqual(qa.finalize(self.directory, self.scope), 0)
        self.assertIn("''' @someone", (self.directory / "report.md").read_text())

    def test_config_switches_read_at_runtime(self):
        config = qa.load_config()
        root = self.directory
        path = root / qa.CONFIG
        path.parent.mkdir(parents=True)
        for video, compose in [(False, False), (True, False), (True, True), (False, True)]:
            config["video_evidence"] = video
            config["droid_control"]["compose"] = compose
            path.write_text(yaml.safe_dump(config))
            loaded = qa.load_config(root)
            self.assertEqual(loaded["video_evidence"] and loaded["droid_control"]["compose"],
                             video and compose)

    def test_failure_learning_stays_report_only(self):
        data = self.report(result="BLOCKED")
        data["suggested_updates"] = [{
            "file": ".factory/skills/qa-web/SKILL.md", "section": "Known Failure Modes",
            "markdown": "- New environment failure: exact proposed text.",
        }]
        (self.directory / "report.json").write_text(json.dumps(data))
        self.assertEqual(qa.finalize(self.directory, self.scope), 1)
        self.assertIn("<details>", (self.directory / "report.md").read_text())

    def test_no_production_or_comment_transport_in_runner(self):
        source = Path(qa.__file__).read_text()
        self.assertNotIn("https://www.yourhoasis.com", source)
        self.assertNotIn("api.github.com", source)
        self.assertNotIn("createComment", source)

    def test_readiness_stops_if_process_exits(self):
        with patch.object(qa.subprocess, "Popen") as process:
            process.poll.return_value = 1
            with self.assertRaisesRegex(RuntimeError, "exited"):
                qa.wait_ready("http://127.0.0.1:3101", process, 0.1)

    def test_port_is_non_3000_loopback(self):
        self.assertNotEqual(qa.choose_port(), 3000)

    def main_run(self, apps, environment):
        directory = self.directory / "results"
        with patch.object(qa, "RESULTS", directory), \
                patch.object(qa, "scope_diff", return_value={**self.scope, "apps": apps}), \
                patch.object(sys, "argv", ["run.py", "run", "--base", "HEAD"]), \
                patch.dict(os.environ, environment, clear=True):
            return qa.main(), directory

    def test_entrypoint_fork_blocks_even_docs_only_and_never_launches_app(self):
        with patch.object(qa, "demo_server") as server:
            code, directory = self.main_run([], {"QA_AUTHORIZED": "false"})
        self.assertEqual(code, 1)
        server.assert_not_called()
        self.assertIn("Fork PR setup blocked", (directory / "report.md").read_text())

    def test_entrypoint_docs_only_needs_no_agent_key(self):
        with patch.object(qa, "demo_server") as server:
            code, directory = self.main_run([], {})
        self.assertEqual(code, 0)
        server.assert_not_called()
        self.assertEqual(json.loads((directory / "status.json").read_text())["outcome"], "INCONCLUSIVE")

    def test_entrypoint_missing_key_blocks_without_starting_demo(self):
        with patch.object(qa, "demo_server") as server:
            code, directory = self.main_run(["web"], {})
        self.assertEqual(code, 1)
        server.assert_not_called()
        self.assertIn("Missing FACTORY_API_KEY", (directory / "report.md").read_text())

    def test_entrypoint_refuses_to_overwrite_previous_report(self):
        directory = self.directory / "results"
        directory.mkdir()
        report = directory / "report.md"
        report.write_text("Preserve previous user evidence")
        code, _ = self.main_run(["web"], {})
        self.assertEqual(code, 1)
        self.assertEqual(report.read_text(), "Preserve previous user evidence")

    def test_entrypoint_early_server_exit_reports_blocked(self):
        with patch.object(qa, "demo_server", side_effect=RuntimeError("QA demo process exited before readiness")):
            code, directory = self.main_run(["web"], {"FACTORY_API_KEY": "test-reference-only"})
        self.assertEqual(code, 1)
        self.assertIn("before readiness", (directory / "report.md").read_text())
        self.assertEqual(json.loads((directory / "status.json").read_text())["outcome"], "BLOCKED")

    def test_entrypoint_missing_node_reports_blocked(self):
        with patch.object(qa, "demo_server", side_effect=RuntimeError("Node is missing")):
            code, directory = self.main_run(["web"], {"FACTORY_API_KEY": "test-reference-only"})
        self.assertEqual(code, 1)
        self.assertIn("Node is missing", (directory / "report.md").read_text())

    def test_next_native_env_loader_sees_no_env_files_or_inherited_keys(self):
        source, destination = self.directory / "source", self.directory / "copy"
        source.mkdir()
        destination.mkdir()
        (source / ".env.local").write_text("QA_SENTINEL=from-local\n")
        (source / ".env").write_text("QA_SENTINEL=from-default\n")
        with patch.object(qa, "git", return_value=b".env.local\0.env\0"):
            qa.copy_source(source, destination)
        script = """
        const {createRequire} = require('node:module');
        const req = createRequire(require('node:fs').realpathSync(process.argv[1] + '/node_modules/next/package.json'));
        const {loadEnvConfig} = req('@next/env');
        const loaded = loadEnvConfig(process.argv[2], true);
        if (loaded.loadedEnvFiles.length || process.env.QA_SENTINEL) process.exit(1);
        console.log('Native Next env loader: no files loaded, no inherited sentinel');
        """
        environment = qa.clean_environment(self.directory)
        with patch.dict(os.environ, {"QA_SENTINEL": "inherited"}):
            result = subprocess.run([shutil.which("node"), "-e", script, str(qa.ROOT), str(destination)],
                                    cwd=destination, env=environment, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_comment_reporter_offline_create_update_and_fallback(self):
        workflow = yaml.safe_load((qa.ROOT / ".github/workflows/qa-report.yml").read_text())
        script = workflow["jobs"]["comment"]["steps"][-1]["with"]["script"]
        harness = """
        const fs = require('node:fs');
        const script = fs.readFileSync(0, 'utf8');
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        (async () => {
          for (const mode of ['create','update','missing','oversize','stale','mentions']) {
            const writes = [];
            const run = {head_sha:'head', conclusion:'failure', html_url:'https://github.com/example/run'};
            const github = {
              paginate: async () => mode === 'update' ? [{id:7, user:{type:'Bot'},body:'<!-- qa-report -->old'}] : [],
              rest: {
                pulls: {get: async () => ({data:{head:{sha:mode === 'stale' ? 'new-head' : 'head'}}})},
                issues: {
                  listComments: () => {},
                  updateComment: async data => writes.push(['update',data]),
                  createComment: async data => writes.push(['create',data])
                }
              }
            };
            const mockfs = {
              existsSync: () => mode !== 'missing',
              lstatSync: () => ({isFile:()=>true}),
              statSync: () => ({size:mode === 'oversize' ? 1000001 : 100}),
              readFileSync: () => '## QA Report\\nOutcome: FAIL\\n@person <!-- qa-report -->'
            };
            await new AsyncFunction('require','context','github','process',script)(
              () => mockfs, {repo:{owner:'owner',repo:'repo'},payload:{workflow_run:run}},
              github, {env:{PR_NUMBER:'12'}}
            );
            if (mode === 'stale') {
              if (writes.length) throw Error('stale run wrote a comment');
              continue;
            }
            if (writes.length !== 1) throw Error('not exactly one comment write');
            if (mode === 'update' && writes[0][0] !== 'update') throw Error('failed to update');
            const body = writes[0][1].body;
            if (!body.startsWith('<!-- qa-report -->\\n## QA Report')) throw Error('missing marker');
            if (body.includes('@person')) throw Error('mention not neutralized');
            if (['missing','oversize'].includes(mode) && !body.includes('BLOCKED')) throw Error('no fallback');
          }
          console.log('6 offline reporter cases passed; no GitHub calls');
        })().catch(error => {console.error(error); process.exitCode=1});
        """
        result = subprocess.run([shutil.which("node"), "-e", harness], input=script,
                                text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
