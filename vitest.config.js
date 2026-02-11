import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 120000, // 2 minutes for HTTP requests
    hookTimeout: 120000,
    include: ["test/**/*.js"],
  },
});
