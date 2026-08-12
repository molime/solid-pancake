import { Component, useState, type ReactNode } from 'react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Dialog } from '@/shared/ui/Dialog'
import { formatCurrency, formatDateUS } from '@/shared/format'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { usePlatformAdmin } from '../usePlatformAdmin'
import { PlatformGate } from '../components/PlatformGate'
import { PlatformKpiCard } from '../components/PlatformKpiCard'
import { PlatformStatusPill } from '../components/PlatformStatusPill'
import {
  PlatformTable,
  PlatformTableBody,
  PlatformTableCell,
  PlatformTableHead,
  PlatformTableHeader,
  PlatformTableRow,
} from '../components/PlatformTable'

const primaryButtonClass =
  'rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0f10] transition-opacity hover:opacity-90 disabled:opacity-50'

const dangerButtonClass =
  'rounded-lg bg-[rgba(239,68,68,0.16)] px-4 py-2 text-sm font-semibold text-[#ef4444] transition-colors hover:bg-[rgba(239,68,68,0.28)] disabled:opacity-50'

const ghostButtonClass =
  'rounded-lg border border-[#2a3437] px-4 py-2 text-sm font-medium text-[#9aa6a8] transition-colors hover:text-[#f5f7f6]'

const inputClass =
  'w-full rounded-lg border border-[#2a3437] bg-[#1e2629] px-3 py-2 text-[15px] text-[#f5f7f6] outline-none focus:border-[#22c55e]'

const labelClass = 'mb-1.5 block text-sm font-medium text-[#9aa6a8]'

const cardClass = 'rounded-2xl border border-[#2a3437] bg-[#151b1d] p-5'

const MEMBER_ROLES = [
  { value: 'org:admin', label: 'Admin' },
  { value: 'org:coordinator', label: 'Coordinator' },
  { value: 'org:hr', label: 'HR' },
  { value: 'org:caregiver', label: 'Caregiver' },
] as const

function roleLabel(role: string) {
  return MEMBER_ROLES.find((r) => r.value === role)?.label ?? role
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-[#687173]">{label}</span>
      <span className="text-[15px] text-[#f5f7f6]">{value}</span>
    </div>
  )
}

function UsageBar({
  label,
  used,
  max,
}: {
  label: string
  used: number
  max?: number
}) {
  if (max === undefined) {
    return (
      <DetailRow label={label} value={`${used} used · no limit`} />
    )
  }
  const exceeded = used > max
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 100
  return (
    <div className="py-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#687173]">{label}</span>
        <span className="flex items-center gap-2 text-[15px] text-[#f5f7f6]">
          {used} / {max}
          {exceeded && (
            <span className="inline-flex items-center rounded-[15px] bg-[rgba(245,158,11,0.16)] px-2 py-0.5 text-[12px] font-semibold text-[#f59e0b]">
              Over limit
            </span>
          )}
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full rounded-full bg-[#1e2629]">
        <div
          className={`h-2 rounded-full ${exceeded ? 'bg-[#f59e0b]' : 'bg-[#22c55e]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// Catches query errors (e.g. an invalid or deleted tenant id makes
// getTenantDetail throw) and renders a graceful fallback instead of
// crashing the whole page.
class AgencyDetailErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="py-12 text-center">
          <p className="text-lg font-bold text-[#f5f7f6]">Agency not found</p>
          <p className="mt-1 text-sm text-[#9aa6a8]">
            This agency does not exist or the link is invalid.
          </p>
          <Link
            to="/platform/agencies"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#22c55e] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to agencies
          </Link>
        </div>
      )
    }
    return this.props.children
  }
}

export function PlatformAgencyDetailPage() {
  return (
    <PlatformGate>
      <AgencyDetailErrorBoundary>
        <PlatformAgencyDetailContent />
      </AgencyDetailErrorBoundary>
    </PlatformGate>
  )
}

function PlatformAgencyDetailContent() {
  const { tenantId } = useParams()
  const isAdmin = usePlatformAdmin()
  const typedTenantId = tenantId as Id<'tenants'>
  const detail = useQuery(
    api.platform.getTenantDetail,
    isAdmin && tenantId ? { tenantId: typedTenantId } : 'skip',
  )
  const plans = useQuery(api.platform.getPricingPlans, isAdmin ? {} : 'skip')
  const members = useQuery(
    api.platform.listTenantMembers,
    isAdmin && tenantId ? { tenantId: typedTenantId } : 'skip',
  )

  const setTenantSubscription = useMutation(api.platform.setTenantSubscription)
  const suspendTenant = useMutation(api.platform.suspendTenant)
  const reactivateTenant = useMutation(api.platform.reactivateTenant)
  const updateTenantInfo = useMutation(api.platform.updateTenantInfo)
  const setTenantCustomRate = useMutation(api.platform.setTenantCustomRate)
  const setTenantLimits = useMutation(api.platform.setTenantLimits)
  const updateTenantMemberRole = useMutation(api.platform.updateTenantMemberRole)
  const createUserForTenant = useAction(api.platform.createUserForTenant)
  const removeUserFromTenant = useAction(api.platform.removeUserFromTenant)
  const createStripeCustomerForTenant = useAction(
    api.platformStripe.createStripeCustomerForTenant,
  )

  const [planDialogOpen, setPlanDialogOpen] = useState(false)
  const [selectedPlanKey, setSelectedPlanKey] = useState('')
  const [billingEmailsInput, setBillingEmailsInput] = useState('')
  const [confirmAction, setConfirmAction] = useState<
    'suspend' | 'reactivate' | null
  >(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editEin, setEditEin] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [customRateInput, setCustomRateInput] = useState('')
  const [maxSeatsInput, setMaxSeatsInput] = useState('')
  const [maxCandidatesInput, setMaxCandidatesInput] = useState('')
  const [maxShiftsInput, setMaxShiftsInput] = useState('')
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [newUserRole, setNewUserRole] = useState<string>('org:caregiver')
  const [userCreated, setUserCreated] = useState<{
    email: string
    signInUrl: string
  } | null>(null)
  const [removeTarget, setRemoveTarget] = useState<{
    clerkUserId: string
    displayName: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const subscription = detail?.subscription ?? null
  const plan = detail?.plan ?? null
  const usage = detail?.usage
  const customRate = detail?.tenant.customMonthlyRate ?? null
  const limits = detail?.tenant.limits ?? null
  const mrr = customRate ?? plan?.basePrice ?? 0

  // Keep the custom rate and limits inputs in sync with server state by
  // adjusting state during render (avoids setState-in-effect).
  const [syncedCustomRate, setSyncedCustomRate] = useState(customRate)
  if (syncedCustomRate !== customRate) {
    setSyncedCustomRate(customRate)
    setCustomRateInput(customRate !== null ? String(customRate) : '')
  }
  const [syncedLimits, setSyncedLimits] = useState(limits)
  if (syncedLimits !== limits) {
    setSyncedLimits(limits)
    setMaxSeatsInput(limits?.maxSeats !== undefined ? String(limits.maxSeats) : '')
    setMaxCandidatesInput(
      limits?.maxCandidates !== undefined ? String(limits.maxCandidates) : '',
    )
    setMaxShiftsInput(
      limits?.maxShiftsPerMonth !== undefined
        ? String(limits.maxShiftsPerMonth)
        : '',
    )
  }

  const openPlanDialog = () => {
    setSelectedPlanKey(subscription?.planKey ?? plans?.[0]?.key ?? '')
    setBillingEmailsInput(subscription?.billingEmails.join(', ') ?? '')
    setError('')
    setPlanDialogOpen(true)
  }

  const openEditDialog = () => {
    if (!detail) return
    setEditName(detail.tenant.name)
    setEditSlug(detail.tenant.slug)
    setEditEin(detail.tenant.ein ?? '')
    setEditAddress(detail.tenant.address ?? '')
    setError('')
    setEditDialogOpen(true)
  }

  const handleChangePlan = async () => {
    if (!tenantId || !selectedPlanKey) return
    setBusy(true)
    setError('')
    try {
      const now = new Date()
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      const billingEmails = billingEmailsInput
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean)
      await setTenantSubscription({
        tenantId: typedTenantId,
        planKey: selectedPlanKey,
        status: subscription?.status ?? 'active',
        billingEmails,
        currentPeriodStart:
          subscription?.currentPeriodStart ?? now.toISOString(),
        currentPeriodEnd:
          subscription?.currentPeriodEnd ?? periodEnd.toISOString(),
        renewsAt: subscription?.renewsAt,
        trialEndsAt: subscription?.trialEndsAt,
      })
      setPlanDialogOpen(false)
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to change plan.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleConfirmAction = async () => {
    if (!tenantId || !confirmAction) return
    setBusy(true)
    setError('')
    try {
      if (confirmAction === 'suspend') {
        await suspendTenant({ tenantId: typedTenantId })
      } else {
        await reactivateTenant({ tenantId: typedTenantId })
      }
      setConfirmAction(null)
    } catch (err) {
      setError(
        err instanceof Error ? sanitizeConvexError(err.message) : 'Action failed.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleSetupStripeCustomer = async () => {
    if (!tenantId) return
    setBusy(true)
    setError('')
    try {
      await createStripeCustomerForTenant({ tenantId: typedTenantId })
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to set up Stripe customer.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleSaveInfo = async () => {
    if (!tenantId || !editName.trim() || !editSlug.trim()) {
      setError('Name and slug are required.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await updateTenantInfo({
        tenantId: typedTenantId,
        name: editName.trim(),
        slug: editSlug.trim(),
        ein: editEin.trim() || undefined,
        address: editAddress.trim() || undefined,
      })
      setEditDialogOpen(false)
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to update agency info.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleApplyCustomRate = async () => {
    if (!tenantId) return
    const rate = Number(customRateInput)
    if (!customRateInput.trim() || Number.isNaN(rate) || rate < 0) {
      setError('Enter a valid monthly rate (USD).')
      return
    }
    setBusy(true)
    setError('')
    try {
      await setTenantCustomRate({ tenantId: typedTenantId, customRate: rate })
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to set custom rate.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleClearCustomRate = async () => {
    if (!tenantId) return
    setBusy(true)
    setError('')
    try {
      await setTenantCustomRate({ tenantId: typedTenantId, customRate: null })
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to clear custom rate.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleSaveLimits = async () => {
    if (!tenantId) return
    const parse = (value: string) => {
      const num = Number(value)
      return value.trim() && !Number.isNaN(num) && num >= 0 ? num : undefined
    }
    const nextLimits = {
      maxSeats: parse(maxSeatsInput),
      maxCandidates: parse(maxCandidatesInput),
      maxShiftsPerMonth: parse(maxShiftsInput),
    }
    const hasAny = Object.values(nextLimits).some((v) => v !== undefined)
    setBusy(true)
    setError('')
    try {
      await setTenantLimits({
        tenantId: typedTenantId,
        limits: hasAny ? nextLimits : null,
      })
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to save limits.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleAddUser = async () => {
    if (!tenantId || !newUserEmail.trim() || !newUserName.trim()) {
      setError('Email and name are required.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await createUserForTenant({
        tenantId: typedTenantId,
        email: newUserEmail.trim(),
        displayName: newUserName.trim(),
        role: newUserRole as
          | 'org:admin'
          | 'org:coordinator'
          | 'org:hr'
          | 'org:caregiver',
      })
      setUserCreated({
        email: newUserEmail.trim(),
        signInUrl: result.signInUrl,
      })
      setAddUserDialogOpen(false)
      setNewUserEmail('')
      setNewUserName('')
      setNewUserRole('org:caregiver')
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to add user.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleRemoveUser = async () => {
    if (!tenantId || !removeTarget) return
    setBusy(true)
    setError('')
    try {
      await removeUserFromTenant({
        tenantId: typedTenantId,
        clerkUserId: removeTarget.clerkUserId,
      })
      setRemoveTarget(null)
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to remove user.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleChangeRole = async (clerkUserId: string, role: string) => {
    if (!tenantId) return
    setError('')
    try {
      await updateTenantMemberRole({
        tenantId: typedTenantId,
        clerkUserId,
        role: role as 'org:admin' | 'org:coordinator' | 'org:hr' | 'org:caregiver',
      })
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to change role.',
      )
    }
  }

  return (
    <div className="space-y-6">
        <Link
          to="/platform/agencies"
          className="inline-flex items-center gap-2 text-sm text-[#9aa6a8] transition-colors hover:text-[#f5f7f6]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to agencies
        </Link>

        {!detail ? (
          <p className="py-12 text-center text-sm text-[#9aa6a8]">
            Loading agency…
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <h1 className="text-[26px] font-bold text-[#f5f7f6]">
                  {detail.tenant.name}
                </h1>
                <p className="mt-1 text-sm text-[#687173]">
                  {detail.tenant.slug} · {detail.tenant._id}
                </p>
              </div>
              <PlatformStatusPill status={subscription?.status ?? 'none'} />
              <button onClick={openEditDialog} className={ghostButtonClass}>
                Edit Info
              </button>
            </div>

            {error && <p className="text-sm text-[#ef4444]">{error}</p>}

            <div className="flex flex-wrap gap-4">
              <PlatformKpiCard
                label="Active seats"
                value={usage?.seatCount ?? '—'}
                tone="success"
              />
              <PlatformKpiCard
                label="Candidates"
                value={usage?.candidateCount ?? '—'}
                tone="info"
              />
              <PlatformKpiCard
                label="Shifts this month"
                value={usage?.shiftsThisMonth ?? '—'}
              />
              <PlatformKpiCard
                label="MRR"
                value={detail ? formatCurrency(mrr) : '—'}
                hint={customRate !== null ? 'Custom rate' : undefined}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className={cardClass}>
                <h2 className="text-lg font-bold text-[#f5f7f6]">
                  Subscription
                </h2>
                <div className="mt-3 divide-y divide-[#2a3437]">
                  <DetailRow label="Plan" value={plan?.label ?? '—'} />
                  <DetailRow
                    label="Monthly rate"
                    value={plan ? formatCurrency(plan.basePrice) : '—'}
                  />
                  <DetailRow
                    label="Current period start"
                    value={
                      formatDateUS(subscription?.currentPeriodStart) || '—'
                    }
                  />
                  <DetailRow
                    label="Current period end"
                    value={formatDateUS(subscription?.currentPeriodEnd) || '—'}
                  />
                  <DetailRow
                    label="Billing emails"
                    value={
                      subscription && subscription.billingEmails.length > 0
                        ? subscription.billingEmails.join(', ')
                        : '—'
                    }
                  />
                  <DetailRow
                    label="Stripe customer"
                    value={subscription?.stripeCustomerId ?? '—'}
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-3 border-t border-[#2a3437] pt-4">
                  <button onClick={openPlanDialog} className={primaryButtonClass}>
                    Change plan
                  </button>
                  {subscription?.status === 'suspended' ? (
                    <button
                      onClick={() => setConfirmAction('reactivate')}
                      className={primaryButtonClass}
                    >
                      Reactivate tenant
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmAction('suspend')}
                      disabled={!subscription}
                      className={dangerButtonClass}
                    >
                      Suspend tenant
                    </button>
                  )}
                  {subscription && !subscription.stripeCustomerId && (
                    <button
                      onClick={handleSetupStripeCustomer}
                      disabled={busy}
                      className={ghostButtonClass}
                    >
                      {busy ? 'Working…' : 'Setup Stripe Customer'}
                    </button>
                  )}
                </div>
              </div>

              <div className={cardClass}>
                <h2 className="text-lg font-bold text-[#f5f7f6]">
                  Custom Pricing
                </h2>
                <p className="mt-2 text-sm text-[#9aa6a8]">
                  When set, this overrides the plan base price for
                  auto-invoices. Per-seat overage still applies.
                </p>
                <div className="mt-3 divide-y divide-[#2a3437]">
                  <DetailRow
                    label="Plan base price"
                    value={plan ? formatCurrency(plan.basePrice) : '—'}
                  />
                  <DetailRow
                    label="Custom monthly rate"
                    value={
                      customRate !== null ? formatCurrency(customRate) : '—'
                    }
                  />
                </div>
                <div className="mt-4 flex items-end gap-3 border-t border-[#2a3437] pt-4">
                  <div className="flex-1">
                    <label className={labelClass}>Custom rate (USD/month)</label>
                    <input
                      value={customRateInput}
                      onChange={(e) => setCustomRateInput(e.target.value)}
                      placeholder="499.00"
                      inputMode="decimal"
                      className={inputClass}
                    />
                  </div>
                  <button
                    onClick={handleApplyCustomRate}
                    disabled={busy}
                    className={primaryButtonClass}
                  >
                    Apply
                  </button>
                  {customRate !== null && (
                    <button
                      onClick={handleClearCustomRate}
                      disabled={busy}
                      className={ghostButtonClass}
                    >
                      Clear custom rate
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className={cardClass}>
              <h2 className="text-lg font-bold text-[#f5f7f6]">Limits</h2>
              <p className="mt-2 text-sm text-[#9aa6a8]">
                Usage beyond a limit shows a warning here and on invoices.
              </p>
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>Max seats</label>
                    <input
                      value={maxSeatsInput}
                      onChange={(e) => setMaxSeatsInput(e.target.value)}
                      placeholder="No limit"
                      inputMode="numeric"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Max candidates</label>
                    <input
                      value={maxCandidatesInput}
                      onChange={(e) => setMaxCandidatesInput(e.target.value)}
                      placeholder="No limit"
                      inputMode="numeric"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Max shifts / month</label>
                    <input
                      value={maxShiftsInput}
                      onChange={(e) => setMaxShiftsInput(e.target.value)}
                      placeholder="No limit"
                      inputMode="numeric"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <button
                      onClick={handleSaveLimits}
                      disabled={busy}
                      className={primaryButtonClass}
                    >
                      {busy ? 'Saving…' : 'Save Limits'}
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-[#2a3437]">
                  <UsageBar
                    label="Active seats"
                    used={usage?.seatCount ?? 0}
                    max={limits?.maxSeats}
                  />
                  <UsageBar
                    label="Candidates"
                    used={usage?.candidateCount ?? 0}
                    max={limits?.maxCandidates}
                  />
                  <UsageBar
                    label="Shifts this month"
                    used={usage?.shiftsThisMonth ?? 0}
                    max={limits?.maxShiftsPerMonth}
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#f5f7f6]">Users</h2>
                <button
                  onClick={() => {
                    setError('')
                    setUserCreated(null)
                    setAddUserDialogOpen(true)
                  }}
                  className={primaryButtonClass}
                >
                  Add User
                </button>
              </div>
              {userCreated && (
                <div className="mb-3 rounded-2xl border border-[#2a3437] bg-[#151b1d] p-4 text-sm text-[#f5f7f6]">
                  <p>
                    User created. An invite email has been sent to{' '}
                    {userCreated.email}.
                  </p>
                  <p className="mt-1 break-all text-[#9aa6a8]">
                    Sign-in link: {userCreated.signInUrl}
                  </p>
                </div>
              )}
              {!members ? (
                <p className="rounded-2xl border border-[#2a3437] bg-[#151b1d] py-12 text-center text-sm text-[#9aa6a8]">
                  Loading users…
                </p>
              ) : members.length === 0 ? (
                <p className="rounded-2xl border border-[#2a3437] bg-[#151b1d] py-12 text-center text-sm text-[#9aa6a8]">
                  No users yet.
                </p>
              ) : (
                <PlatformTable>
                  <PlatformTableHead>
                    <PlatformTableHeader>Name</PlatformTableHeader>
                    <PlatformTableHeader>Email</PlatformTableHeader>
                    <PlatformTableHeader>Role</PlatformTableHeader>
                    <PlatformTableHeader />
                  </PlatformTableHead>
                  <PlatformTableBody>
                    {members.map((member) => (
                      <PlatformTableRow key={member.clerkUserId}>
                        <PlatformTableCell className="font-medium">
                          {member.displayName}
                        </PlatformTableCell>
                        <PlatformTableCell className="text-[#9aa6a8]">
                          {member.email}
                        </PlatformTableCell>
                        <PlatformTableCell>
                          <span className="mr-3 inline-flex items-center rounded-[15px] bg-[rgba(59,130,246,0.16)] px-3 py-1 text-[13px] font-semibold text-[#3b82f6]">
                            {roleLabel(member.role)}
                          </span>
                          <select
                            value={member.role}
                            onChange={(e) =>
                              handleChangeRole(member.clerkUserId, e.target.value)
                            }
                            className="rounded-lg border border-[#2a3437] bg-[#1e2629] px-2 py-1 text-sm text-[#f5f7f6] outline-none focus:border-[#22c55e]"
                          >
                            {MEMBER_ROLES.map((role) => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        </PlatformTableCell>
                        <PlatformTableCell>
                          <button
                            onClick={() =>
                              setRemoveTarget({
                                clerkUserId: member.clerkUserId,
                                displayName: member.displayName,
                              })
                            }
                            className="text-sm font-medium text-[#ef4444] hover:underline"
                          >
                            Remove
                          </button>
                        </PlatformTableCell>
                      </PlatformTableRow>
                    ))}
                  </PlatformTableBody>
                </PlatformTable>
              )}
            </div>

            <div>
              <h2 className="mb-3 text-lg font-bold text-[#f5f7f6]">
                Recent invoices
              </h2>
              {detail.invoices.length === 0 ? (
                <p className="rounded-2xl border border-[#2a3437] bg-[#151b1d] py-12 text-center text-sm text-[#9aa6a8]">
                  No invoices yet.
                </p>
              ) : (
                <PlatformTable>
                  <PlatformTableHead>
                    <PlatformTableHeader>Invoice #</PlatformTableHeader>
                    <PlatformTableHeader>Period</PlatformTableHeader>
                    <PlatformTableHeader>Total</PlatformTableHeader>
                    <PlatformTableHeader>Status</PlatformTableHeader>
                    <PlatformTableHeader />
                  </PlatformTableHead>
                  <PlatformTableBody>
                    {detail.invoices.slice(0, 5).map((invoice) => (
                      <PlatformTableRow key={invoice._id}>
                        <PlatformTableCell className="font-medium">
                          {invoice.invoiceNumber}
                        </PlatformTableCell>
                        <PlatformTableCell className="text-[#9aa6a8]">
                          {formatDateUS(invoice.periodStart)} –{' '}
                          {formatDateUS(invoice.periodEnd)}
                        </PlatformTableCell>
                        <PlatformTableCell>
                          {formatCurrency(invoice.total)}
                        </PlatformTableCell>
                        <PlatformTableCell>
                          <PlatformStatusPill status={invoice.status} />
                        </PlatformTableCell>
                        <PlatformTableCell>
                          <Link
                            to={`/platform/billing/${invoice._id}`}
                            className="text-sm font-medium text-[#22c55e] hover:underline"
                          >
                            View
                          </Link>
                        </PlatformTableCell>
                      </PlatformTableRow>
                    ))}
                  </PlatformTableBody>
                </PlatformTable>
              )}
            </div>
          </>
        )}

        <Dialog
          open={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          className="border-[#2a3437] bg-[#151b1d]"
        >
          <div className="border-b border-[#2a3437] px-6 py-5">
            <h3 className="text-lg font-bold text-[#f5f7f6]">
              Edit agency info
            </h3>
          </div>
          <div className="space-y-4 p-6">
            <div>
              <label className={labelClass}>Agency name</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Slug</label>
              <input
                value={editSlug}
                onChange={(e) => setEditSlug(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>EIN (optional)</label>
              <input
                value={editEin}
                onChange={(e) => setEditEin(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Address (optional)</label>
              <input
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                className={inputClass}
              />
            </div>
            {error && <p className="text-sm text-[#ef4444]">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-[#2a3437] px-6 py-5">
            <button
              onClick={() => setEditDialogOpen(false)}
              className={ghostButtonClass}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveInfo}
              disabled={busy || !editName.trim() || !editSlug.trim()}
              className={primaryButtonClass}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Dialog>

        <Dialog
          open={planDialogOpen}
          onClose={() => setPlanDialogOpen(false)}
          className="border-[#2a3437] bg-[#151b1d]"
        >
          <div className="border-b border-[#2a3437] px-6 py-5">
            <h3 className="text-lg font-bold text-[#f5f7f6]">Change plan</h3>
          </div>
          <div className="space-y-3 p-6">
            {(plans ?? [])
              .filter((p) => p.active)
              .map((p) => (
                <label
                  key={p.key}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-[#2a3437] bg-[#1e2629] px-4 py-3"
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="plan"
                      checked={selectedPlanKey === p.key}
                      onChange={() => setSelectedPlanKey(p.key)}
                      className="accent-[#22c55e]"
                    />
                    <span className="text-[15px] font-medium text-[#f5f7f6]">
                      {p.label}
                    </span>
                  </span>
                  <span className="text-sm text-[#9aa6a8]">
                    {formatCurrency(p.basePrice)}/mo · {p.includedSeats} seats
                  </span>
                </label>
              ))}
            {error && <p className="text-sm text-[#ef4444]">{error}</p>}
          </div>
          <div className="border-t border-[#2a3437] px-6 py-5">
            <label className={labelClass}>
              Billing emails (comma-separated)
            </label>
            <input
              value={billingEmailsInput}
              onChange={(e) => setBillingEmailsInput(e.target.value)}
              placeholder="billing@agency.com, owner@agency.com"
              className={inputClass}
            />
            <p className="mt-1.5 text-sm text-[#687173]">
              Used for invoice emails and Stripe customer setup.
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t border-[#2a3437] px-6 py-5">
            <button
              onClick={() => setPlanDialogOpen(false)}
              className={ghostButtonClass}
            >
              Cancel
            </button>
            <button
              onClick={handleChangePlan}
              disabled={busy || !selectedPlanKey}
              className={primaryButtonClass}
            >
              {busy ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </Dialog>

        <Dialog
          open={confirmAction !== null}
          onClose={() => setConfirmAction(null)}
          className="border-[#2a3437] bg-[#151b1d]"
        >
          <div className="border-b border-[#2a3437] px-6 py-5">
            <h3 className="text-lg font-bold text-[#f5f7f6]">
              {confirmAction === 'suspend'
                ? 'Suspend tenant'
                : 'Reactivate tenant'}
            </h3>
          </div>
          <div className="p-6">
            <p className="text-[15px] text-[#9aa6a8]">
              {confirmAction === 'suspend'
                ? `Suspend ${detail?.tenant.name ?? 'this tenant'}? Their subscription status will be set to suspended.`
                : `Reactivate ${detail?.tenant.name ?? 'this tenant'}? Their subscription status will be set to active.`}
            </p>
            {error && <p className="mt-3 text-sm text-[#ef4444]">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-[#2a3437] px-6 py-5">
            <button
              onClick={() => setConfirmAction(null)}
              className={ghostButtonClass}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmAction}
              disabled={busy}
              className={
                confirmAction === 'suspend'
                  ? dangerButtonClass
                  : primaryButtonClass
              }
            >
              {busy ? 'Working…' : 'Confirm'}
            </button>
          </div>
        </Dialog>

        <Dialog
          open={addUserDialogOpen}
          onClose={() => setAddUserDialogOpen(false)}
          className="border-[#2a3437] bg-[#151b1d]"
        >
          <div className="border-b border-[#2a3437] px-6 py-5">
            <h3 className="text-lg font-bold text-[#f5f7f6]">Add user</h3>
          </div>
          <div className="space-y-4 p-6">
            <div>
              <label className={labelClass}>Email</label>
              <input
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="user@agency.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Name</label>
              <input
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Jane Doe"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Role</label>
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value)}
                className={inputClass}
              >
                {MEMBER_ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
            {error && <p className="text-sm text-[#ef4444]">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-[#2a3437] px-6 py-5">
            <button
              onClick={() => setAddUserDialogOpen(false)}
              className={ghostButtonClass}
            >
              Cancel
            </button>
            <button
              onClick={handleAddUser}
              disabled={busy || !newUserEmail.trim() || !newUserName.trim()}
              className={primaryButtonClass}
            >
              {busy ? 'Adding…' : 'Add User'}
            </button>
          </div>
        </Dialog>

        <Dialog
          open={removeTarget !== null}
          onClose={() => setRemoveTarget(null)}
          className="border-[#2a3437] bg-[#151b1d]"
        >
          <div className="border-b border-[#2a3437] px-6 py-5">
            <h3 className="text-lg font-bold text-[#f5f7f6]">Remove user</h3>
          </div>
          <div className="p-6">
            <p className="text-[15px] text-[#9aa6a8]">
              Remove {removeTarget?.displayName ?? 'this user'} from{' '}
              {detail?.tenant.name ?? 'this agency'}? Their access will be
              revoked immediately.
            </p>
            {error && <p className="mt-3 text-sm text-[#ef4444]">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-[#2a3437] px-6 py-5">
            <button
              onClick={() => setRemoveTarget(null)}
              className={ghostButtonClass}
            >
              Cancel
            </button>
            <button
              onClick={handleRemoveUser}
              disabled={busy}
              className={dangerButtonClass}
            >
              {busy ? 'Working…' : 'Remove'}
            </button>
          </div>
        </Dialog>
    </div>
  )
}
