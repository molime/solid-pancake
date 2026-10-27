/**
 * Canonical staff policies (compliance mini-phase, Stage 4).
 *
 * Single source of truth for staff-facing legal language: privacy,
 * HIPAA confidentiality, and acceptable use. Policy TEXT lives here as
 * versioned code constants (not in the database) so every tenant always
 * acknowledges the exact same wording and a version bump in code
 * re-surfaces the acknowledgment for every user. `src/shared/legal/staffPolicies.ts`
 * re-exports these for the frontend.
 *
 * To release a new version of a policy: bump its `version` number and set
 * `effectiveDate`. Users' previous acknowledgments remain recorded; the
 * pending-acknowledgment query compares against the CURRENT version, so the
 * policy re-surfaces until it is acknowledged again.
 */

export interface StaffPolicySection {
  heading: string
  body: string
}

export interface StaffPolicy {
  key: string
  version: number
  title: string
  effectiveDate: string
  sections: StaffPolicySection[]
}

export const STAFF_POLICIES: StaffPolicy[] = [
  {
    key: 'privacy_policy',
    version: 1,
    title: 'Privacy Policy for ATRIA Staff',
    effectiveDate: '2026-10-20',
    sections: [
      {
        heading: '1. Who we are and what this covers',
        body: 'ATRIA is the software platform your agency uses to schedule shifts, manage clients and caregivers, track compliance, and bill for services. This policy explains what personal data ATRIA collects about staff members (you), why, and who can see it. It applies to everyone who uses ATRIA with a staff role (admin, HR, coordinator, or caregiver).',
      },
      {
        heading: '2. What we collect about you',
        body: 'Account details from our login provider (Clerk): your name, email address, and role in your agency. Work records you generate in ATRIA: assigned shifts, clock-in/out times and locations, progress notes, training completions, credentials, and uploaded documents such as certifications and signed forms. If you applied through ATRIA, your application information (including your Social Security number, used only for legally required employment forms) is also stored.',
      },
      {
        heading: '3. How your data is used',
        body: 'Your data is used only to operate the service for your agency: scheduling, payroll and billing records, compliance tracking, and required reporting. ATRIA does not sell personal data, does not use it for advertising, and does not use it to train AI models. Access inside your agency follows your role: coordinators and admins see operational records; caregivers see their own shifts, clients, and notes.',
      },
      {
        heading: '4. Where your data is stored',
        body: 'Data is stored in the Convex managed database and file storage, hosted in the cloud region configured for the ATRIA deployment, and served through Vercel. Login sessions and passwords are handled by Clerk — ATRIA never sees or stores your password. Data is transmitted over encrypted (TLS) connections.',
      },
      {
        heading: '5. Who processes data on our behalf',
        body: 'ATRIA shares limited data with a small set of service providers (subprocessors): Clerk (authentication), Convex (database and file storage), Vercel (hosting), Resend (transactional email), Twilio (transactional SMS), Stripe (platform subscription billing — never client care data), and, only if your agency enables it, ADP Workforce Now (payroll export identifiers). YouTube and Unsplash are used only for embedded training media and receive no personal data.',
      },
      {
        heading: '6. Your rights',
        body: 'You may ask your agency administrator for a copy of the data ATRIA holds about you, to correct inaccurate information, or to delete data that is no longer needed. Data retention follows legal requirements: some records (for example, payroll-related or state-mandated forms) must be kept for several years even after you leave. Deletions that happen automatically or on request are recorded in the platform deletion log.',
      },
      {
        heading: '7. Questions',
        body: 'Contact your agency administrator first for anything about your own data. Platform-level privacy questions can be directed to ATRIA support through your administrator.',
      },
    ],
  },
  {
    key: 'confidentiality_hipaa',
    version: 1,
    title: 'Confidentiality & HIPAA Policy for Caregiving Staff',
    effectiveDate: '2026-10-20',
    sections: [
      {
        heading: '1. Why this matters',
        body: 'As caregiving staff you routinely see protected health information (PHI): client names, diagnoses, medications, care plans, progress notes, and schedules. Federal law (HIPAA) and your employment terms require you to keep this information confidential. This policy tells you the rules in plain language.',
      },
      {
        heading: '2. Minimum necessary',
        body: 'Access and use only the client information you actually need to do your job. Do not open charts, notes, or schedules for clients you are not assigned to, even if the system would let you. Curiosity access is a violation.',
      },
      {
        heading: '3. Never share outside the care team',
        body: 'Do not discuss clients with family, friends, other clients, or on social media — even without names, details can identify a person. Do not photograph or record a client without documented consent. Share information only with members of the client’s care team who need it for care, and route requests from anyone else (including family members) through your coordinator or supervisor.',
      },
      {
        heading: '4. Protect access and documents',
        body: 'Log out when you step away from a shared or unattended device. Do not print, download, screenshot, or copy client records except as your job requires through ATRIA. Dispose of any printed material securely (cross-cut shred) — never in regular trash or recycling.',
      },
      {
        heading: '5. Duty to report',
        body: 'Report any suspected breach immediately — for example, a lost device, a message sent to the wrong person, a chart you accessed by mistake, or suspected improper access by a coworker — to your supervisor or agency administrator, within 24 hours at the latest. Honest, prompt self-reporting is treated far more favorably than concealment. ATRIA logs access to sensitive records and these logs are reviewed.',
      },
      {
        heading: '6. Your acknowledgment',
        body: 'By acknowledging this policy you confirm that you have read it, that you understand the minimum-necessary and no-sharing rules, and that you accept your duty to report suspected breaches. Violations can result in disciplinary action up to termination, and serious or intentional misuse of PHI can carry legal penalties under HIPAA.',
      },
    ],
  },
  {
    key: 'acceptable_use',
    version: 1,
    title: 'Acceptable Use & Account Security Policy',
    effectiveDate: '2026-10-20',
    sections: [
      {
        heading: '1. Your account is yours alone',
        body: 'Your ATRIA login is personal. Never share your password, never log in for a coworker, and never let anyone else use a session you are signed into. Every action taken under your account is recorded in the audit log with your identity, so you are responsible for what happens under your login.',
      },
      {
        heading: '2. Protect your sign-in',
        body: 'Choose a strong, unique password for ATRIA that you do not use anywhere else. If your agency or ATRIA enables multi-factor authentication (MFA), you must complete the MFA setup and keep your second factor secure. Report any sign-in you do not recognize, or any suspected account takeover, to your administrator immediately.',
      },
      {
        heading: '3. Use ATRIA for its intended purpose',
        body: 'Use the platform only for legitimate work for your agency. Do not browse records you have no work reason to view, do not alter, delete, or falsify records (including clock-in/out times and progress notes), and do not upload unlawful, offensive, or malicious content.',
      },
      {
        heading: '4. Exports and downloads',
        body: 'Downloading or exporting client or staff data (CSV reports, documents, notes) is allowed only when your role requires it and only for agency business. Do not upload exports to personal email, personal cloud storage, or third-party tools. If your agency permits ADP payroll export, use only the provided integration. Misuse of exported data is treated as a confidentiality breach.',
      },
      {
        heading: '5. Devices and sessions',
        body: 'Keep your devices updated and locked when unattended. Use only devices you are authorized to use for work. Sign out of ATRIA on shared or public computers, and report lost or stolen devices that were signed in so access can be revoked.',
      },
      {
        heading: '6. Enforcement',
        body: 'ATRIA records account activity (sign-ins, role changes, downloads, exports, sensitive-record access) in per-agency audit logs that your agency’s administrators can review. Violations of this policy can result in suspension of access and disciplinary action up to termination, and unlawful activity may be reported to authorities.',
      },
    ],
  },
  {
    // Fourth staff policy (added 2026-10-27): closes HIPAA Security Awareness
    // (45 CFR 164.308(a)(5)) as an operating program. Delivery mechanism is
    // the same blocking acknowledgment modal as the other staff policies;
    // reviewed annually alongside the policy re-acknowledgment cycle.
    key: 'security_awareness',
    version: 1,
    title: 'Security Awareness Policy',
    effectiveDate: '2026-10-27',
    sections: [
      {
        heading: '1. Why awareness matters',
        body: 'Most security incidents in healthcare start with a person, not a machine: a convincing fake email, a shared password, an unattended screen. This policy is your short, practical guide to recognizing and reporting security threats. It is part of your onboarding and is re-acknowledged annually.',
      },
      {
        heading: '2. Phishing and suspicious messages',
        body: 'Be skeptical of any message asking for passwords, verification codes, payment changes, or urgent gift cards — even if it appears to come from a manager, ATRIA, or a vendor. Check the sender address carefully. ATRIA will never ask for your password by email or text. Do not open unexpected attachments or links; report the message instead.',
      },
      {
        heading: '3. Passwords and sign-in codes',
        body: 'Use a strong, unique password for ATRIA and never reuse it elsewhere. Never share a password or a one-time sign-in code with anyone, including someone claiming to be IT or ATRIA support. If your agency enables MFA, complete the setup and keep your authenticator device secure.',
      },
      {
        heading: '4. Devices and physical security',
        body: 'Lock your screen whenever you step away. Do not view client information where others can see your screen (public transit, waiting rooms). Keep your phone and computer updated. Never install software or browser extensions you were not asked to install for work.',
      },
      {
        heading: '5. What to report, and how fast',
        body: 'Report within 24 hours to your supervisor or agency administrator: a lost or stolen device, a suspicious email or call, an unfamiliar sign-in or notification, a file sent to the wrong person, or a colleague accessing records they should not. Fast reporting is what turns an incident into a non-event; hiding one turns it into a breach.',
      },
      {
        heading: '6. Your acknowledgment',
        body: 'By acknowledging this policy you confirm that you understand how to recognize phishing, protect your sign-in and devices, and report suspected security issues within 24 hours. This acknowledgment is recorded and refreshed annually.',
      },
    ],
  },
]

/** The staff policy keys, for validation and iteration. */
export const STAFF_POLICY_KEYS = STAFF_POLICIES.map((p) => p.key)

/** key -> current version, used by the backend to validate acknowledgments. */
export const STAFF_POLICY_VERSIONS: Record<string, number> = Object.fromEntries(
  STAFF_POLICIES.map((p) => [p.key, p.version]),
)
