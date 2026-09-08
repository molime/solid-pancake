import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { MAPPINGS, type PdfFieldMapping } from './mappings'
import type { Id } from '../../../../convex/_generated/dataModel'

export type GenerateUploadUrl = () => Promise<string>

export type SavePrefilledDocument = (args: {
  clerkOrgId: string
  candidateId?: Id<'candidates'>
  documentType: string
  storageId: string
}) => Promise<unknown>

const TEMPLATE_NAMES: Record<
  keyof typeof MAPPINGS,
  string
> = {
  health_screen: 'lic_503_health_screen',
  golden_ages_health_screen: 'golden_ages_health_screen',
  live_scan: 'lic_9163_live_scan',
  criminal_record: 'lic_508_criminal_record',
  w4: 'w4',
  i9: 'i9',
  de_34: 'de_34_new_hire',
  bcia_8016: 'bcia_8016_live_scan',
  hcs_501: 'hcs_501_personnel_record',
}

// Whiteout rectangles remove residual agency data from the scanned templates
// before we overlay our own values. Coordinates are in pdf-lib bottom-left origin.
const WHITEOUT_AREAS: Record<
  keyof typeof MAPPINGS,
  Array<{ page: number; x: number; y: number; width: number; height: number }>
> = {
  // The LIC 503 template is a clean scan — no residual agency data to hide,
  // so no whiteout rectangles (they were masking our own overlaid values).
  health_screen: [],
  // Golden Ages health documents have small placeholder labels inside each
  // blank line; white them out so the overlaid applicant data is clean.
  golden_ages_health_screen: [
    // Page 2 — Health Questionnaire / Medical History.
    { page: 1, x: 108.75, y: 717.35, width: 24.01, height: 10.04 },
    { page: 1, x: 465.75, y: 715.10, width: 19.01, height: 10.04 },
    { page: 1, x: 121.50, y: 686.60, width: 33.02, height: 10.04 },
    { page: 1, x: 453.75, y: 688.10, width: 26.02, height: 10.04 },
    { page: 1, x: 141.75, y: 658.85, width: 19.49, height: 10.04 },
    // Page 3 — Tuberculosis Screening Questionnaire.
    { page: 2, x: 131.25, y: 696.35, width: 24.01, height: 10.04 },
    { page: 2, x: 498.75, y: 671.60, width: 19.01, height: 10.04 },
    // Page 5 — Employee Health Statement.
    { page: 4, x: 113.25, y: 632.60, width: 24.01, height: 10.04 },
    { page: 4, x: 108.00, y: 600.35, width: 19.49, height: 10.04 },
    // Page 6 — Influenza Vaccine.
    { page: 5, x: 185.25, y: 439.10, width: 24.01, height: 10.04 },
    // Page 7 — Employee Flu Vaccine Tracking Form.
    { page: 6, x: 205.50, y: 673.10, width: 24.01, height: 10.04 },
    { page: 6, x: 228.78, y: 653.35, width: 37.87, height: 12.18 },
    { page: 6, x: 293.25, y: 652.85, width: 32.02, height: 10.04 },
    // Page 8 — COVID-19 Vaccination Religious Exemption.
    { page: 7, x: 141.75, y: 550.85, width: 42.51, height: 10.04 },
    { page: 7, x: 136.50, y: 535.85, width: 42.02, height: 10.04 },
    { page: 7, x: 122.25, y: 518.60, width: 31.02, height: 10.04 },
    { page: 7, x: 156.00, y: 486.35, width: 26.02, height: 10.04 },
    { page: 7, x: 153.75, y: 469.85, width: 22.50, height: 10.04 },
  ],
  // Section 4 "Agency Address Set Contributing Agency" comes pre-filled with
  // the California Department of Social Services address — that pre-fill is
  // correct and must stay visible, so no whiteout for live_scan.
  live_scan: [],
  criminal_record: [],
  w4: [],
  i9: [],
  de_34: [],
  bcia_8016: [],
  hcs_501: [],
}

function applyWhiteout(doc: PDFDocument, mappingKey: keyof typeof MAPPINGS) {
  const areas = WHITEOUT_AREAS[mappingKey]
  if (!areas || areas.length === 0) return

  for (const area of areas) {
    const page = doc.getPages()[area.page]
    if (!page) continue
    page.drawRectangle({
      x: area.x,
      y: area.y,
      width: area.width,
      height: area.height,
      color: rgb(1, 1, 1),
    })
  }
}

function findMappingKey(
  mapping: PdfFieldMapping,
): keyof typeof MAPPINGS | undefined {
  return (Object.keys(MAPPINGS) as Array<keyof typeof MAPPINGS>).find(
    (key) => MAPPINGS[key] === mapping,
  )
}

function rewriteUrlOriginToCurrent(url: string): string {
  const parsed = new URL(url)
  return `${window.location.origin}${parsed.pathname}${parsed.search}`
}

function getTextValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'boolean') return value ? 'X' : undefined
  const text = String(value)
  return text.trim().length > 0 ? text : undefined
}

export async function loadTemplate(name: string): Promise<PDFDocument> {
  const response = await fetch(`/templates/${name}.pdf`)
  if (!response.ok) {
    // Fallback to a blank US Letter page for forms without an official template.
    return PDFDocument.create()
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  // Some agency PDF templates come with encryption/owner passwords that
  // prevent pdf-lib from loading them. We only read and overlay text, so
  // ignoring encryption is safe for our fill-and-download use case.
  return PDFDocument.load(bytes, { ignoreEncryption: true })
}

function getOrCreatePage(doc: PDFDocument, pageIndex: number) {
  const pages = doc.getPages()
  if (pages[pageIndex]) return pages[pageIndex]
  while (doc.getPageCount() <= pageIndex) {
    doc.addPage([612, 792])
  }
  return doc.getPages()[pageIndex]
}

export async function overlayFields(
  doc: PDFDocument,
  mapping: PdfFieldMapping,
  data: Record<string, unknown>,
): Promise<PDFDocument> {
  const font = await doc.embedFont(StandardFonts.Helvetica)

  for (const field of mapping.fields) {
    const text = getTextValue(data[field.key])
    if (text === undefined) continue

    const page = getOrCreatePage(doc, field.page ?? mapping.page)

    const options: {
      x: number
      y: number
      size: number
      font: typeof font
      maxWidth?: number
    } = {
      x: field.x,
      y: field.y,
      size: field.fontSize,
      font,
    }

    if (field.maxWidth !== undefined) {
      options.maxWidth = field.maxWidth
    }

    page.drawText(text, options)
  }

  return doc
}

export async function generatePrefilledPdf(
  mapping: PdfFieldMapping,
  data: Record<string, unknown>,
): Promise<Uint8Array> {
  const key = findMappingKey(mapping)
  if (!key) {
    throw new Error('Unknown PDF mapping')
  }
  const doc = await loadTemplate(TEMPLATE_NAMES[key])
  applyWhiteout(doc, key)
  await overlayFields(doc, mapping, data)
  return doc.save()
}

function toBlob(pdfBytes: Uint8Array): Blob {
  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
}

export function saveAndDownload(pdfBytes: Uint8Array, filename: string): void {
  const blob = toBlob(pdfBytes)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function saveAndUpload(
  pdfBytes: Uint8Array,
  filename: string,
  documentType: string,
  clerkOrgId: string,
  generateUploadUrl: GenerateUploadUrl,
  savePrefilledDocument: SavePrefilledDocument,
  candidateId?: Id<'candidates'>,
): Promise<void> {
  const file = new File([toBlob(pdfBytes)], filename, {
    type: 'application/pdf',
  })
  const rawUrl = await generateUploadUrl()
  const uploadUrl = import.meta.env.DEV
    ? rewriteUrlOriginToCurrent(rawUrl)
    : rawUrl

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`)
  }

  const { storageId } = (await response.json()) as { storageId: string }
  await savePrefilledDocument({
    clerkOrgId,
    candidateId,
    documentType,
    storageId,
  })
}
