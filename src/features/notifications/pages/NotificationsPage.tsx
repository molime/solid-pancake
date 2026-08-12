import { useOrganization } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
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
}

export function NotificationsPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
  const notifications = useQuery(
    api.notifications.list,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const unreadCount = useQuery(
    api.notifications.unreadCount,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const markRead = useMutation(api.notifications.markRead)
  const markAllRead = useMutation(api.notifications.markAllRead)

  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<Id<'notifications'> | null>(null)
  const [isMarkingAll, setIsMarkingAll] = useState(false)

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
