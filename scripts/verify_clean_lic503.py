"""Verify public/templates/lic_503_health_screen.pdf is a clean image-based template.

Checks:
  - exactly 1 page of size 612x792
  - 0 text spans
  - exactly 1 image block
"""
import sys

import fitz

PDF_PATH = 'public/templates/lic_503_health_screen.pdf'


def main() -> int:
    doc = fitz.open(PDF_PATH)
    ok = True

    if doc.page_count != 1:
        print(f'FAIL: expected 1 page, got {doc.page_count}')
        ok = False
    else:
        print('PASS: page count = 1')

    page = doc[0]
    rect = page.rect
    expected = fitz.Rect(0, 0, 612, 792)
    if rect != expected:
        print(f'FAIL: page rect = {rect}, expected {expected}')
        ok = False
    else:
        print(f'PASS: page rect = {rect}')

    spans = 0
    image_blocks = 0
    for block in page.get_text('dict')['blocks']:
        if block['type'] == 1:
            image_blocks += 1
        else:
            for line in block.get('lines', []):
                spans += len(line.get('spans', []))

    if spans != 0:
        print(f'FAIL: expected 0 text spans, got {spans}')
        ok = False
    else:
        print('PASS: 0 text spans')

    if image_blocks != 1:
        print(f'FAIL: expected 1 image block, got {image_blocks}')
        ok = False
    else:
        print('PASS: 1 image block')

    doc.close()
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
