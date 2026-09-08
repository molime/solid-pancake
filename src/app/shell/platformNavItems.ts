import {
  CreditCard,
  FileText,
  HeartPulse,
  Building2,
  BarChart3,
  LifeBuoy,
  ScrollText,
} from 'lucide-react'

export const NAV_ITEMS = [
  { to: '/platform/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/platform/agencies', label: 'Agencies', icon: Building2 },
  { to: '/platform/health', label: 'Tenant Health', icon: HeartPulse },
  { to: '/platform/reports', label: 'Reports', icon: BarChart3 },
  { to: '/platform/support', label: 'Support', icon: LifeBuoy },
  { to: '/platform/audit', label: 'Audit Log', icon: ScrollText },
  { to: '/platform/billing', label: 'Billing', icon: FileText },
]
