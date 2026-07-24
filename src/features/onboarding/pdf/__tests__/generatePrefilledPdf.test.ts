import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MAPPINGS } from '../mappings'

const drawTextMock = vi.fn()
const drawRectangleMock = vi.fn()
const saveMock = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
const embedFontMock = vi.fn().mockResolvedValue({})

vi.mock('pdf-lib', () => ({
  PDFDocument: {
    load: vi.fn().mockResolvedValue({
      getPages: () => [{ drawText: drawTextMock, drawRectangle: drawRectangleMock }],
      embedFont: embedFontMock,
      save: saveMock,
    }),
  },
  StandardFonts: {
    Helvetica: 'Helvetica',
  },
  rgb: vi.fn().mockReturnValue({}),
}))

const {
  loadTemplate,
  overlayFields,
  generatePrefilledPdf,
  saveAndDownload,
} = await import('../generatePrefilledPdf')

describe('generatePrefilledPdf', () => {
  beforeEach(() => {
    drawTextMock.mockClear()
    saveMock.mockClear()
    embedFontMock.mockClear()
  })

  it('loadTemplate fetches the template by name', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    } as unknown as Response)

    const doc = await loadTemplate('lic_503_health_screen')
    expect(fetch).toHaveBeenCalledWith('/templates/lic_503_health_screen.pdf')
    expect(doc).toBeDefined()
  })

  it('overlayFields returns the document with expected page count', async () => {
    const { PDFDocument } = await import('pdf-lib')
    const doc = await PDFDocument.load(new Uint8Array())
    const result = await overlayFields(doc, MAPPINGS.health_screen, {
      facilityName: 'Atria Care',
      personName: 'Jane Doe',
    })

    expect(result).toBe(doc)
    expect(doc.getPages()).toHaveLength(1)
    expect(drawTextMock).toHaveBeenCalledWith(
      'Atria Care',
      expect.objectContaining({
        x: MAPPINGS.health_screen.fields[0].x,
        y: MAPPINGS.health_screen.fields[0].y,
        size: MAPPINGS.health_screen.fields[0].fontSize,
      }),
    )
    expect(drawTextMock).toHaveBeenCalledWith('Jane Doe', expect.any(Object))
  })

  it('overlayFields skips undefined and empty values', async () => {
    const { PDFDocument } = await import('pdf-lib')
    const doc = await PDFDocument.load(new Uint8Array())
    await overlayFields(doc, MAPPINGS.health_screen, {
      facilityName: 'Atria Care',
      personName: '',
      age: undefined,
    })

    expect(drawTextMock).toHaveBeenCalledWith('Atria Care', expect.any(Object))
    expect(drawTextMock).not.toHaveBeenCalledWith('', expect.any(Object))
  })

  it('overlayFields draws X for true boolean values', async () => {
    const { PDFDocument } = await import('pdf-lib')
    const doc = await PDFDocument.load(new Uint8Array())
    await overlayFields(doc, MAPPINGS.w4, {
      filingStatusSingle: true,
      multipleJobs: false,
    })

    expect(drawTextMock).toHaveBeenCalledWith('X', expect.any(Object))
  })

  it('generatePrefilledPdf returns saved bytes', async () => {
    const bytes = await generatePrefilledPdf(MAPPINGS.health_screen, {
      facilityName: 'Atria Care',
    })
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(saveMock).toHaveBeenCalled()
  })

  it('saveAndDownload creates a blob URL and clicks an anchor', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    const revokeObjectURL = vi.fn()
    const clickMock = vi.fn()
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL

    const anchor = document.createElement('a')
    vi.spyOn(document, 'createElement').mockReturnValue(anchor)
    vi.spyOn(anchor, 'click').mockImplementation(clickMock)
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => anchor)
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => anchor)

    saveAndDownload(new Uint8Array([1, 2, 3]), 'test.pdf')

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(anchor.download).toBe('test.pdf')
    expect(anchor.href).toBe('blob:mock-url')
    expect(clickMock).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})
