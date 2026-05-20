import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'

export interface ExportBatchRow {
  _id: string
  name: string
  exportedAt: string
  exportedBy: string
}

export function ExportBatchesTable({ batches }: { batches: ExportBatchRow[] }) {
  if (batches.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Batches</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Name</TableHeader>
              <TableHeader>Date</TableHeader>
              <TableHeader>Exported By</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {batches.map((batch) => (
              <TableRow key={batch._id}>
                <TableCell className="font-medium">{batch.name}</TableCell>
                <TableCell>
                  {new Date(batch.exportedAt).toLocaleDateString()}
                </TableCell>
                <TableCell>{batch.exportedBy}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
