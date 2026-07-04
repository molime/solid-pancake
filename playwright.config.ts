import { defineConfig, devices } from '@playwright/test'

function isLocalConvexUrl(): boolean {
  const url = process.env.VITE_CONVEX_URL
  if (!url) return true
  try {
    const { hostname } = new URL(url)
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return true
  }
}

function e2eCredentialsAvailable(): boolean {
  return Boolean(
    process.env.E2E_CLERK_ORG_ID &&
      process.env.E2E_ADMIN_EMAIL &&
      process.env.E2E_ADMIN_PASSWORD &&
      process.env.E2E_COORDINATOR_EMAIL &&
      process.env.E2E_COORDINATOR_PASSWORD &&
      process.env.E2E_CAREGIVER_EMAIL &&
      process.env.E2E_CAREGIVER_PASSWORD,
  )
}

const isFullRun = process.env.E2E_FULL === '1' || process.env.E2E_FULL === 'true'
const skipAuthSpecs = !isFullRun && (!e2eCredentialsAvailable() || isLocalConvexUrl())

if (skipAuthSpecs) {
  console.log('Skipping @auth specs: local Convex backend or missing E2E Clerk credentials.')
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 120000,
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /session1-phase2-schema\.spec\.ts$/,
      ...(skipAuthSpecs ? { grepInvert: /@auth/ } : {}),
    },
    {
      name: 'local-harness',
      testMatch: /session1-phase2-schema\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
})
