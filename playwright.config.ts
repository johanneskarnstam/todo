import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173/todo/',
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
      name: 'chromium',
      testIgnore: '**/touch-drag-drop.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      testMatch: '**/touch-drag-drop.spec.ts',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'VITE_DEV_AUTH_BYPASS=true npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/todo/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
