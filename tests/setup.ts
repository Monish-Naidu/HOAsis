import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { resetAllStores } from "@/lib/app-state";

// Every test starts from an empty browser. Leaking storage between tests is
// the classic way a suite passes in isolation and fails in CI.
beforeEach(() => {
  window.localStorage.clear();
  // The stores are module singletons and cache their value, so clearing
  // storage alone is not enough to isolate a test.
  resetAllStores();
});

afterEach(() => {
  cleanup();
  resetAllStores();
  window.localStorage.clear();
});
