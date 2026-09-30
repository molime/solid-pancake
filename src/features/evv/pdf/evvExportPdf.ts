/**
 * PDF rendering of the EVV visit export — same six Cures Act data elements
 * as the CSV, in a printable table. Generated client-side with pdf-lib from
 * the same getEvvVisits data the page previews.
 */
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { formatDateUS, formatTime } from '@/shared/format'

export interface EvvVisitRow {
  serviceType: string
  recipientName: string
  date: string
  beginAt: string
  endAt: string
  location: string
  providerName: string
}

const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 40
const ROW_H = 18
const HEADER_Y = PAGE_H - 130
const FOOTER_Y = 40
const FONT_SIZE = 9

// Column x positions; text is truncated per column to keep one line per row.
const COLUMNS: Array<{ x: number; maxChars: number }> = [
  { x: 40, maxChars: 10 }, // Date
  { x: 96, maxChars: 20 }, // Recipient
  { x: 208, maxChars: 16 }, // Service type
  { x: 296, maxChars: 9 }, // Begin
  { x: 348, maxChars: 9 }, // End
  { x: 400, maxChars: 16 }, // Location
  { x: 506, maxChars: 14 }, // Provider
]
const HEADERS = ['Date', 'Recipient', 'Service', 'Begin', 'End', 'Location', 'Provider']

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text
}

export async function generateEvvExportPdf(args: {
  agencyName: string
  startDate: string
  endDate: string
  visits: EvvVisitRow[]
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const drawHeader = (page: ReturnType<typeof doc.addPage>) => {
    page.drawText('ATRIA-X EVV Visit Export', {
      x: MARGIN,
      y: PAGE_H - 56,
      size: 15,
      font: bold,
    })
    page.drawText(args.agencyName, { x: MARGIN, y: PAGE_H - 76, size: 11, font })
    page.drawText(
      `Period: ${formatDateUS(args.startDate)} - ${formatDateUS(args.endDate)}   Generated: ${formatDateUS(new Date().toISOString())}`,
      { x: MARGIN, y: PAGE_H - 92, size: FONT_SIZE, font },
    )
    HEADERS.forEach((header, i) => {
      page.drawText(header, {
        x: COLUMNS[i].x,
        y: HEADER_Y,
        size: FONT_SIZE,
        font: bold,
      })
    })
    page.drawLine({
      start: { x: MARGIN, y: HEADER_Y - 6 },
      end: { x: PAGE_W - MARGIN, y: HEADER_Y - 6 },
      thickness: 0.75,
    })
  }

  let page = doc.addPage([PAGE_W, PAGE_H])
  drawHeader(page)
  let y = HEADER_Y - ROW_H - 6

  for (const visit of args.visits) {
    if (y < FOOTER_Y + ROW_H) {
      page = doc.addPage([PAGE_W, PAGE_H])
      drawHeader(page)
      y = HEADER_Y - ROW_H - 6
    }
    const cells = [
      formatDateUS(visit.date),
      visit.recipientName,
      visit.serviceType,
      formatTime(visit.beginAt),
      formatTime(visit.endAt),
      visit.location,
      visit.providerName,
    ]
    cells.forEach((cell, i) => {
      page.drawText(truncate(cell, COLUMNS[i].maxChars), {
        x: COLUMNS[i].x,
        y,
        size: FONT_SIZE,
        font,
      })
    })
    y -= ROW_H
  }

  page.drawText(`Total visits: ${args.visits.length}`, {
    x: MARGIN,
    y: FOOTER_Y,
    size: FONT_SIZE,
    font: bold,
  })

  return doc.save()
}
