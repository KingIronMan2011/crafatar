import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 120000, // 2 minutes for HTTP requests
    hookTimeout: 120000,
    include: ["test/**/*.js"],
    fileParallelism: false, // Run test files sequentially
    maxConcurrency: 1, // Run tests sequentially within each file to avoid global state conflicts
  },
});
