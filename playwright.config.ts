import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'os';
import { join } from 'path';

// Each test run gets a fresh isolated database
const TEST_DB = join(tmpdir(), `manifest-e2e-${Date.now()}.db`);
const API_PORT = 17099; // separate from dev port (17010) to avoid conflicts
const WEB_PORT = 5174;  // separate from dev port (5173) to avoid conflicts

export { TEST_DB, API_PORT, WEB_PORT };

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // tests share one server instance per run
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      // Rust API server with isolated temp database
      command: `MANIFEST_DB=${TEST_DB} ../target/debug/manifest serve --port ${API_PORT}`,
      port: API_PORT,
      reuseExistingServer: false,
      timeout: 15_000,
    },
    {
      // SvelteKit dev server — proxies /api to API_PORT
      command: `MANIFEST_API_PORT=${API_PORT} pnpm dev --port ${WEB_PORT}`,
      port: WEB_PORT,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
