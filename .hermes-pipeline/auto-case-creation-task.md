# Automatic HR Case Creation — Comprehensive Proactive Flagging

## Context
Design doc at: C:\Users\pinol\Downloads\auto-case-creation-design-doc.md
Read it FIRST before implementing. It lists ALL flag scenarios.

## Task
Implement a daily cron job that automatically creates HR cases for ANY situation warranting HR attention. Not just expiring documents — ALL proactive flags:

1. Expiring documents (documentArchiveItems.expiresAt within 30 days or expired)
2. Expiring training (platformTrainingCompletions.expiresAt within 30 days or expired)
3. Background check issues (status = consider, suspended, expired, error, scan_failed)
4. Candidate pipeline stalls (stuck in invited >7d, application_draft >14d, submitted >5d, hr_review >5d)
5. Application rejections without notes (decision=rejected, no hrNotes)
6. Shift issues (needs_correction >3d, scheduled in past but no clockInAt/clockOutAt)
7. Unverified documents (documentArchiveItems status=pending >7d)

## Implementation

### Schema changes (convex/schema.ts)
- Add `flagType: v.optional(v.string())` to hrCases table (identifies auto-flag source)
- Add `autoCreatedAt: v.optional(v.string())` to hrCases table (timestamp of auto-flag run)

### Core mutation (convex/hrCases.ts)
Add `checkAndFlagIssues` internalMutation with no args that:
1. Gets all tenants
2. For each tenant, checks existing open cases for deduplication
3. Runs each helper check function
4. Creates cases with appropriate category, title, description, flagType

Helper functions (private, in hrCases.ts):
- checkExpiringDocuments(ctx, tenantId, existingOpenCases)
- checkExpiringTraining(ctx, tenantId, existingOpenCases)
- checkBackgroundCheckIssues(ctx, tenantId, existingOpenCases)
- checkCandidatePipelineStalls(ctx, tenantId, existingOpenCases)
- checkUnverifiedDocuments(ctx, tenantId, existingOpenCases)
- checkShiftIssues(ctx, tenantId, existingOpenCases)

Deduplication: check if existingOpenCases has a case with same subjectId + flagType before creating.

Each case gets:
- caseNumber: HR-YYYY-NNN format (same as existing)
- category: appropriate category per scenario
- title: descriptive, e.g. "CPR certificate expiring soon (25 days)" or "Background check flagged: consider"
- description: detailed explanation
- status: 'open'
- flagType: identifies the source (e.g. 'expiring_document', 'bg_check_concern', 'pipeline_stall', 'shift_issue', 'unverified_doc', 'training_expiry')
- subjectType/subjectId: from the source record

### Cron schedule (convex/cron.ts)
Create new file with daily schedule at 6 AM UTC:
```typescript
import { cronJobs } from './_generated/server'
import { internal } from './_generated/api'

const crons = cronJobs()
crons.daily('checkAndFlagIssues', { hourUTC: 6, minuteUTC: 0 }, internal.hrCases.checkAndFlagIssues)
export default crons
```

### Tests (convex/hrCases.test.ts)
- Test checkExpiringDocuments creates cases for expiring/expired docs
- Test checkExpiringTraining creates cases for expiring training
- Test checkBackgroundCheckIssues creates cases for problematic statuses
- Test checkCandidatePipelineStalls creates cases for stuck candidates
- Test checkUnverifiedDocuments creates cases for long-pending docs
- Test checkShiftIssues creates cases for shift problems
- Test deduplication (run twice, same count)
- Test that resolved/closed cases allow new flags

## Style
- 2-space indent, single quotes, NO semicolons
- Match existing patterns in convex/

## Verify
- npm run lint
- npm run typecheck
- npm run test
- npm run build
