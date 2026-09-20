import { readFileSync } from 'node:fs';

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue;
  const idx = line.indexOf('=');
  if (idx <= 0) continue;
  env[line.slice(0, idx)] = line.slice(idx + 1);
}

const secretKey = env.CLERK_SECRET_KEY;

async function clerkGet(path) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!res.ok) throw new Error(`GET ${path} ${res.status} ${await res.text()}`);
  return res.json();
}

async function disableUserMfa(userId) {
  const res = await fetch(`https://api.clerk.com/v1/users/${userId}/mfa`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`DELETE /users/${userId}/mfa ${res.status} ${await res.text()}`);
  }
}

async function disableMfaForAllUsers() {
  let offset = 0;
  let checked = 0;
  let removed = 0;
  while (true) {
    const users = await clerkGet(`/users?limit=100&offset=${offset}`);
    if (!Array.isArray(users) || users.length === 0) break;
    for (const user of users) {
      checked++;
      try {
        await disableUserMfa(user.id);
        removed++;
      } catch (err) {
        if (err.message?.includes('no MFA')) {
          // already disabled
        } else {
          console.warn('WARN:', err.message);
        }
      }
    }
    offset += users.length;
  }
  console.log(`Checked ${checked} users, removed/disabled MFA for ${removed} users.`);
}

disableMfaForAllUsers().catch((err) => {
  console.error(err);
  process.exit(1);
});
