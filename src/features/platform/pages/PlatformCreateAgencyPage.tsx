import { useState } from 'react'
import { useAction, useMutation } from 'convex/react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { PlatformGate } from '../components/PlatformGate'

const primaryButtonClass =
  'rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0f10] transition-opacity hover:opacity-90 disabled:opacity-50'

const ghostButtonClass =
  'rounded-lg border border-[#2a3437] px-4 py-2 text-sm font-medium text-[#9aa6a8] transition-colors hover:text-[#f5f7f6]'

const inputClass =
  'w-full rounded-lg border border-[#2a3437] bg-[#1e2629] px-3 py-2 text-[15px] text-[#f5f7f6] outline-none focus:border-[#22c55e]'

const labelClass = 'mb-1.5 block text-sm font-medium text-[#9aa6a8]'

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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

export function PlatformCreateAgencyPage() {
  const navigate = useNavigate()
  const createTenant = useAction(api.platform.createTenant)
  const upsertPricingPlan = useMutation(api.platform.upsertPricingPlan)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [ein, setEin] = useState('')
  const [address, setAddress] = useState('')
  const [planModel, setPlanModel] = useState<PlanModel>('flat')
  const [flatFeeInput, setFlatFeeInput] = useState('')
  const [perCandidateRate, setPerCandidateRate] = useState('')
  const [perShiftRate, setPerShiftRate] = useState('')
  const [perApplicationRate, setPerApplicationRate] = useState('')
  const [tierRows, setTierRows] = useState<TierRow[]>([
    { upTo: '', monthlyPrice: '' },
  ])
  const [alertThresholdInput, setAlertThresholdInput] = useState('')
  const [paymentMethodAllowed, setPaymentMethodAllowed] = useState<
    'card' | 'us_bank_account'
  >('card')
  const [billingEmailsInput, setBillingEmailsInput] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerDisplayName, setOwnerDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleNameChange = (value: string) => {
    setName(value)
    if (!slugEdited) setSlug(slugify(value))
  }

  const handleCreate = async () => {
    if (!name.trim() || !slug.trim()) {
      setError('Agency name and slug are required.')
      return
    }
    if (!ownerEmail.trim()) {
      setError('Agency owner email is required.')
      return
    }
    const flatFee =
      planModel === 'flat' ? parseOptionalNumber(flatFeeInput) : undefined
    if (planModel === 'flat' && (flatFee === undefined || flatFee <= 0)) {
      setError('Enter a valid monthly flat fee (USD).')
      return
    }
    const perItemRates = {
      perCandidate: parseOptionalNumber(perCandidateRate),
      perShift: parseOptionalNumber(perShiftRate),
      perApplication: parseOptionalNumber(perApplicationRate),
    }
    if (
      planModel === 'per_item' &&
      !Object.values(perItemRates).some((rate) => rate !== undefined)
    ) {
      setError('Set at least one per-item rate (USD).')
      return
    }
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
    if (planModel === 'tiered' && tiers.length === 0) {
      setError('Add at least one tier (seats up to + monthly price).')
      return
    }
    setBusy(true)
    setError('')
    try {
      // Each agency gets its own pricing plan (keyed by its slug) carrying the
      // model/rates/tiers chosen here — shared plans are never rewritten at
      // creation time, and later edits on the agency detail page only affect
      // this agency. The plan is upserted before the tenant exists so the
      // subscription never references a missing plan.
      const agencyPlanKey = `agency-${slug.trim()}`
      await upsertPricingPlan({
        key: agencyPlanKey,
        label: `${name.trim()} plan`,
        basePrice: flatFee ?? 0,
        includedSeats: 0,
        perSeatPrice: 0,
        active: true,
        model: planModel,
        ...(planModel === 'per_item' ? { perItemRates } : {}),
        ...(planModel === 'tiered' ? { tiers } : {}),
        ...(alertThreshold !== undefined ? { alertThreshold } : {}),
      })
      const billingEmails = billingEmailsInput
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean)
      const tenantId = await createTenant({
        name: name.trim(),
        slug: slug.trim(),
        ein: ein.trim() || undefined,
        address: address.trim() || undefined,
        planKey: agencyPlanKey,
        billingEmails,
        ownerEmail: ownerEmail.trim(),
        ownerDisplayName: ownerDisplayName.trim() || undefined,
        paymentMethodAllowed,
      })
      navigate(`/platform/agencies/${tenantId}`)
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to create agency.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <PlatformGate>
      <div className="space-y-6">
        <Link
          to="/platform/agencies"
          className="inline-flex items-center gap-2 text-sm text-[#9aa6a8] transition-colors hover:text-[#f5f7f6]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to agencies
        </Link>

        <h1 className="text-[26px] font-bold text-[#f5f7f6]">
          Create Agency
        </h1>

        <div className="max-w-xl rounded-2xl border border-[#2a3437] bg-[#151b1d] p-5">
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Agency name</label>
              <input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Sunrise Home Care"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Slug</label>
              <input
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true)
                  setSlug(slugify(e.target.value))
                }}
                placeholder="sunrise-home-care"
                className={inputClass}
              />
              <p className="mt-1.5 text-sm text-[#687173]">
                Auto-generated from the name. Used in URLs and Clerk.
              </p>
            </div>

            <div>
              <label className={labelClass}>EIN (optional)</label>
              <input
                value={ein}
                onChange={(e) => setEin(e.target.value)}
                placeholder="12-3456789"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Address (optional)</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St, Fresno, CA"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Pricing model</label>
              <select
                value={planModel}
                onChange={(e) => setPlanModel(e.target.value as PlanModel)}
                className={inputClass}
              >
                <option value="flat">Flat monthly fee</option>
                <option value="per_item">Per item (usage-based)</option>
                <option value="tiered">Tiered by seats</option>
              </select>
              <p className="mt-1.5 text-sm text-[#687173]">
                Saved as this agency&apos;s own pricing plan when the agency
                is created.
              </p>
            </div>

            {planModel === 'flat' && (
              <div>
                <label className={labelClass}>Monthly flat fee (USD)</label>
                <input
                  value={flatFeeInput}
                  onChange={(e) => setFlatFeeInput(e.target.value)}
                  placeholder="1500"
                  inputMode="decimal"
                  className={inputClass}
                />
                <p className="mt-1.5 text-sm text-[#687173]">
                  The agency is charged this amount every month.
                </p>
              </div>
            )}

            {planModel === 'per_item' && (
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

            {planModel === 'tiered' && (
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
                <p className="mt-1.5 text-sm text-[#687173]">
                  The first tier whose seat cap covers the active seat count
                  applies; the last tier is the catch-all.
                </p>
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
              <p className="mt-1.5 text-sm text-[#687173]">
                Soft alert shown to you and the agency when active seats reach
                this number. Never blocks usage.
              </p>
            </div>

            <div>
              <label className={labelClass}>Allowed payment method</label>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#2a3437] bg-[#1e2629] px-4 py-3">
                  <input
                    type="radio"
                    name="paymentMethodAllowed"
                    checked={paymentMethodAllowed === 'card'}
                    onChange={() => setPaymentMethodAllowed('card')}
                    className="accent-[#22c55e]"
                  />
                  <span className="text-[15px] font-medium text-[#f5f7f6]">
                    Card
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#2a3437] bg-[#1e2629] px-4 py-3">
                  <input
                    type="radio"
                    name="paymentMethodAllowed"
                    checked={paymentMethodAllowed === 'us_bank_account'}
                    onChange={() => setPaymentMethodAllowed('us_bank_account')}
                    className="accent-[#22c55e]"
                  />
                  <span className="text-[15px] font-medium text-[#f5f7f6]">
                    ACH bank debit
                  </span>
                </label>
              </div>
              <p className="mt-1.5 text-sm text-[#687173]">
                The owner&apos;s payment-setup link will only offer this
                method.
              </p>
            </div>

            <div>
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

            <div>
              <label className={labelClass}>Agency Owner Email</label>
              <input
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="owner@agency.com"
                className={inputClass}
              />
              <p className="mt-1.5 text-sm text-[#687173]">
                An invitation email with sign-in link will be sent to this
                person.
              </p>
            </div>

            <div>
              <label className={labelClass}>Owner Name (optional)</label>
              <input
                value={ownerDisplayName}
                onChange={(e) => setOwnerDisplayName(e.target.value)}
                placeholder="Jane Doe"
                className={inputClass}
              />
            </div>

            {error && <p className="text-sm text-[#ef4444]">{error}</p>}

            <div className="flex justify-end gap-2 border-t border-[#2a3437] pt-4">
              <Link to="/platform/agencies" className={ghostButtonClass}>
                Cancel
              </Link>
              <button
                onClick={handleCreate}
                disabled={busy || !name.trim() || !ownerEmail.trim()}
                className={primaryButtonClass}
              >
                {busy ? 'Creating…' : 'Create Agency'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </PlatformGate>
  )
}
