import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { Plus, Pencil } from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import { usePlatformAdmin } from '../usePlatformAdmin'
import { PlatformGate } from '../components/PlatformGate'
import {
  PlatformTable,
  PlatformTableBody,
  PlatformTableCell,
  PlatformTableHead,
  PlatformTableHeader,
  PlatformTableRow,
} from '../components/PlatformTable'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { FieldGroup } from '@/shared/ui/FieldGroup'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'

// Keep in sync with DEFAULT_PRODUCTS in convex/platform.ts.
const PRODUCT_OPTIONS = [
  { key: 'hiring', label: 'Hiring & Onboarding' },
  { key: 'training', label: 'Training Hub' },
  { key: 'full_platform', label: 'Full Platform' },
]

type PlanForm = {
  key: string
  label: string
  basePrice: string
  includedSeats: string
  perSeatPrice: string
  includedProducts: string[]
  active: boolean
}

const EMPTY_FORM: PlanForm = {
  key: '',
  label: '',
  basePrice: '',
  includedSeats: '10',
  perSeatPrice: '',
  includedProducts: ['hiring'],
  active: true,
}

// Owner-facing plan management: create/edit subscription tiers and define
// which products each tier unlocks. Plans that live subscriptions still
// reference cannot be deactivated (enforced server-side).
export function PlatformPlansPage() {
  const isAdmin = usePlatformAdmin()
  const plans = useQuery(api.platform.getPricingPlans, isAdmin ? {} : 'skip')
  const upsertPlan = useMutation(api.platform.upsertPricingPlan)
  const seedDefaults = useMutation(api.platform.seedPricingPlans)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [form, setForm] = useState<PlanForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const openCreate = () => {
    setEditingKey(null)
    setForm(EMPTY_FORM)
    setError('')
    setDialogOpen(true)
  }

  const openEdit = (plan: {
    key: string
    label: string
    basePrice: number
    includedSeats: number
    perSeatPrice: number
    active: boolean
    includedProducts?: string[]
  }) => {
    setEditingKey(plan.key)
    setForm({
      key: plan.key,
      label: plan.label,
      basePrice: String(plan.basePrice),
      includedSeats: String(plan.includedSeats),
      perSeatPrice: String(plan.perSeatPrice),
      includedProducts: plan.includedProducts ?? [],
      active: plan.active,
    })
    setError('')
    setDialogOpen(true)
  }

  const toggleProduct = (key: string) => {
    setForm((prev) => ({
      ...prev,
      includedProducts: prev.includedProducts.includes(key)
        ? prev.includedProducts.filter((k) => k !== key)
        : [...prev.includedProducts, key],
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await upsertPlan({
        key: form.key.trim(),
        label: form.label.trim(),
        basePrice: Number(form.basePrice),
        includedSeats: Number(form.includedSeats),
        perSeatPrice: Number(form.perSeatPrice),
        active: form.active,
        includedProducts: form.includedProducts,
      })
      setDialogOpen(false)
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Could not save the plan.',
      )
    } finally {
      setSaving(false)
    }
  }

  const formValid =
    form.key.trim() !== '' &&
    form.label.trim() !== '' &&
    Number(form.basePrice) >= 0 &&
    Number(form.perSeatPrice) >= 0 &&
    Number(form.includedSeats) >= 0

  return (
    <PlatformGate>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-[26px] font-bold text-[#f5f7f6]">Plans</h1>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0f10] transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            New plan
          </button>
        </div>

        {!plans ? (
          <p className="py-12 text-center text-sm text-[#9aa6a8]">
            Loading plans…
          </p>
        ) : plans.length === 0 ? (
          <div className="rounded-2xl border border-[#2a3437] bg-[#151b1d] py-12 text-center">
            <p className="text-sm text-[#9aa6a8]">No plans yet.</p>
            <button
              onClick={() => void seedDefaults({})}
              className="mt-4 rounded-lg border border-[#2a3437] px-4 py-2 text-sm font-medium text-[#f5f7f6] hover:bg-[#1b2225]"
            >
              Seed default plans (Starter / Professional / Enterprise)
            </button>
          </div>
        ) : (
          <PlatformTable>
            <PlatformTableHead>
              <PlatformTableHeader>Plan</PlatformTableHeader>
              <PlatformTableHeader>Key</PlatformTableHeader>
              <PlatformTableHeader>Base price</PlatformTableHeader>
              <PlatformTableHeader>Seats</PlatformTableHeader>
              <PlatformTableHeader>Per extra seat</PlatformTableHeader>
              <PlatformTableHeader>Includes</PlatformTableHeader>
              <PlatformTableHeader>Status</PlatformTableHeader>
              <PlatformTableHeader />
            </PlatformTableHead>
            <PlatformTableBody>
              {plans.map((plan) => (
                <PlatformTableRow key={plan._id}>
                  <PlatformTableCell>{plan.label}</PlatformTableCell>
                  <PlatformTableCell>{plan.key}</PlatformTableCell>
                  <PlatformTableCell>
                    ${plan.basePrice.toLocaleString('en-US')} / mo
                  </PlatformTableCell>
                  <PlatformTableCell>{plan.includedSeats}</PlatformTableCell>
                  <PlatformTableCell>
                    ${plan.perSeatPrice.toLocaleString('en-US')}
                  </PlatformTableCell>
                  <PlatformTableCell>
                    {(plan.includedProducts ?? [])
                      .map(
                        (key) =>
                          PRODUCT_OPTIONS.find((o) => o.key === key)?.label ??
                          key,
                      )
                      .join(', ') || '—'}
                  </PlatformTableCell>
                  <PlatformTableCell>
                    {plan.active ? 'Active' : 'Inactive'}
                  </PlatformTableCell>
                  <PlatformTableCell>
                    <button
                      onClick={() => openEdit(plan)}
                      className="inline-flex items-center gap-1 text-sm text-[#9aa6a8] hover:text-[#f5f7f6]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  </PlatformTableCell>
                </PlatformTableRow>
              ))}
            </PlatformTableBody>
          </PlatformTable>
        )}
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogHeader>
          <DialogTitle>
            {editingKey ? `Edit plan: ${editingKey}` : 'New plan'}
          </DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldGroup label="Key" htmlFor="plan-key" required>
              <Input
                id="plan-key"
                value={form.key}
                disabled={editingKey !== null}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, key: e.target.value }))
                }
                placeholder="starter"
              />
            </FieldGroup>
            <FieldGroup label="Label" htmlFor="plan-label" required>
              <Input
                id="plan-label"
                value={form.label}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, label: e.target.value }))
                }
                placeholder="Starter"
              />
            </FieldGroup>
            <FieldGroup label="Base price (USD / month)" htmlFor="plan-price" required>
              <Input
                id="plan-price"
                type="number"
                min="0"
                value={form.basePrice}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, basePrice: e.target.value }))
                }
              />
            </FieldGroup>
            <FieldGroup label="Included seats" htmlFor="plan-seats" required>
              <Input
                id="plan-seats"
                type="number"
                min="0"
                value={form.includedSeats}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, includedSeats: e.target.value }))
                }
              />
            </FieldGroup>
            <FieldGroup label="Per extra seat (USD)" htmlFor="plan-per-seat" required>
              <Input
                id="plan-per-seat"
                type="number"
                min="0"
                value={form.perSeatPrice}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, perSeatPrice: e.target.value }))
                }
              />
            </FieldGroup>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-atria-muted">
              Included products
            </p>
            <div className="space-y-2">
              {PRODUCT_OPTIONS.map((option) => (
                <label
                  key={option.key}
                  className="flex items-center gap-2 text-sm text-atria-ink"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={form.includedProducts.includes(option.key)}
                    onChange={() => toggleProduct(option.key)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-atria-ink">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={form.active}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, active: e.target.checked }))
              }
            />
            Active (visible for new subscriptions)
          </label>

          {error && <p className="text-sm text-atria-danger">{error}</p>}
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!formValid || saving}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : 'Save plan'}
          </Button>
        </DialogFooter>
      </Dialog>
    </PlatformGate>
  )
}
