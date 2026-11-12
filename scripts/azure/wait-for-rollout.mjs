import { spawnSync } from "node:child_process";

// Status reads and health requests share one deadline. The attempt limit also
// bounds polling when a local test replaces sleep with an immediate return.
const TIMEOUT_MS = 150_000;
const MAX_ATTEMPTS = 30;
const [group, app, revision, image, previousRevision] = process.argv.slice(2);

function waitForRollout() {
  const revisionName = new RegExp(`^${app}--[a-z0-9-]+$`);
  if (
    !group ||
    !app ||
    !image ||
    !revisionName.test(revision ?? "") ||
    !revisionName.test(previousRevision ?? "") ||
    revision === previousRevision
  ) {
    throw new Error(
      "The update did not identify a new revision. Refusing to accept hostname health.",
    );
  }

  const deadline = performance.now() + TIMEOUT_MS;
  const remaining = () => deadline - performance.now();
  function run(command, args) {
    const timeout = Math.floor(Math.min(10_000, remaining()));
    if (timeout <= 0) throw new Error("The rollout verification deadline expired.");
    const result = spawnSync(command, args, {
      encoding: "utf8",
      timeout,
      killSignal: "SIGKILL",
      maxBuffer: 1024 * 1024,
    });
    if (result.error || result.status !== 0) return null;
    return result.stdout.trim();
  }

  function readStatus(args) {
    const output = run("az", [...args, "--only-show-errors", "-o", "json"]);
    if (output === null) throw new Error("Azure status could not be read. Rollout not verified.");
    try {
      const value = JSON.parse(output);
      if (value && typeof value === "object" && !Array.isArray(value)) return value;
    } catch {
      // Never echo a provider response: the selected fields are enough to judge it.
    }
    throw new Error("Azure returned missing or malformed status. Rollout not verified.");
  }

  function readyHost() {
    const status = readStatus([
      "containerapp",
      "revision",
      "show",
      "-g",
      group,
      "-n",
      app,
      "--revision",
      revision,
      "--query",
      "{name:name,image:properties.template.containers[0].image,active:properties.active,provisioning:properties.provisioningState,running:properties.runningState,health:properties.healthState,trafficWeight:properties.trafficWeight}",
    ]);
    if (status.name !== revision || status.image !== image) {
      throw new Error("The intended revision or image does not match Azure status.");
    }
    if (
      status.provisioning === "Failed" ||
      status.running === "Failed" ||
      status.running === "Degraded" ||
      status.health === "Unhealthy"
    ) {
      throw new Error(
        "The intended revision failed or is unhealthy. Hostname health is not proof.",
      );
    }

    const routing = readStatus([
      "containerapp",
      "show",
      "-g",
      group,
      "-n",
      app,
      "--query",
      "{latest:properties.latestRevisionName,ready:properties.latestReadyRevisionName,image:properties.template.containers[0].image,fqdn:properties.configuration.ingress.fqdn,traffic:properties.configuration.ingress.traffic}",
    ]);
    if (
      status.active !== true ||
      status.provisioning !== "Provisioned" ||
      status.running !== "Running" ||
      status.health !== "Healthy" ||
      status.trafficWeight !== 100 ||
      routing.latest !== revision ||
      routing.ready !== revision ||
      routing.image !== image ||
      typeof routing.fqdn !== "string" ||
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(routing.fqdn) ||
      !Array.isArray(routing.traffic) ||
      !routing.traffic.length
    ) {
      return null;
    }

    let total = 0;
    let intended = 0;
    for (const rule of routing.traffic) {
      if (
        !rule ||
        !Number.isInteger(rule.weight) ||
        rule.weight < 0 ||
        rule.weight > 100 ||
        (rule.latestRevision != null && typeof rule.latestRevision !== "boolean")
      ) {
        return null;
      }
      const target = rule.latestRevision === true ? routing.latest : rule.revisionName;
      // An alias and an explicit name must not disagree about their destination.
      if (
        typeof target !== "string" ||
        !revisionName.test(target) ||
        (rule.latestRevision === true && rule.revisionName != null && rule.revisionName !== target)
      ) {
        return null;
      }
      total += rule.weight;
      if (target === revision) intended += rule.weight;
    }
    return total === 100 && intended === 100 ? routing.fqdn : null;
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS && remaining() > 0; attempt++) {
    const fqdn = readyHost();
    if (fqdn) {
      const health = run("curl", [
        "--fail",
        "--silent",
        "--show-error",
        "--connect-timeout",
        "5",
        "--max-time",
        "10",
        "--output",
        "/dev/null",
        "--write-out",
        "%{http_code}",
        `https://${fqdn}/api/health`,
      ]);
      // A healthy answer is only useful while the same revision still owns the
      // hostname. Read both snapshots again rather than reusing pre-request data.
      if (health === "200" && readyHost() === fqdn && remaining() > 0) {
        console.log(`healthy: https://${fqdn} (${revision}, ${image}, 100% traffic)`);
        return;
      }
    }
    if (attempt + 1 < MAX_ATTEMPTS && remaining() > 0) {
      if (run("sleep", [String(Math.min(5, remaining() / 1000))]) === null) {
        throw new Error("Rollout verification could not continue.");
      }
    }
  }
  throw new Error(
    "The intended revision did not become ready with 100% traffic within 150 seconds.",
  );
}

try {
  waitForRollout();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
