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
  live_scan: 'lic_9163_live_scan',
  criminal_record: 'lic_508_criminal_record',
  w4: 'w4',
  i9: 'i9',
}

// Whiteout rectangles remove residual agency data from the scanned templates
// before we overlay our own values. Coordinates are in pdf-lib bottom-left origin.
const WHITEOUT_AREAS: Record<
  keyof typeof MAPPINGS,
  Array<{ page: number; x: number; y: number; width: number; height: number }>
> = {
  health_screen: [
    // Residual pre-filled facility name/address text where we overlay the
    // hiring agency's own values — kept narrow so we only hide the original
    // text, not the surrounding form
    { page: 0, x: 325, y: 658, width: 235, height: 42 },
    // Residual "SAN JOSE, CA." stamp near the right middle of the page
    { page: 0, x: 540, y: 235, width: 72, height: 20 },
    // Residual "CA 95121" stamp at the bottom-left edge
    { page: 0, x: 0, y: 0, width: 70, height: 20 },
  ],
  // Section 4 "Agency Address Set Contributing Agency" comes pre-filled with
  // the California Department of Social Services address — that pre-fill is
  // correct and must stay visible, so no whiteout for live_scan.
  live_scan: [],
  criminal_record: [],
  w4: [],
  i9: [],
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
  return PDFDocument.load(bytes)
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
