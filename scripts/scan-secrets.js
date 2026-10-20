#!/usr/bin/env node
/**
 * scan-secrets.js — dependency-free secret scanner (compliance mini-phase,
 * Stage 5). Walks src/, convex/, and scripts/ for common secret patterns and
 * prints findings as `file:line: pattern-name`. Exits 1 on any hit, 0 when
 * clean. Never opens `.env*` files (real secrets live there and must not be
 * echoed into CI logs).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, basename, extname } from 'node:path'

const ROOTS = ['src', 'convex', 'scripts']
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  'coverage',
  'test-results',
])
const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.svg', '.pdf',
  '.docx', '.xlsx', '.pptx', '.zip', '.gz', '.woff', '.woff2', '.ttf',
  '.eot', '.mp4', '.webm', '.wav', '.mp3',
])

// NOTE: sk_/xox/ghp_ patterns are built by concatenation so this scanner
// file does not match its own patterns.
const PATTERNS = [
  { name: 'stripe-live-key', re: new RegExp('sk_' + 'live_[A-Za-z0-9]{8,}') },
  { name: 'stripe-test-key', re: new RegExp('sk_' + 'test_[A-Za-z0-9]{8,}') },
  { name: 'aws-access-key-id', re: /AKIA[0-9A-Z]{16}/ },
  {
    name: 'private-key-header',
    re: /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/,
  },
  { name: 'slack-token', re: /xox[baprs]-[A-Za-z0-9-]{5,}/ },
  { name: 'github-pat', re: /ghp_[A-Za-z0-9]{20,}/ },
  {
    name: 'secret-assignment',
    re: /(secret|token|api[_-]?key|password)\s*[:=]\s*['"][A-Za-z0-9+/=_-]{20,}['"]/i,
  },
]

// Known false positives: { file: '<repo-relative path>', pattern: '<name>' }.
// Keep empty unless a verified placeholder keeps tripping the scanner.
const ALLOWLIST = [
  // Clerk sign-in-ticket fixtures in candidates.test.ts (fake `sint_` ids,
  // not real secrets).
  { file: 'convex/candidates.test.ts', pattern: 'secret-assignment' },
]

function isEnvFile(name) {
  return name.startsWith('.env')
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(join(dir, entry.name))
      continue
    }
    if (!entry.isFile()) continue
    if (isEnvFile(entry.name)) continue // never open env files
    if (SKIP_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue
    yield join(dir, entry.name)
  }
}

const findings = []
let filesScanned = 0

for (const root of ROOTS) {
  let rootStat
  try {
    rootStat = statSync(root)
  } catch {
    continue
  }
  if (!rootStat.isDirectory()) continue
  for (const file of walk(root)) {
    filesScanned += 1
    const rel = relative('.', file).split('\\').join('/')
    let text
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue // binary or unreadable — skipped
    }
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      for (const { name, re } of PATTERNS) {
        if (!re.test(lines[i])) continue
        if (
          ALLOWLIST.some((a) => a.file === rel && a.pattern === name)
        ) {
          continue
        }
        findings.push(`${rel}:${i + 1}: ${name}`)
      }
    }
  }
}

if (findings.length > 0) {
  console.error(`Potential secrets found in ${findings.length} location(s):`)
  for (const f of findings) console.error(f)
  console.error(
    '\nIf a finding is a verified placeholder, add it to ALLOWLIST in scripts/scan-secrets.js.',
  )
  process.exit(1)
}

console.log(
  `scan-secrets: clean (${filesScanned} files scanned in ${ROOTS.join(', ')})`,
)
process.exit(0)
