import { Badge } from '@/shared/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'

export interface ReviewHistoryItem {
  _id: string
  createdAt: string
  decision: 'approved' | 'correction_requested'
  comment: string
}

export function ReviewHistory({ reviews }: { reviews: ReviewHistoryItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Review History</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Date</TableHeader>
              <TableHeader>Decision</TableHeader>
              <TableHeader>Comment</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {reviews.map((review) => (
              <TableRow key={review._id}>
                <TableCell>
                  {new Date(review.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={review.decision === 'approved' ? 'success' : 'danger'}
                  >
                    {review.decision}
                  </Badge>
                </TableCell>
                <TableCell>{review.comment}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
