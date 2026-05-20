export function isScheduledStartDue(
  scheduledStart: string,
  nowMs = Date.now(),
) {
  const scheduledMs = Date.parse(scheduledStart)
  return Number.isFinite(scheduledMs) && scheduledMs <= nowMs
}

export function initialShiftStatusForStart(
  scheduledStart: string,
): 'scheduled' | 'in_progress' {
  return isScheduledStartDue(scheduledStart) ? 'in_progress' : 'scheduled'
}
