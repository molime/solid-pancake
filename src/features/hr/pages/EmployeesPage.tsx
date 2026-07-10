import { useOrganization } from '@clerk/react'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent } from '@/shared/ui/Card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Building2, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { adpStatusPill } from '../lib/adpStatus'

export function EmployeesPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
  const employees = useQuery(
    api.employeeProfiles.listEmployeeProfiles,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-atria-ink">Employees</h1>
        <p className="text-base text-atria-text-secondary">
          Active caregivers and their ADP sync status.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {!employees || employees.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Building2 className="h-6 w-6" />}
                title="No employees yet"
                description="Hired candidates will appear here once they become active caregivers."
              />
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>NAME</TableHeader>
                  <TableHeader>EMAIL</TableHeader>
                  <TableHeader>ADP SYNC STATUS</TableHeader>
                  <TableHeader className="w-32">ACTIONS</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {employees.map((employee) => {
                  const pill = adpStatusPill(employee.adpSyncStatus)
                  return (
                    <TableRow key={employee._id}>
                      <TableCell className="font-medium">
                        {employee.displayName}
                      </TableCell>
                      <TableCell className="text-atria-text-secondary">
                        {employee.email}
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={pill.variant}>{pill.label}</StatusBadge>
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/hr/employees/${employee.tenantMemberId ?? employee._id}`}
                          className="flex items-center gap-1 text-sm font-medium text-atria-accent hover:text-atria-accent-hover"
                        >
                          View <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
