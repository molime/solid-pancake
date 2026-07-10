import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'

test.describe('session1 phase2 schema local harness', () => {
  test('phase2 candidates and platformTraining endpoints pass backend integration', async () => {
    const output = execSync('npm run test:phase2', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60000,
    })
    expect(output).toMatch(/passed/i)
  })
})
