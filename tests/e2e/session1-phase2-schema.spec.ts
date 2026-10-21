import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'

test.describe('session1 phase2 schema local harness', () => {
  test('phase2 candidates and platformTraining endpoints pass backend integration', async () => {
    const output = execSync('npm run test:phase2', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      // Generous on purpose: under full-suite load the nested npm spawn on
      // Windows exceeds 60s even though the suite itself takes ~13s (flaked
      // 2026-10-20 under concurrent Playwright workers; passes in isolation).
      timeout: 180000,
    })
    expect(output).toMatch(/passed/i)
  })
})
