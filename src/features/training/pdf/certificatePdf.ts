import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'

export type CertificatePdfData = {
  courseTitle: string
  recipientName: string
  completedAt: string
  expiresAt: string
  agencyName?: string
}

// Brand colors sampled from the app's atria palette.
const INK = rgb(0.11, 0.13, 0.15)
const MUTED = rgb(0.42, 0.46, 0.5)
const ACCENT = rgb(0.13, 0.65, 0.36)

function centerX(text: string, font: PDFFont, size: number, pageWidth: number): number {
  return (pageWidth - font.widthOfTextAtSize(text, size)) / 2
}

// Landscape US Letter certificate matching the certificate page's framing:
// Atria-issued, on behalf of the agency, with the completed training named.
export async function generateCertificatePdf(
  data: CertificatePdfData,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([792, 612])
  const { width, height } = page.getSize()

  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  // Double frame.
  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: ACCENT,
    borderWidth: 2,
  })
  page.drawRectangle({
    x: 32,
    y: 32,
    width: width - 64,
    height: height - 64,
    borderColor: ACCENT,
    borderWidth: 0.75,
  })

  let y = height - 84
  const line = (
    text: string,
    size: number,
    font: PDFFont,
    color = INK,
    gap = 26,
  ) => {
    page.drawText(text, {
      x: centerX(text, font, size, width),
      y,
      size,
      font,
      color,
    })
    y -= gap
  }

  line('ATRIA-X DIGITAL SOLUTIONS', 11, bold, MUTED, 34)
  line('Certificate of Completion', 28, bold, INK, 46)
  line(data.courseTitle, 20, bold, ACCENT, 42)
  line('This certifies that', 12, regular, MUTED, 30)
  line(data.recipientName, 22, bold, INK, 40)
  line(
    `has successfully completed the ${data.courseTitle} training.`,
    12,
    regular,
    INK,
    44,
  )

  // Dates row.
  const leftX = width / 2 - 170
  const rightX = width / 2 + 60
  page.drawText('COMPLETED', { x: leftX, y, size: 9, font: bold, color: MUTED })
  page.drawText(data.completedAt, {
    x: leftX,
    y: y - 16,
    size: 13,
    font: regular,
    color: INK,
  })
  page.drawText('EXPIRES', { x: rightX, y, size: 9, font: bold, color: MUTED })
  page.drawText(data.expiresAt, {
    x: rightX,
    y: y - 16,
    size: 13,
    font: regular,
    color: INK,
  })
  y -= 64

  // Issuer block.
  line('Issued by ATRIA-X Digital Solutions', 12, bold, INK, 22)
  if (data.agencyName) {
    line(`on behalf of ${data.agencyName}`, 10, regular, MUTED, 0)
  }

  return doc.save()
}
