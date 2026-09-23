// PRODUCTION smoke test for the live demo (read-only).
// Logs in with the 6 production accounts from guion-junta-maria.md through the
// real Clerk sign-in UI, verifies the expected landing page per role, and
// collects console/page errors. Also checks the public /apply page and the
// prod Convex deployment reachability.
//
// Run:  node scripts/prod-smoke.mjs
// Exits non-zero if any account or check fails.
// Screenshots of failures land in test-results/prod-smoke/.

import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'https://individualschoice.atriaxsolutions.com';
const CONVEX_URL = 'https://bold-magpie-434.convex.cloud/';
const PASSWORD = 'Cumbres2012DMS';
const SHOT_DIR = 'test-results/prod-smoke';
const ORG_NAME = 'Golden Ages Home Care';

fs.mkdirSync(SHOT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Console noise we deliberately ignore: favicon / 404 assets / Clerk analytics.
const NOISE = /favicon|Failed to load resource|clerk|analytics|sentry|amplitude|googletag|intercom|_clerk/i;

function bodyText(page) {
  return page.evaluate(() => document.body.innerText || '');
}

async function shot(page, name) {
  try {
    await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: false });
  } catch { /* best effort */ }
}

// Detect blocker screens (rate limit, captcha, MFA) on the Clerk page.
async function detectBlocker(page) {
  const text = (await bodyText(page).catch(() => '')).replace(/\s+/g, ' ');
  if (/too many (requests|attempts)|try again (in|later)|rate limit/i.test(text))
    return 'rate-limit';
  if (/verify you are human|captcha|robot/i.test(text))
    return 'captcha';
  if (/check your email|didn.?t receive a code|resend|new device/i.test(text))
    return 'email-otp';
  if (/two[- ]step|two-factor|multifactor|multi-factor|second factor|verification code|enter the code|authenticator/i.test(text))
    return 'mfa';
  if (/couldn.?t find your account|incorrect password|invalid/i.test(text))
    return 'auth-error';
  return null;
}

async function clerkSignIn(page, email) {
  await page.goto(`${BASE}/sign-in`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const idInput = page.locator('input[name="identifier"]');
  await idInput.waitFor({ state: 'visible', timeout: 30000 });
  await idInput.fill(email);
  await page.getByRole('button', { name: /continue/i }).first().click();
  // After identifier, Clerk may show "Use another method" etc.; wait for password field.
  const pwInput = page.locator('input[name="password"]');
  await pwInput.waitFor({ state: 'visible', timeout: 30000 });
  await pwInput.fill(PASSWORD);
  await page.getByRole('button', { name: /continue/i }).first().click();
  // Wait to leave the sign-in screens. Clerk's client-trust step renders a
  // blocker screen (email code / captcha / MFA) without changing the URL, so
  // poll for that and bail out early with a classified reason.
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const url = page.url();
    if (!url.includes('/sign-in')) return;
    const blocker = await detectBlocker(page);
    if (blocker === 'rate-limit') throw new Error('blocked-by-rate-limit: Clerk rate limit screen');
    if (blocker === 'mfa') throw new Error('FAILURE: MFA/second-factor prompt appeared');
    if (blocker) throw new Error(`BLOCKED-HEADLESS: Clerk "${blocker}" screen appeared during sign-in`);
    await page.waitForTimeout(2000);
  }
  throw new Error(`Timeout 45s: sign-in did not complete, stuck on ${page.url()}`);
}

async function clerkTicketSignIn(page, email, clerkSecret) {
  // Project-documented alternate auth path (see scripts/bootstrap-admin.mjs /
  // gen-signin-links.cjs): mint a single-use Clerk sign-in ticket with the
  // instance secret key and complete sign-in through the real sign-in UI.
  const usersResp = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${clerkSecret}` } }
  );
  if (!usersResp.ok) throw new Error(`Clerk users lookup failed: HTTP ${usersResp.status}`);
  const users = await usersResp.json();
  if (!users.length) throw new Error(`Clerk users lookup: no user for ${email}`);
  const ticketResp = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST',
    headers: { Authorization: `Bearer ${clerkSecret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: users[0].id, expires_in_seconds: 600 }),
  });
  if (!ticketResp.ok) throw new Error(`Clerk ticket creation failed: HTTP ${ticketResp.status}`);
  const tokenBody = await ticketResp.json();
  const ticket = tokenBody.token || tokenBody.ticket;
  if (!ticket) throw new Error('Clerk ticket creation returned no token');
  await page.goto(`${BASE}/sign-in?__clerk_ticket=${ticket}`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForURL((url) => !url.searchParams.has('__clerk_ticket'), { timeout: 45000 });
  await page.waitForTimeout(2000);
}

async function selectOrgIfAsked(page) {
  if (!page.url().includes('/select-agency')) return false;
  // The select-agency URL also hosts a loader that auto-resolves single
  // memberships / db tenants (caregivers, candidates). Wait for either the
  // auto-redirect away, or the actual picker rendering the org entry.
  const deadline = Date.now() + 20000;
  let pickerVisible = false;
  while (Date.now() < deadline) {
    if (!page.url().includes('/select-agency')) return true; // auto-resolved
    const entry = page.getByText(ORG_NAME, { exact: false }).first();
    if (await entry.isVisible().catch(() => false)) {
      pickerVisible = true;
      break;
    }
    await page.waitForTimeout(1000);
  }
  if (!pickerVisible) {
    if (!page.url().includes('/select-agency')) return true;
    throw new Error(`select-agency: "${ORG_NAME}" entry never appeared (auto-resolve stalled)`);
  }
  await page.getByText(ORG_NAME, { exact: false }).first().click();
  await page.waitForURL((url) => !url.pathname.startsWith('/select-agency'), { timeout: 30000 });
  return true;
}

async function waitSettled(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(3500); // let Convex queries render
}

// ---------- Per-role checks (light read actions) ----------

async function checkPlatformAdmin(page) {
  await page.goto(`${BASE}/platform/subscriptions`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await waitSettled(page);
  const url = page.url();
  if (!url.includes('/platform')) throw new Error(`expected /platform area, landed on ${url}`);
  const text = await bodyText(page);
  if (!/subscription|agenc/i.test(text)) throw new Error('/platform/subscriptions shows no subscription/agency content');
}

async function checkAgencyAdmin(page) {
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await waitSettled(page);
  const url = page.url();
  // Golden Ages has the Admin section disabled, so admins land on /hr there.
  if (!/(\/admin|\/hr)/.test(url)) throw new Error(`expected /admin (or /hr for GA), landed on ${url}`);
  const text = await bodyText(page);
  if (!/ready to bill|docs awaiting|compliance rate|active caregivers|application|candidates|employees/i.test(text))
    throw new Error('admin/HR workspace content not rendered');
}

async function checkCoordinator(page) {
  await page.goto(`${BASE}/coordinator/review`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await waitSettled(page);
  const url = page.url();
  // Golden Ages has Review disabled, so coordinators land on /compliance there.
  if (!/coordinator\/review|scheduling|compliance/.test(url)) throw new Error(`expected /coordinator/review (or /compliance for GA), landed on ${url}`);
  const text = await bodyText(page);
  if (!/pending|approved|returned|documentation|review|compliance/i.test(text))
    throw new Error('review/compliance content not rendered');
}

async function checkHr(page) {
  await page.goto(`${BASE}/hr`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await waitSettled(page);
  const url = page.url();
  if (!url.includes('/hr')) throw new Error(`expected /hr, landed on ${url}`);
  const text = await bodyText(page);
  if (!/candidate|hired|pipeline|renewal/i.test(text))
    throw new Error('/hr candidate pipeline KPIs not rendered');
}

async function checkCaregiver(page) {
  // Land wherever the guards take us; report the actual redirect.
  await waitSettled(page);
  let url = page.url();
  if (url.includes('/select-agency') || url.endsWith('/')) {
    await page.goto(`${BASE}/caregiver/today`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await waitSettled(page);
    url = page.url();
  }
  if (!/\/caregiver\/today|\/personnel-record/.test(url))
    throw new Error(`expected /caregiver/today or /personnel-record, landed on ${url}`);
  const text = await bodyText(page);
  if (text.trim().length < 20) throw new Error('caregiver page looks blank');
  return url.includes('/personnel-record') ? 'redirected to /personnel-record (HCS 501 guard)' : 'on /caregiver/today';
}

async function checkCandidate(page) {
  await page.goto(`${BASE}/onboarding`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await waitSettled(page);
  const url = page.url();
  if (!url.includes('/onboarding')) throw new Error(`expected /onboarding, landed on ${url}`);
  const text = await bodyText(page);
  if (!/task|application|checklist|status|offer|onboarding/i.test(text))
    throw new Error('/onboarding checklist/status content not rendered');
}

// Post-cleanup (2026-09-23) the Golden Ages org intentionally only has the
// two real accounts below; the previous Diego/Maria GA test accounts were
// removed from the org. Password sign-in is only exercised for Diego's own
// platform account — run the rest with SMOKE_AUTH=ticket.
const ACCOUNTS = [
  { key: 'platform-admin', email: 'diego.molina.sieiro+admin@gmail.com', check: checkPlatformAdmin },
  { key: 'agency-admin', email: 'admin@goldenagesinhomecare.com', check: checkAgencyAdmin },
  { key: 'coordinator', email: 'supervisor@goldenagesinhomecare.com', check: checkCoordinator },
];

// ---------- One login attempt (with a per-account ~90s budget) ----------

function loadClerkSecret() {
  try {
    const env = fs.readFileSync('.env.prod', 'utf8');
    const m = env.match(/^CLERK_SECRET_KEY=(.+)$/m);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

// authMode: 'password' (real Clerk sign-in UI with email+password) or
// 'ticket' (Clerk sign-in ticket via the project-documented ticket path).
async function attemptAccount(browser, acct, headed, authMode, clerkSecret) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !NOISE.test(m.text())) consoleErrors.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));

  try {
    if (authMode === 'ticket') {
      await clerkTicketSignIn(page, acct.email, clerkSecret);
    } else {
      await clerkSignIn(page, acct.email);
      const blocker = await detectBlocker(page);
      if (blocker === 'mfa') throw new Error('FAILURE: MFA/second-factor prompt appeared');
      if (blocker === 'captcha') throw new Error('BLOCKED-HEADLESS: anti-bot/headless challenge appeared');
      if (blocker === 'email-otp') throw new Error('BLOCKED-HEADLESS: Clerk email-code (new-device) verification required');
    }
    await selectOrgIfAsked(page);
    const note = await acct.check(page);
    if (pageErrors.length) {
      await shot(page, `${acct.key}-pageerror`);
      throw new Error(`page errors: ${pageErrors.join(' | ')}`);
    }
    return { ok: true, note: note || '', consoleErrors, headed };
  } catch (err) {
    const blocker = await detectBlocker(page);
    const reason = blocker === 'rate-limit' ? `blocked-by-rate-limit (${err.message})` : err.message;
    await shot(page, `${acct.key}${headed ? '-headed' : ''}-fail${authMode === 'ticket' ? '-ticket' : ''}`);
    return { ok: false, reason, consoleErrors, headed };
  } finally {
    await context.close().catch(() => {});
  }
}

async function runAccount(acct, authMode, clerkSecret) {
  let browser = await chromium.launch({ headless: true });
  try {
    let result = await attemptAccount(browser, acct, false, authMode, clerkSecret);
    // Headed retry if Clerk blocked headless (password mode only).
    if (authMode === 'password' && !result.ok && /BLOCKED-HEADLESS/i.test(result.reason)) {
      await browser.close();
      browser = await chromium.launch({ headless: false });
      result = await attemptAccount(browser, acct, true, authMode, clerkSecret);
    }
    // One rate-limit retry after 60s backoff.
    if (!result.ok && /rate-limit/i.test(result.reason)) {
      console.log(`  [${acct.key}] rate-limited; backing off 60s before one retry…`);
      await browser.close();
      await sleep(60000);
      browser = await chromium.launch({ headless: true });
      result = await attemptAccount(browser, acct, false, authMode, clerkSecret);
    }
    return result;
  } finally {
    await browser.close().catch(() => {});
  }
}

// ---------- Non-browser checks ----------

async function checkApplyPage(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    const resp = await page.goto(`${BASE}/apply?agency=golden-ages-home-care`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.waitForTimeout(4000);
    const text = await bodyText(page);
    const status = resp ? resp.status() : 0;
    if (status !== 200) throw new Error(`HTTP ${status}`);
    if (!/apply|application|join/i.test(text)) throw new Error('rendered page has no apply/application text');
    return { ok: true, note: `HTTP 200, renders ("${text.trim().split('\n')[0]?.slice(0, 60)}…")` };
  } catch (err) {
    await shot(page, 'apply-page-fail');
    return { ok: false, reason: err.message };
  } finally {
    await context.close().catch(() => {});
  }
}

async function checkConvex() {
  try {
    const resp = await fetch(CONVEX_URL, { signal: AbortSignal.timeout(15000) });
    return { ok: resp.status === 200, note: `HTTP ${resp.status}` };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}

// ---------- Main ----------

async function main() {
  console.log(`PROD smoke test — ${BASE}\n`);
  const results = [];
  const quickBrowser = await chromium.launch({ headless: true });

  const applyRes = await checkApplyPage(quickBrowser);
  results.push({ name: 'GET /apply?agency=golden-ages-home-care', ...applyRes });
  console.log(`[check] /apply page        : ${applyRes.ok ? 'PASS' : 'FAIL'} ${applyRes.note || applyRes.reason}`);

  const convexRes = await checkConvex();
  results.push({ name: 'Convex prod reachability', ...convexRes });
  console.log(`[check] Convex prod        : ${convexRes.ok ? 'PASS' : 'FAIL'} ${convexRes.note || convexRes.reason}\n`);

  const only = process.env.SMOKE_ONLY ? process.env.SMOKE_ONLY.split(',') : null;
  const accounts = only ? ACCOUNTS.filter((a) => only.includes(a.key)) : ACCOUNTS;
  // password = the required report (real Clerk sign-in UI, email+password).
  // ticket = supplementary app-side landing verification via Clerk sign-in
  //          tickets (project-documented path) when password sign-in is gated.
  const phases = process.env.SMOKE_AUTH === 'ticket' ? ['ticket'] : ['password', 'ticket'];

  for (const phase of phases) {
    if (phase === 'ticket' && !loadClerkSecret()) {
      console.log('[phase ] ticket-auth      : skipped (no CLERK_SECRET_KEY in .env.prod)\n');
      continue;
    }
    if (phase === 'ticket') {
      console.log('--- Phase 2: app-side landing check via Clerk sign-in tickets ---');
    } else {
      console.log('--- Phase 1: sign-in via Clerk email+password UI ---');
    }
    for (const acct of accounts) {
      process.stdout.write(`[acct ] ${acct.key.padEnd(15)}: running…`);
      const started = Date.now();
      const res = await runAccount(acct, phase, loadClerkSecret());
      const secs = ((Date.now() - started) / 1000).toFixed(0);
      results.push({ name: `${acct.key} [${phase}] <${acct.email}>`, ...res });
      if (res.ok) {
        console.log(`\r[acct ] ${acct.key.padEnd(15)}: PASS (${secs}s) ${res.note} ${res.headed ? '[headed]' : ''}`);
        if (res.consoleErrors.length) console.log(`         console warnings: ${res.consoleErrors.join(' | ')}`);
      } else {
        console.log(`\r[acct ] ${acct.key.padEnd(15)}: FAIL (${secs}s) ${res.reason}`);
      }
      if (acct !== accounts[accounts.length - 1]) await sleep(12000); // pause between accounts
    }
    console.log('');
  }

  await quickBrowser.close().catch(() => {});

  console.log('\n===== SUMMARY =====');
  let failures = 0;
  for (const r of results) {
    if (!r.ok) failures++;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? (r.note ? `  — ${r.note}` : '') : `  — ${r.reason}`}`);
  }
  console.log(`\n${results.length - failures}/${results.length} passed.`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(2);
});
