// Static FAQ entries for the agency support page. Kept as a plain data
// module so a future FAQ chatbot can consume the same entries (Phase 3,
// Item 8 groundwork — no vendor integration yet).

export interface FaqEntry {
  question: string
  answer: string
  category?: string
}

export const faqEntries: FaqEntry[] = [
  {
    question: 'How do I invite a new coordinator or caregiver?',
    answer:
      'Go to Team and use the invite action with the person\'s email address. They receive an email with a sign-in link. Caregivers complete onboarding (profile, documents, training) before they appear in scheduling.',
    category: 'Account',
  },
  {
    question: 'How is my monthly subscription calculated?',
    answer:
      'Your invoice is based on the pricing plan for your agency — a flat monthly fee, per-item usage, or seat tiers depending on your plan. You can see every invoice under Billing.',
    category: 'Billing',
  },
  {
    question: 'Where do I see and pay invoices?',
    answer:
      'Open Billing in the sidebar. Each invoice lists its line items, period, and status. If a payment method is on file, invoices are charged automatically; otherwise you receive an invoice email with a payment link.',
    category: 'Billing',
  },
  {
    question: 'What happens if a payment fails?',
    answer:
      'The agency owner is notified by email and the subscription enters a past-due state with a 7-day grace period while the payment is retried. Updating the payment method restores the account automatically once a payment succeeds.',
    category: 'Billing',
  },
  {
    question: 'How do I set up the scheduling geofence?',
    answer:
      'Go to Settings → Geofence and set your branch location and radius. Caregivers can only clock in within the configured radius of a shift\'s location.',
    category: 'Technical',
  },
  {
    question: 'Why didn\'t a shift sync to my payroll integration?',
    answer:
      'Check Compliance and the audit trail for sync errors. Most failures are caused by a missing employee ID mapping in the integration. Fix the mapping and the punch will retry on the next sync.',
    category: 'Technical',
  },
  {
    question: 'How do I track candidate applications?',
    answer:
      'HR Home → Candidates shows the recruiting pipeline. Each candidate moves from application through document collection, training, and offer acceptance before conversion to an employee.',
    category: 'Account',
  },
  {
    question: 'Can I export my agency\'s data?',
    answer:
      'Yes. Reporting and the audit trail support CSV export. For a full data export or account closure, open a support ticket and the platform team will help.',
    category: 'Account',
  },
]
