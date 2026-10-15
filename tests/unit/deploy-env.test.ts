import { describe, expect, it } from "vitest";
import { deployEnv, isProduction } from "@/lib/deploy-env";

describe("deployEnv", () => {
  it("reads APP_ENV, as the Container App sets it, whatever the case", () => {
    expect(deployEnv({ APP_ENV: "staging", NODE_ENV: "production" })).toBe("staging");
    expect(deployEnv({ APP_ENV: "Production", NODE_ENV: "development" })).toBe("production");
  });

  it("treats a production build with no name as production, anything else as development", () => {
    expect(deployEnv({ NODE_ENV: "production" })).toBe("production");
    expect(deployEnv({ NODE_ENV: "test" })).toBe("development");
    expect(deployEnv({})).toBe("development");
    expect(deployEnv({ APP_ENV: "nonsense", NODE_ENV: "production" })).toBe("production");
    expect(deployEnv({ APP_ENV: "preview", NODE_ENV: "production" })).toBe("production");
  });

  it("isProduction is true for production only", () => {
    expect(isProduction({ APP_ENV: "production" })).toBe(true);
    expect(isProduction({ APP_ENV: "staging", NODE_ENV: "production" })).toBe(false);
    expect(isProduction({ NODE_ENV: "test" })).toBe(false);
  });
});
