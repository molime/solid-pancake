import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { formatDateUS } from '@/shared/format'
import { Globe, ShieldAlert } from 'lucide-react'

type TenantSummary = {
  _id: string
  name: string
  slug: string
  clerkOrgId: string
  createdAt: string
  memberCount: number
  clientCount: number
  shiftCount: number
}

export function PlatformAdminPage() {
  const isAdmin = useQuery(api.platform.isAdmin)
  const tenants = useQuery(
    api.platform.listTenants,
    isAdmin === true ? {} : 'skip',
  )

  if (isAdmin === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-atria-muted">Checking access…</div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <ShieldAlert className="h-10 w-10 text-atria-danger" />
          <div>
            <p className="text-sm font-medium text-atria-ink">Access denied</p>
            <p className="text-xs text-atria-muted mt-1">
              Platform admin privileges are required to view this page.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!tenants) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-atria-muted">Loading platform data…</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-atria-ink">Platform Admin</h1>
        <p className="text-sm text-atria-muted">
          {tenants.length} tenant{tenants.length !== 1 ? 's' : ''}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tenants</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {tenants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-atria-border/50 mb-3">
                <Globe className="h-6 w-6 text-atria-muted" />
              </div>
              <p className="text-sm font-medium text-atria-ink">No tenants yet</p>
              <p className="text-xs text-atria-muted mt-1 max-w-xs">
                Tenants will appear here after agencies are created.
              </p>
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Name</TableHeader>
                  <TableHeader>Slug</TableHeader>
                  <TableHeader>Members</TableHeader>
                  <TableHeader>Clients</TableHeader>
                  <TableHeader>Shifts</TableHeader>
                  <TableHeader>Created</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {tenants.map((tenant: TenantSummary) => (
                  <TableRow key={tenant._id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell className="text-atria-muted">{tenant.slug}</TableCell>
                    <TableCell>{tenant.memberCount}</TableCell>
                    <TableCell>{tenant.clientCount}</TableCell>
                    <TableCell>{tenant.shiftCount}</TableCell>
                    <TableCell className="text-atria-muted">
                      {formatDateUS(tenant.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
