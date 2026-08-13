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

type PlanModel = 'flat' | 'per_item' | 'tiered'

interface TierRow {
  upTo: string
  monthlyPrice: string
}

function parseOptionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined
  const num = Number(value)
  return Number.isNaN(num) || num < 0 ? undefined : num
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
  const offboardTenant = useMutation(api.platform.offboardTenant)
  const upsertPricingPlan = useMutation(api.platform.upsertPricingPlan)
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
  const [offboardDialogOpen, setOffboardDialogOpen] = useState(false)
  const [offboardReason, setOffboardReason] = useState('')
  const [planPricingDialogOpen, setPlanPricingDialogOpen] = useState(false)
  const [planModelInput, setPlanModelInput] = useState<PlanModel>('flat')
  const [perCandidateRate, setPerCandidateRate] = useState('')
  const [perShiftRate, setPerShiftRate] = useState('')
  const [perApplicationRate, setPerApplicationRate] = useState('')
  const [tierRows, setTierRows] = useState<TierRow[]>([])
  const [alertThresholdInput, setAlertThresholdInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const subscription = detail?.subscription ?? null
  const plan = detail?.plan ?? null
  const usage = detail?.usage
  const customRate = detail?.tenant.customMonthlyRate ?? null
  const limits = detail?.tenant.limits ?? null
  const mrr = customRate ?? plan?.basePrice ?? 0
  // Read-only owner contact: the first org:admin member is the agency owner
  // created by createTenant. Platform user management is disabled (Item 4).
  const owner = members?.find((member) => member.role === 'org:admin') ?? null

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

  const handleOffboard = async () => {
    if (!tenantId) return
    setBusy(true)
    setError('')
    try {
      await offboardTenant({
        tenantId: typedTenantId,
        reason: offboardReason.trim() || undefined,
      })
      setOffboardDialogOpen(false)
      setOffboardReason('')
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to offboard agency.',
      )
    } finally {
      setBusy(false)
    }
  }

  const openPlanPricingDialog = () => {
    if (!plan) return
    setPlanModelInput(plan.model ?? 'flat')
    setPerCandidateRate(
      plan.perItemRates?.perCandidate !== undefined
        ? String(plan.perItemRates.perCandidate)
        : '',
    )
    setPerShiftRate(
      plan.perItemRates?.perShift !== undefined
        ? String(plan.perItemRates.perShift)
        : '',
    )
    setPerApplicationRate(
      plan.perItemRates?.perApplication !== undefined
        ? String(plan.perItemRates.perApplication)
        : '',
    )
    setTierRows(
      plan.tiers && plan.tiers.length > 0
        ? plan.tiers.map((tier) => ({
            upTo: String(tier.upTo),
            monthlyPrice: String(tier.monthlyPrice),
          }))
        : [{ upTo: '', monthlyPrice: '' }],
    )
    setAlertThresholdInput(
      plan.alertThreshold !== undefined ? String(plan.alertThreshold) : '',
    )
    setError('')
    setPlanPricingDialogOpen(true)
  }

  const handleSavePlanPricing = async () => {
    if (!plan) return
    const alertThreshold = parseOptionalNumber(alertThresholdInput)
    if (alertThresholdInput.trim() && alertThreshold === undefined) {
      setError('Enter a valid alert threshold (seats).')
      return
    }
    const tiers = tierRows
      .map((row) => ({
        upTo: parseOptionalNumber(row.upTo),
        monthlyPrice: parseOptionalNumber(row.monthlyPrice),
      }))
      .filter(
        (row): row is { upTo: number; monthlyPrice: number } =>
          row.upTo !== undefined && row.monthlyPrice !== undefined,
      )
    if (planModelInput === 'tiered' && tiers.length === 0) {
      setError('Add at least one tier (seats up to + monthly price).')
      return
    }
    setBusy(true)
    setError('')
    try {
      const perItemRates = {
        perCandidate: parseOptionalNumber(perCandidateRate),
        perShift: parseOptionalNumber(perShiftRate),
        perApplication: parseOptionalNumber(perApplicationRate),
      }
      await upsertPricingPlan({
        key: plan.key,
        label: plan.label,
        basePrice: plan.basePrice,
        includedSeats: plan.includedSeats,
        perSeatPrice: plan.perSeatPrice,
        active: plan.active,
        model: planModelInput,
        ...(planModelInput === 'per_item' &&
        Object.values(perItemRates).some((rate) => rate !== undefined)
          ? { perItemRates }
          : {}),
        ...(planModelInput === 'tiered' ? { tiers } : {}),
        ...(alertThreshold !== undefined ? { alertThreshold } : {}),
      })
      setPlanPricingDialogOpen(false)
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to save plan pricing.',
      )
    } finally {
      setBusy(false)
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
              {detail.tenant.churnedAt !== undefined && (
                <PlatformStatusPill status="churned" />
              )}
              <button onClick={openEditDialog} className={ghostButtonClass}>
                Edit Info
              </button>
              {detail.tenant.churnedAt === undefined && (
                <button
                  onClick={() => {
                    setOffboardReason('')
                    setError('')
                    setOffboardDialogOpen(true)
                  }}
                  className={dangerButtonClass}
                >
                  Offboard agency
                </button>
              )}
            </div>

            {detail.tenant.churnedAt !== undefined && (
              <div className="rounded-2xl border border-[#2a3437] bg-[#151b1d] p-4 text-sm text-[#9aa6a8]">
                <span className="font-semibold text-[#f5f7f6]">
                  Churned {formatDateUS(new Date(detail.tenant.churnedAt))}.
                </span>{' '}
                {detail.tenant.churnReason
                  ? `Reason: ${detail.tenant.churnReason}`
                  : 'No churn reason recorded.'}
              </div>
            )}

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
                    label="Pricing model"
                    value={
                      plan
                        ? plan.model === 'per_item'
                          ? 'Per item'
                          : plan.model === 'tiered'
                            ? 'Tiered'
                            : 'Flat'
                        : '—'
                    }
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
                  <button
                    onClick={openPlanPricingDialog}
                    disabled={!plan}
                    className={ghostButtonClass}
                  >
                    Edit plan pricing
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

            <div className={cardClass}>
              <h2 className="text-lg font-bold text-[#f5f7f6]">
                Agency Owner
              </h2>
              <p className="mt-2 text-sm text-[#9aa6a8]">
                Read-only. User management is handled by the agency itself.
              </p>
              {!members ? (
                <p className="mt-3 text-sm text-[#9aa6a8]">Loading owner…</p>
              ) : !owner ? (
                <p className="mt-3 text-sm text-[#9aa6a8]">
                  No owner record found.
                </p>
              ) : (
                <div className="mt-3 divide-y divide-[#2a3437]">
                  <DetailRow label="Name" value={owner.displayName} />
                  <DetailRow label="Email" value={owner.email} />
                  <DetailRow label="Role" value={roleLabel(owner.role)} />
                </div>
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
          open={offboardDialogOpen}
          onClose={() => setOffboardDialogOpen(false)}
          className="border-[#2a3437] bg-[#151b1d]"
        >
          <div className="border-b border-[#2a3437] px-6 py-5">
            <h3 className="text-lg font-bold text-[#f5f7f6]">
              Offboard agency
            </h3>
          </div>
          <div className="space-y-4 p-6">
            <p className="text-[15px] text-[#9aa6a8]">
              Offboard {detail?.tenant.name ?? 'this agency'}? The agency will
              be marked as churned and its subscription canceled. The record
              is kept for reporting.
            </p>
            <div>
              <label className={labelClass}>Churn reason (optional)</label>
              <textarea
                value={offboardReason}
                onChange={(e) => setOffboardReason(e.target.value)}
                rows={3}
                placeholder="Why is this agency leaving?"
                className={inputClass}
              />
            </div>
            {error && <p className="text-sm text-[#ef4444]">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-[#2a3437] px-6 py-5">
            <button
              onClick={() => setOffboardDialogOpen(false)}
              className={ghostButtonClass}
            >
              Cancel
            </button>
            <button
              onClick={handleOffboard}
              disabled={busy}
              className={dangerButtonClass}
            >
              {busy ? 'Working…' : 'Offboard agency'}
            </button>
          </div>
        </Dialog>

        <Dialog
          open={planPricingDialogOpen}
          onClose={() => setPlanPricingDialogOpen(false)}
          className="border-[#2a3437] bg-[#151b1d]"
        >
          <div className="border-b border-[#2a3437] px-6 py-5">
            <h3 className="text-lg font-bold text-[#f5f7f6]">
              Edit plan pricing — {plan?.label ?? ''}
            </h3>
          </div>
          <div className="space-y-4 overflow-y-auto p-6">
            <p className="text-sm text-[#9aa6a8]">
              Changes apply to the plan itself and affect every agency on it.
            </p>
            <div>
              <label className={labelClass}>Pricing model</label>
              <select
                value={planModelInput}
                onChange={(e) => setPlanModelInput(e.target.value as PlanModel)}
                className={inputClass}
              >
                <option value="flat">Flat monthly fee</option>
                <option value="per_item">Per item (usage-based)</option>
                <option value="tiered">Tiered by seats</option>
              </select>
            </div>

            {planModelInput === 'per_item' && (
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className={labelClass}>Per candidate (USD)</label>
                  <input
                    value={perCandidateRate}
                    onChange={(e) => setPerCandidateRate(e.target.value)}
                    placeholder="Optional"
                    inputMode="decimal"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Per shift (USD)</label>
                  <input
                    value={perShiftRate}
                    onChange={(e) => setPerShiftRate(e.target.value)}
                    placeholder="Optional"
                    inputMode="decimal"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Per application (USD)</label>
                  <input
                    value={perApplicationRate}
                    onChange={(e) => setPerApplicationRate(e.target.value)}
                    placeholder="Optional"
                    inputMode="decimal"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {planModelInput === 'tiered' && (
              <div>
                <label className={labelClass}>Tiers</label>
                <div className="space-y-2">
                  {tierRows.map((row, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        value={row.upTo}
                        onChange={(e) =>
                          setTierRows((rows) =>
                            rows.map((r, i) =>
                              i === index ? { ...r, upTo: e.target.value } : r,
                            ),
                          )
                        }
                        placeholder="Up to seats"
                        inputMode="numeric"
                        className={inputClass}
                      />
                      <input
                        value={row.monthlyPrice}
                        onChange={(e) =>
                          setTierRows((rows) =>
                            rows.map((r, i) =>
                              i === index
                                ? { ...r, monthlyPrice: e.target.value }
                                : r,
                            ),
                          )
                        }
                        placeholder="Monthly price (USD)"
                        inputMode="decimal"
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setTierRows((rows) =>
                            rows.filter((_, i) => i !== index),
                          )
                        }
                        disabled={tierRows.length === 1}
                        className={ghostButtonClass}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setTierRows((rows) => [
                      ...rows,
                      { upTo: '', monthlyPrice: '' },
                    ])
                  }
                  className={`${ghostButtonClass} mt-2`}
                >
                  Add tier
                </button>
              </div>
            )}

            <div>
              <label className={labelClass}>
                Alert threshold (seats, optional)
              </label>
              <input
                value={alertThresholdInput}
                onChange={(e) => setAlertThresholdInput(e.target.value)}
                placeholder="No alert"
                inputMode="numeric"
                className={inputClass}
              />
            </div>
            {error && <p className="text-sm text-[#ef4444]">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-[#2a3437] px-6 py-5">
            <button
              onClick={() => setPlanPricingDialogOpen(false)}
              className={ghostButtonClass}
            >
              Cancel
            </button>
            <button
              onClick={handleSavePlanPricing}
              disabled={busy}
              className={primaryButtonClass}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Dialog>
    </div>
  )
}
