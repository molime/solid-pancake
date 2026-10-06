import { useTenant } from '@/app/useTenant'
import { useMutation, useQuery } from 'convex/react'
import { Link } from 'react-router-dom'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Bell } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatDateUS, formatStatusLabel, formatTime } from '@/shared/format'
import { cn } from '@/shared/lib/cn'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'

const typeBadgeVariant: Record<string, 'info' | 'accent' | 'neutral'> = {
  audit: 'info',
  review: 'accent',
  agency_alert: 'accent',
}

const ALERT_ROLES = [
  { value: 'org:admin', label: 'Admins' },
  { value: 'org:hr', label: 'HR' },
  { value: 'org:coordinator', label: 'Coordinators' },
  { value: 'org:caregiver', label: 'Caregivers' },
] as const

type AlertRole = (typeof ALERT_ROLES)[number]['value']

export function NotificationsPage() {
  const { clerkOrgId } = useTenant()
    const notifications = useQuery(
    api.notifications.list,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const unreadCount = useQuery(
    api.notifications.unreadCount,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const member = useQuery(
    api.members.me,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const isAdmin = member?.role === 'org:admin'
  const markRead = useMutation(api.notifications.markRead)
  const markAllRead = useMutation(api.notifications.markAllRead)
  const sendAgencyAlert = useMutation(api.notifications.sendAgencyAlert)

  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<Id<'notifications'> | null>(null)
  const [isMarkingAll, setIsMarkingAll] = useState(false)

  const [alertMessage, setAlertMessage] = useState('')
  const [alertRoles, setAlertRoles] = useState<AlertRole[]>(
    ALERT_ROLES.map((r) => r.value),
  )
  const [isSendingAlert, setIsSendingAlert] = useState(false)
  const [alertSentCount, setAlertSentCount] = useState<number | null>(null)

  const toggleAlertRole = (role: AlertRole) => {
    setAlertRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    )
  }

  const handleSendAlert = async () => {
    if (!clerkOrgId) return
    setIsSendingAlert(true)
    setError(null)
    setAlertSentCount(null)
    try {
      const result = await sendAgencyAlert({
        clerkOrgId,
        message: alertMessage,
        targetRoles: alertRoles,
      })
      setAlertMessage('')
      setAlertSentCount(result.sent)
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to send alert.',
      )
    } finally {
      setIsSendingAlert(false)
    }
  }

  const types = useMemo(
    () => [...new Set((notifications ?? []).map((n) => n.type))],
    [notifications],
  )
  const [activeType, setActiveType] = useState<string>('all')

  const visible = (notifications ?? []).filter(
    (n) => activeType === 'all' || n.type === activeType,
  )

  const handleMarkRead = async (notificationId: Id<'notifications'>) => {
    setPendingId(notificationId)
    setError(null)
    try {
      await markRead({ notificationId })
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to mark notification as read.',
      )
    } finally {
      setPendingId(null)
    }
  }

  const handleMarkAllRead = async () => {
    if (!clerkOrgId) return
    setIsMarkingAll(true)
    setError(null)
    try {
      await markAllRead({ clerkOrgId })
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to mark notifications as read.',
      )
    } finally {
      setIsMarkingAll(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-atria-ink">Notifications</h1>
            {(unreadCount ?? 0) > 0 && (
              <Badge variant="accent">{unreadCount} unread</Badge>
            )}
          </div>
          <p className="text-base text-atria-text-secondary">
            Recent activity across your agency.
          </p>
        </div>
        {(unreadCount ?? 0) > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={isMarkingAll}
          >
            {isMarkingAll ? 'Marking…' : 'Mark all as read'}
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-atria-danger">{error}</p>}

      {isAdmin && (
        <div className="space-y-3 rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface p-4 shadow-[var(--shadow-atria-card)]">
          <h2 className="text-base font-semibold text-atria-ink">
            Send agency alert
          </h2>
          <textarea
            aria-label="Alert message"
            value={alertMessage}
            onChange={(e) => setAlertMessage(e.target.value)}
            placeholder="Message to staff…"
            rows={3}
            maxLength={500}
            className="w-full rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-bg px-3 py-2 text-sm text-atria-ink placeholder:text-atria-muted focus:border-atria-accent focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-2 text-sm text-atria-ink">
              <input
                type="checkbox"
                checked={alertRoles.length === ALERT_ROLES.length}
                onChange={(e) =>
                  setAlertRoles(
                    e.target.checked ? ALERT_ROLES.map((r) => r.value) : [],
                  )
                }
                className="h-4 w-4 accent-atria-accent"
              />
              All staff
            </label>
            {ALERT_ROLES.map((role) => (
              <label
                key={role.value}
                className="flex items-center gap-2 text-sm text-atria-ink"
              >
                <input
                  type="checkbox"
                  checked={alertRoles.includes(role.value)}
                  onChange={() => toggleAlertRole(role.value)}
                  className="h-4 w-4 accent-atria-accent"
                />
                {role.label}
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={handleSendAlert}
              disabled={
                isSendingAlert ||
                !alertMessage.trim() ||
                alertRoles.length === 0
              }
            >
              {isSendingAlert ? 'Sending…' : 'Send alert'}
            </Button>
            {alertSentCount !== null && (
              <p className="text-sm text-atria-success">
                Alert sent to {alertSentCount}{' '}
                {alertSentCount === 1 ? 'member' : 'members'}.
              </p>
            )}
          </div>
        </div>
      )}

      {types.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {['all', ...types].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setActiveType(type)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                activeType === type
                  ? 'bg-atria-accent text-atria-on-accent'
                  : 'border border-atria-border bg-atria-surface text-atria-ink hover:bg-atria-surface-2',
              )}
            >
              {type === 'all' ? 'All' : formatStatusLabel(type)}
            </button>
          ))}
        </div>
      )}

      {notifications === undefined ? (
        <p className="py-8 text-center text-sm text-atria-text-secondary">
          Loading notifications…
        </p>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-6 w-6" />}
          title="No notifications"
          description="You're all caught up. New activity will appear here."
        />
      ) : (
        <div className="space-y-3">
          {visible.map((notification) => (
            <div
              key={notification._id}
              className={cn(
                'flex items-center justify-between gap-4 rounded-[var(--radius-atria-md)] border bg-atria-surface p-4 shadow-[var(--shadow-atria-card)]',
                notification.read
                  ? 'border-atria-border'
                  : 'border-atria-accent/60 bg-atria-accent-quiet/40',
              )}
            >
              <div className="flex items-center gap-3">
                <Badge
                  variant={typeBadgeVariant[notification.type] ?? 'neutral'}
                >
                  {formatStatusLabel(notification.type)}
                </Badge>
                <p
                  className={cn(
                    'text-sm text-atria-ink',
                    notification.read ? 'font-normal' : 'font-medium',
                  )}
                >
                  {notification.message}
                </p>
                {typeof notification.metadata?.incidentId === 'string' && (
                  <Link
                    to={`/incidents/${notification.metadata.incidentId}`}
                    className="shrink-0 text-sm font-medium text-atria-accent hover:underline"
                  >
                    View incident →
                  </Link>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-atria-text-muted">
                  {formatDateUS(notification.createdAt)}{' '}
                  {formatTime(notification.createdAt)}
                </span>
                {!notification.read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMarkRead(notification._id)}
                    disabled={pendingId === notification._id}
                  >
                    Mark as read
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
