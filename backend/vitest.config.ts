import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Load .env for integration tests (provides DATABASE_URL, etc.)
    env: Object.fromEntries(
      (await import("dotenv")).config({ path: ".env" }).parsed
        ? Object.entries((await import("dotenv")).config({ path: ".env" }).parsed!)
        : []
    ),
  },
});
