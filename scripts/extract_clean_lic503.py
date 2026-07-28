"""Re-extract a clean image-based LIC 503 health screen template.

Source: C:/Users/pinol/Downloads/ilsApplication.pdf, page index 10.
Steps:
  1. Open the source PDF and grab page 10.
  2. Redact residual pre-filled data in the facility name area
     (x=322-580, y=100-115) and facility address area (x=322-580, y=120-148),
     splitting the redaction rectangles so the 'FACILITY NAME',
     'FACILITY ADDRESS' and 'AGE' labels are preserved.
  3. Apply redactions.
  4. Render the page at 300 DPI.
  5. Embed the image in a new 612x792 single-page PDF.
  6. Save to public/templates/lic_503_health_screen.pdf.
  7. Verify: 0 text spans, 1 image block.
"""
import sys

import fitz

SOURCE_PATH = 'C:/Users/pinol/Downloads/ilsApplication.pdf'
OUTPUT_PATH = 'public/templates/lic_503_health_screen.pdf'
PAGE_INDEX = 10
PAGE_SIZE = fitz.Rect(0, 0, 612, 792)
DPI = 300

# Label rectangles to preserve (with padding), measured from the source page
LABEL_FACILITY_NAME = fitz.Rect(325, 96, 371, 104)
LABEL_FACILITY_ADDRESS = fitz.Rect(325, 120, 382, 129)
LABEL_AGE = fitz.Rect(446, 146, 461, 155)

# Redaction rectangles split around the preserved labels
REDACTION_RECTS = [
    # Facility name zone (x=322-580, y=100-115) around FACILITY NAME
    fitz.Rect(322, 100, 325, 115),
    fitz.Rect(371, 100, 580, 115),
    fitz.Rect(325, 104, 371, 115),
    # Facility address zone (x=322-580, y=120-148) around FACILITY ADDRESS and AGE
    fitz.Rect(322, 120, 325, 148),
    fitz.Rect(382, 120, 580, 129),
    fitz.Rect(325, 129, 446, 148),
    fitz.Rect(461, 129, 580, 148),
    fitz.Rect(446, 129, 461, 146),
]


def main() -> int:
    src = fitz.open(SOURCE_PATH)
    page = src[PAGE_INDEX]

    for rect in REDACTION_RECTS:
        page.add_redact_annot(rect, fill=(1, 1, 1))
    page.apply_redactions()

    pix = page.get_pixmap(dpi=DPI)

    out = fitz.open()
    out_page = out.new_page(width=PAGE_SIZE.width, height=PAGE_SIZE.height)
    out_page.insert_image(PAGE_SIZE, pixmap=pix)
    out.save(OUTPUT_PATH, deflate=True)
    out.close()
    src.close()

    # Verify the result
    doc = fitz.open(OUTPUT_PATH)
    vpage = doc[0]
    spans = 0
    image_blocks = 0
    for block in vpage.get_text('dict')['blocks']:
        if block['type'] == 1:
            image_blocks += 1
        else:
            for line in block.get('lines', []):
                spans += len(line.get('spans', []))
    print(f'pages={doc.page_count} rect={vpage.rect} text_spans={spans} image_blocks={image_blocks}')
    ok = spans == 0 and image_blocks == 1 and vpage.rect == PAGE_SIZE
    doc.close()

    print('VERIFY:', 'PASS' if ok else 'FAIL')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
