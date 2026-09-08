import { Component, useEffect, useState, type ReactNode } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Dialog } from "@/shared/ui/Dialog";
import { formatCurrency, formatDateUS } from "@/shared/format";
import { sanitizeConvexError } from "@/shared/lib/sanitizeConvexError";
import { usePlatformAdmin } from "../usePlatformAdmin";
import { PlatformGate } from "../components/PlatformGate";
import { PlatformStatusPill } from "../components/PlatformStatusPill";
import {
  PlatformTable,
  PlatformTableBody,
  PlatformTableCell,
  PlatformTableHead,
  PlatformTableHeader,
  PlatformTableRow,
} from "../components/PlatformTable";

const primaryButtonClass =
  "rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0f10] transition-opacity hover:opacity-90 disabled:opacity-50";

const dangerButtonClass =
  "rounded-lg bg-[rgba(239,68,68,0.16)] px-4 py-2 text-sm font-semibold text-[#ef4444] transition-colors hover:bg-[rgba(239,68,68,0.28)] disabled:opacity-50";

const ghostButtonClass =
  "rounded-lg border border-[#2a3437] px-4 py-2 text-sm font-medium text-[#9aa6a8] transition-colors hover:text-[#f5f7f6]";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-[#687173]">{label}</span>
      <span className="text-[15px] text-[#f5f7f6]">{value}</span>
    </div>
  );
}

// Catches query errors (e.g. an invalid or deleted tenant id makes
// getTenantDetail throw) and renders a graceful fallback instead of
// crashing the whole page.
class SubscriptionDetailErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean; error?: Error | null }
> {
  state: { failed: boolean; error?: Error | null } = { failed: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { failed: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('PlatformSubscriptionDetailPage error boundary:', error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="py-12 text-center">
          <p className="text-lg font-bold text-[#f5f7f6]">Agency not found</p>
          <p className="mt-1 text-sm text-[#9aa6a8]">
            This agency does not exist or the link is invalid.
          </p>
          {this.state.error && (
            <p className="mt-2 text-xs text-[#687173]">
              {this.state.error.message}
            </p>
          )}
          <Link
            to="/platform/subscriptions"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#22c55e] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to subscriptions
          </Link>
        </div>
      );
    }
    return this.props.children;
  }
}

export function PlatformSubscriptionDetailPage() {
  return (
    <PlatformGate>
      <SubscriptionDetailErrorBoundary>
        <PlatformSubscriptionDetailContent />
      </SubscriptionDetailErrorBoundary>
    </PlatformGate>
  );
}

function PlatformSubscriptionDetailContent() {
  const { tenantSlug } = useParams();
  const isAdmin = usePlatformAdmin();
  const detail = useQuery(
    api.platform.getTenantDetailBySlug,
    isAdmin && tenantSlug ? { slug: tenantSlug } : "skip",
  );
  const tenantId = detail?.tenant._id;
  const tenantProducts = useQuery(
    api.platform.getTenantProducts,
    isAdmin && tenantId ? { tenantId } : "skip",
  );
  const plans = useQuery(api.platform.getPricingPlans, isAdmin ? {} : "skip");
  const setTenantSubscription = useMutation(api.platform.setTenantSubscription);
  const setTenantProduct = useMutation(api.platform.setTenantProduct);
  const ensureDefaultProductsExist = useMutation(
    api.platform.ensureDefaultProductsExist,
  );
  const suspendTenant = useMutation(api.platform.suspendTenant);
  const reactivateTenant = useMutation(api.platform.reactivateTenant);
  const seedAgencyPreset = useMutation(api.platform.seedAgencyPreset);
  const disableDynamicApplicationForms = useMutation(
    api.platform.disableDynamicApplicationForms,
  );
  const deleteUserTrainingProgress = useMutation(
    api.platform.deleteUserTrainingProgress,
  );
  const createStripeCustomerForTenant = useAction(
    api.platformStripe.createStripeCustomerForTenant,
  );

  useEffect(() => {
    if (isAdmin) {
      ensureDefaultProductsExist({}).catch((err) => {
        console.error('Failed to ensure default products exist:', err)
      })
    }
  }, [isAdmin, ensureDefaultProductsExist])

  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedPlanKey, setSelectedPlanKey] = useState("");
  const [billingEmailsInput, setBillingEmailsInput] = useState("");
  const [confirmAction, setConfirmAction] = useState<
    "suspend" | "reactivate" | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [productBusy, setProductBusy] = useState<Record<string, boolean>>({});
  const [seedMessage, setSeedMessage] = useState("");
  const [disableFormsMessage, setDisableFormsMessage] = useState("");
  const [deleteTrainingEmail, setDeleteTrainingEmail] = useState("");
  const [deleteTrainingMessage, setDeleteTrainingMessage] = useState("");
  const [error, setError] = useState("");

  const subscription = detail?.subscription ?? null;
  const plan = detail?.plan ?? null;
  const usage = detail?.usage;

  const openPlanDialog = () => {
    setSelectedPlanKey(subscription?.planKey ?? plans?.[0]?.key ?? "");
    setBillingEmailsInput(subscription?.billingEmails.join(", ") ?? "");
    setError("");
    setPlanDialogOpen(true);
  };

  const handleChangePlan = async () => {
    if (!tenantId || !selectedPlanKey) return;
    setBusy(true);
    setError("");
    try {
      const now = new Date();
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const billingEmails = billingEmailsInput
        .split(",")
        .map((email) => email.trim())
        .filter(Boolean);
      await setTenantSubscription({
        tenantId,
        planKey: selectedPlanKey,
        status: subscription?.status ?? "active",
        billingEmails,
        currentPeriodStart:
          subscription?.currentPeriodStart ?? now.toISOString(),
        currentPeriodEnd:
          subscription?.currentPeriodEnd ?? periodEnd.toISOString(),
        renewsAt: subscription?.renewsAt,
        trialEndsAt: subscription?.trialEndsAt,
      });
      setPlanDialogOpen(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : "Failed to change plan.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!tenantId || !confirmAction) return;
    setBusy(true);
    setError("");
    try {
      if (confirmAction === "suspend") {
        await suspendTenant({ tenantId });
      } else {
        await reactivateTenant({ tenantId });
      }
      setConfirmAction(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : "Action failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSetupStripeCustomer = async () => {
    if (!tenantId) return;
    setBusy(true);
    setError("");
    try {
      await createStripeCustomerForTenant({
        tenantId,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : "Failed to set up Stripe customer.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleToggleProduct = async (productKey: string, active: boolean) => {
    if (!tenantId) return;
    setProductBusy((prev) => ({ ...prev, [productKey]: true }));
    setError("");
    try {
      await setTenantProduct({
        tenantId,
        productKey,
        active,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : "Failed to update product.",
      );
    } finally {
      setProductBusy((prev) => ({ ...prev, [productKey]: false }));
    }
  };

  const handleSeedPreset = async (
    preset: 'golden_ages' | 'individuals_choice',
  ) => {
    if (!tenantId) return;
    setBusy(true);
    setSeedMessage("");
    setError("");
    try {
      const result = await seedAgencyPreset({
        tenantId,
        preset,
      });
      setSeedMessage(result.message);
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : "Failed to seed agency preset.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDisableDynamicApplicationForms = async () => {
    if (!tenantId) return;
    setBusy(true);
    setDisableFormsMessage("");
    setError("");
    try {
      const result = await disableDynamicApplicationForms({ tenantId });
      setDisableFormsMessage(
        `Disabled ${result.deactivated} dynamic application form(s). Applicants will now use the built-in flow.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : "Failed to disable dynamic application forms.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTrainingProgress = async () => {
    if (!deleteTrainingEmail.trim()) return;
    setBusy(true);
    setDeleteTrainingMessage("");
    setError("");
    try {
      const result = await deleteUserTrainingProgress({
        email: deleteTrainingEmail.trim().toLowerCase(),
      });
      setDeleteTrainingMessage(
        `Deleted ${result.platformCount} platform completion(s) and ${result.stepCount} step completion(s).`,
      );
      setDeleteTrainingEmail("");
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : "Failed to delete training progress.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        to="/platform/subscriptions"
        className="inline-flex items-center gap-2 text-sm text-[#9aa6a8] transition-colors hover:text-[#f5f7f6]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to subscriptions
      </Link>

      {detail === null ? (
        <div className="py-12 text-center">
          <p className="text-lg font-bold text-[#f5f7f6]">Agency not found</p>
          <p className="mt-1 text-sm text-[#9aa6a8]">
            This agency does not exist or the link is invalid.
          </p>
          <p className="mt-2 text-xs text-[#687173]">
            Slug: {tenantSlug}
          </p>
          <Link
            to="/platform/subscriptions"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#22c55e] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to subscriptions
          </Link>
        </div>
      ) : !detail ? (
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
            <PlatformStatusPill status={subscription?.status ?? "none"} />
          </div>

          {error && <p className="text-sm text-[#ef4444]">{error}</p>}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#2a3437] bg-[#151b1d] p-5">
              <h2 className="text-lg font-bold text-[#f5f7f6]">Subscription</h2>
              <div className="mt-3 divide-y divide-[#2a3437]">
                <DetailRow label="Plan" value={plan?.label ?? "—"} />
                <DetailRow
                  label="Monthly rate"
                  value={plan ? formatCurrency(plan.basePrice) : "—"}
                />
                <DetailRow
                  label="Current period start"
                  value={formatDateUS(subscription?.currentPeriodStart) || "—"}
                />
                <DetailRow
                  label="Current period end"
                  value={formatDateUS(subscription?.currentPeriodEnd) || "—"}
                />
                <DetailRow
                  label="Next renewal"
                  value={
                    formatDateUS(
                      subscription?.renewsAt ?? subscription?.currentPeriodEnd,
                    ) || "—"
                  }
                />
                <DetailRow
                  label="Billing emails"
                  value={
                    subscription && subscription.billingEmails.length > 0
                      ? subscription.billingEmails.join(", ")
                      : "—"
                  }
                />
              </div>
            </div>

            <div className="rounded-2xl border border-[#2a3437] bg-[#151b1d] p-5">
              <h2 className="text-lg font-bold text-[#f5f7f6]">Usage</h2>
              <div className="mt-3 divide-y divide-[#2a3437]">
                <DetailRow
                  label="Active seats"
                  value={String(usage?.seatCount ?? 0)}
                />
                <DetailRow
                  label="Caregivers"
                  value={String(usage?.caregiverCount ?? 0)}
                />
                <DetailRow
                  label="Coordinators"
                  value={String(usage?.coordinatorCount ?? 0)}
                />
                <DetailRow
                  label="Admins + HR"
                  value={String(usage?.adminHrCount ?? 0)}
                />
                <DetailRow
                  label="Clients"
                  value={String(usage?.clientCount ?? 0)}
                />
                <DetailRow
                  label="Shifts this month"
                  value={String(usage?.shiftsThisMonth ?? 0)}
                />
                <DetailRow
                  label="Docs this month"
                  value={String(usage?.docsThisMonth ?? 0)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#2a3437] bg-[#151b1d] p-5">
            <h2 className="text-lg font-bold text-[#f5f7f6]">Actions</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={openPlanDialog} className={primaryButtonClass}>
                Change plan
              </button>
              {subscription?.status === "suspended" ? (
                <button
                  onClick={() => setConfirmAction("reactivate")}
                  className={primaryButtonClass}
                >
                  Reactivate tenant
                </button>
              ) : (
                <button
                  onClick={() => setConfirmAction("suspend")}
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
                  {busy ? "Working…" : "Setup Stripe Customer"}
                </button>
              )}
            </div>
            {subscription?.stripeCustomerId && (
              <div className="mt-4 max-w-md divide-y divide-[#2a3437]">
                <DetailRow
                  label="Stripe customer"
                  value={subscription.stripeCustomerId}
                />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#2a3437] bg-[#151b1d] p-5">
            <h2 className="text-lg font-bold text-[#f5f7f6]">Testing presets</h2>
            <p className="mt-1 text-sm text-[#687173]">
              One-click seed content for QA. Use with care on production tenants.
            </p>
            {seedMessage && (
              <p className="mt-3 text-sm text-[#22c55e]">{seedMessage}</p>
            )}
            {disableFormsMessage && (
              <p className="mt-3 text-sm text-[#22c55e]">{disableFormsMessage}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => handleSeedPreset('golden_ages')}
                disabled={busy}
                className={ghostButtonClass}
              >
                {busy ? 'Working…' : 'Seed Golden Ages preset'}
              </button>
              <button
                onClick={() => handleSeedPreset('individuals_choice')}
                disabled={busy}
                className={ghostButtonClass}
              >
                {busy ? 'Working…' : 'Seed Individuals Choice preset'}
              </button>
              <button
                onClick={handleDisableDynamicApplicationForms}
                disabled={busy || !tenantId}
                className={ghostButtonClass}
              >
                {busy ? 'Working…' : 'Use built-in application flow'}
              </button>
            </div>

            <div className="mt-6 border-t border-[#2a3437] pt-5">
              <p className="text-sm font-medium text-[#f5f7f6]">
                Delete training progress
              </p>
              <p className="mt-1 text-sm text-[#687173]">
                Enter a user email to wipe their training completions across all
                agencies.
              </p>
              {deleteTrainingMessage && (
                <p className="mt-3 text-sm text-[#22c55e]">
                  {deleteTrainingMessage}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-3">
                <input
                  type="email"
                  value={deleteTrainingEmail}
                  onChange={(e) => setDeleteTrainingEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="min-w-[240px] rounded-lg border border-[#2a3437] bg-[#1e2629] px-3 py-2 text-[15px] text-[#f5f7f6] outline-none focus:border-[#22c55e]"
                />
                <button
                  onClick={handleDeleteTrainingProgress}
                  disabled={busy || !deleteTrainingEmail.trim()}
                  className={dangerButtonClass}
                >
                  {busy ? 'Working…' : 'Delete progress'}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#2a3437] bg-[#151b1d] p-5">
            <h2 className="text-lg font-bold text-[#f5f7f6]">Modules</h2>
            <p className="mt-1 text-sm text-[#687173]">
              Enable or disable platform modules for this agency.
            </p>
            {!tenantProducts ? (
              <p className="mt-4 text-sm text-[#9aa6a8]">Loading modules…</p>
            ) : tenantProducts === null ? (
              <p className="mt-4 text-sm text-[#9aa6a8]">
                Unable to load modules for this agency.
              </p>
            ) : tenantProducts.products.length === 0 ? (
              <p className="mt-4 text-sm text-[#9aa6a8]">
                No modules available.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {tenantProducts.products.map((product) => (
                  <label
                    key={product.key}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-[#2a3437] bg-[#1e2629] px-4 py-3"
                  >
                    <span>
                      <span className="block text-[15px] font-medium text-[#f5f7f6]">
                        {product.label}
                      </span>
                      <span className="mt-0.5 block text-sm text-[#687173]">
                        {product.description}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={product.active}
                      disabled={productBusy[product.key]}
                      onChange={(e) =>
                        handleToggleProduct(product.key, e.target.checked)
                      }
                      className="h-5 w-5 accent-[#22c55e] disabled:opacity-50"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-lg font-bold text-[#f5f7f6]">
              Payment history
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
                  {detail.invoices.map((invoice) => (
                    <PlatformTableRow key={invoice._id}>
                      <PlatformTableCell className="font-medium">
                        {invoice.invoiceNumber}
                      </PlatformTableCell>
                      <PlatformTableCell className="text-[#9aa6a8]">
                        {formatDateUS(invoice.periodStart)} –{" "}
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
          <label className="mb-1.5 block text-sm font-medium text-[#9aa6a8]">
            Billing emails (comma-separated)
          </label>
          <input
            value={billingEmailsInput}
            onChange={(e) => setBillingEmailsInput(e.target.value)}
            placeholder="billing@agency.com, owner@agency.com"
            className="w-full rounded-lg border border-[#2a3437] bg-[#1e2629] px-3 py-2 text-[15px] text-[#f5f7f6] outline-none focus:border-[#22c55e]"
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
            {busy ? "Saving…" : "Confirm"}
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
            {confirmAction === "suspend"
              ? "Suspend tenant"
              : "Reactivate tenant"}
          </h3>
        </div>
        <div className="p-6">
          <p className="text-[15px] text-[#9aa6a8]">
            {confirmAction === "suspend"
              ? `Suspend ${detail?.tenant.name ?? "this tenant"}? Their subscription status will be set to suspended.`
              : `Reactivate ${detail?.tenant.name ?? "this tenant"}? Their subscription status will be set to active.`}
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
              confirmAction === "suspend"
                ? dangerButtonClass
                : primaryButtonClass
            }
          >
            {busy ? "Working…" : "Confirm"}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
