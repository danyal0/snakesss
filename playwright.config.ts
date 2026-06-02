import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = 5173;
const ADMIN_PORT = 5174;
const SERVER_PORT = 3001;

const baseURL = `http://127.0.0.1:${WEB_PORT}`;

const e2eEnv = {
  E2E_TEST: '1',
  NODE_ENV: 'test',
  JWT_SECRET: 'e2e-test-jwt-secret-min-32-chars-long',
  ADMIN_PASSWORD: 'e2e-admin-pass',
  CLIENT_ORIGIN: baseURL,
  ADMIN_ORIGIN: `http://127.0.0.1:${ADMIN_PORT}`,
  PORT: String(SERVER_PORT),
};

/** Near-zero pixel tolerance (≤1px aggregate diff per snapshot) */
export const PIXEL_SNAPSHOT = {
  maxDiffPixels: 0,
  threshold: 0,
  animations: 'disabled' as const,
};

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'e2e/report/html' }],
    ['./e2e/utils/custom-reporter.ts'],
  ],
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'on',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    launchOptions: {
      args: ['--font-render-hinting=none'],
    },
  },
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  outputDir: 'e2e/test-results',
  snapshotPathTemplate: '{testDir}/../baselines/{projectName}/{testFilePath}/{arg}{ext}',
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'firefox-desktop',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'webkit-desktop',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'iphone-pro',
      use: {
        ...devices['iPhone 15 Pro'],
      },
    },
    {
      name: 'ipad',
      use: {
        ...devices['iPad Pro 11'],
      },
    },
    {
      name: 'desktop-hd',
      use: {
        browserName: 'chromium',
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: [
    {
      command: 'npm run build --workspace=packages/shared-types && npm run build --workspace=packages/game-engine',
      cwd: process.cwd(),
      timeout: 120_000,
    },
    {
      command: 'npm run dev --workspace=apps/server',
      url: `http://127.0.0.1:${SERVER_PORT}/health`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: e2eEnv,
    },
    {
      command: 'VITE_E2E=true npm run dev --workspace=apps/web',
      url: baseURL,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev --workspace=apps/admin',
      url: `http://127.0.0.1:${ADMIN_PORT}/admin/`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
