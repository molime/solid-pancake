import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { generateEvvExportPdf } from './evvExportPdf'

describe('generateEvvExportPdf', () => {
  it('produces a valid PDF with header and visit rows', async () => {
    const bytes = await generateEvvExportPdf({
      agencyName: 'Test Agency',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      visits: [
        {
          serviceType: 'SLS',
          recipientName: 'Alex Rivera',
          date: '2026-09-15',
          beginAt: '2026-09-15T09:00:00.000Z',
          endAt: '2026-09-15T12:00:00.000Z',
          location: 'Client home',
          providerName: 'Caregiver One',
        },
      ],
    })
    expect(bytes.length).toBeGreaterThan(500)
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
  })

  it('paginates when visits exceed one page', async () => {
    const visits = Array.from({ length: 45 }, (_, i) => ({
      serviceType: 'SLS',
      recipientName: `Client ${i}`,
      date: '2026-09-15',
      beginAt: '2026-09-15T09:00:00.000Z',
      endAt: '2026-09-15T12:00:00.000Z',
      location: 'Client home',
      providerName: 'Caregiver One',
    }))
    const bytes = await generateEvvExportPdf({
      agencyName: 'Test Agency',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      visits,
    })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThan(1)
  })
})
