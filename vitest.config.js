import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 120000, // 2 minutes for HTTP requests
    hookTimeout: 120000,
    include: ["test/**/*.js"],
    fileParallelism: false, // Run test files sequentially to avoid cache/server state issues
  },
});
