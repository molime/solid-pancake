from PIL import Image, ImageChops, ImageEnhance
import os

run_dir = os.path.dirname(os.path.abspath(__file__))
figma_dir = os.path.join(run_dir, '..', '..', '.hermes-pipeline', '20260705_232547')

comparisons = [
    ('scheduling', 'scheduling-calendar.png', 'desktop'),
    ('shift-editor', 'scheduling-shift-editor.png', 'desktop'),
    ('shift-packet', 'scheduling-shift-packet.png', 'desktop'),
    ('coverage', 'scheduling-coverage-request.png', 'desktop'),
    ('availability', 'caregiver-availability-management.png', 'mobile'),
]

threshold = 10
summary_lines = ['# Visual diff summary\n']

for view, ref_name, device in comparisons:
    live_path = os.path.join(run_dir, f'live-{view}-{device}.png')
    ref_path = os.path.join(figma_dir, ref_name)
    diff_path = os.path.join(run_dir, f'diff-{view}-{device}.png')

    if not os.path.exists(live_path):
        summary_lines.append(f'- **{view} ({device})**: live screenshot missing\n')
        continue
    if not os.path.exists(ref_path):
        summary_lines.append(f'- **{view} ({device})**: reference missing\n')
        continue

    live = Image.open(live_path).convert('RGB')
    ref = Image.open(ref_path).convert('RGB')
    ref = ref.resize(live.size, Image.LANCZOS)

    diff = ImageChops.difference(live, ref)
    # Enhance diff so small differences are visible.
    diff = ImageEnhance.Contrast(diff).enhance(2.0)
    diff.save(diff_path)

    pixels = list(diff.getdata())
    total = len(pixels)
    different = sum(1 for r, g, b in pixels if max(r, g, b) > threshold)
    percent = (different / total) * 100 if total else 0

    summary_lines.append(
        f'- **{view} ({device})**: {live.size[0]}×{live.size[1]}, '
        f'{different}/{total} pixels differ (>threshold {threshold}) = {percent:.2f}%\n'
    )

with open(os.path.join(run_dir, 'visual-diff-summary.md'), 'w') as f:
    f.writelines(summary_lines)

print(''.join(summary_lines))
