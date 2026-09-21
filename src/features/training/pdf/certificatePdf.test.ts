import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { generateCertificatePdf } from './certificatePdf'

describe('generateCertificatePdf', () => {
  it('produces a single-page PDF that names the training and recipient', async () => {
    const bytes = await generateCertificatePdf({
      courseTitle: 'California Safety & Fall Prevention',
      recipientName: 'Jane Doe',
      completedAt: '09/21/2026',
      expiresAt: '09/21/2027',
      agencyName: 'Golden Ages Home Care',
    })

    // Valid PDF bytes.
    expect(bytes.length).toBeGreaterThan(500)
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')

    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
    const page = doc.getPages()[0]
    // Landscape US Letter.
    expect(page.getWidth()).toBe(792)
    expect(page.getHeight()).toBe(612)
  })
})
