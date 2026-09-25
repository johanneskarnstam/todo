import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'auth-gating.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174/todo/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...(process.env.PLAYWRIGHT_CHANNEL
      ? { channel: process.env.PLAYWRIGHT_CHANNEL }
      : process.platform === 'darwin' && !process.env.CI
        ? { channel: 'chrome' }
        : {}),
  },
  projects: [
    {
      name: 'chromium-auth-gating',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'VITE_E2E_AUTH_STATE=unauthenticated npm run dev -- --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174/todo/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})