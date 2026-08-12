import { useState } from 'react'
import { useAction, useQuery } from 'convex/react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import { formatCurrency } from '@/shared/format'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { usePlatformAdmin } from '../usePlatformAdmin'
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

export function PlatformCreateAgencyPage() {
  const navigate = useNavigate()
  const isAdmin = usePlatformAdmin()
  const plans = useQuery(api.platform.getPricingPlans, isAdmin ? {} : 'skip')
  const createTenant = useAction(api.platform.createTenant)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [ein, setEin] = useState('')
  const [address, setAddress] = useState('')
  const [planKey, setPlanKey] = useState('')
  const [billingEmailsInput, setBillingEmailsInput] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerDisplayName, setOwnerDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const activePlans = (plans ?? []).filter((p) => p.active)
  const effectivePlanKey =
    planKey ||
    activePlans.find((p) => p.key === 'starter')?.key ||
    activePlans[0]?.key ||
    ''

  const handleNameChange = (value: string) => {
    setName(value)
    if (!slugEdited) setSlug(slugify(value))
  }

  const handleCreate = async () => {
    if (!name.trim() || !slug.trim()) {
      setError('Agency name and slug are required.')
      return
    }
    if (!effectivePlanKey) {
      setError('Select an initial plan.')
      return
    }
    if (!ownerEmail.trim()) {
      setError('Agency owner email is required.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const billingEmails = billingEmailsInput
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean)
      const tenantId = await createTenant({
        name: name.trim(),
        slug: slug.trim(),
        ein: ein.trim() || undefined,
        address: address.trim() || undefined,
        planKey: effectivePlanKey,
        billingEmails,
        ownerEmail: ownerEmail.trim(),
        ownerDisplayName: ownerDisplayName.trim() || undefined,
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
              <label className={labelClass}>Initial plan</label>
              <select
                value={effectivePlanKey}
                onChange={(e) => setPlanKey(e.target.value)}
                className={inputClass}
              >
                {activePlans.length === 0 && (
                  <option value="">No active plans</option>
                )}
                {activePlans.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label} — {formatCurrency(p.basePrice)}/mo ·{' '}
                    {p.includedSeats} seats
                  </option>
                ))}
              </select>
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
                disabled={busy || !name.trim() || !effectivePlanKey || !ownerEmail.trim()}
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
