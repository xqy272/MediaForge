#!/usr/bin/env python3
"""Generate MediaForge application icons - Abstract geometric crystal design."""

from PIL import Image, ImageDraw
import numpy as np
import os

# Design coordinates in 512x512 space
CENTER = (256, 260)
HEX_VERTICES = [
    (256, 88),   # top
    (388, 172),  # top-right
    (388, 348),  # bottom-right
    (256, 432),  # bottom
    (124, 348),  # bottom-left
    (124, 172),  # top-left
]

# Facet colors: blue-indigo-violet spectrum, light on top (catching light), dark on bottom
FACET_COLORS = [
    '#C7D2FE',  # upper-right (lightest - main light catch)
    '#A5B4FC',  # right
    '#6366F1',  # lower-right
    '#4F46E5',  # lower-left (darkest)
    '#7C3AED',  # left (violet accent)
    '#8B5CF6',  # upper-left
]

# Background gradient: deep indigo
BG_START = np.array([15, 10, 46], dtype=np.float64)   # #0F0A2E
BG_END = np.array([30, 27, 75], dtype=np.float64)     # #1E1B4B


def create_icon(size):
    """Create the icon at the specified size."""
    s = size / 512.0
    rx = int(108 * s)

    # Diagonal gradient background via numpy
    y_coords = np.linspace(0, 1, size)
    x_coords = np.linspace(0, 1, size)
    yy, xx = np.meshgrid(y_coords, x_coords, indexing='ij')
    t = ((xx + yy) / 2.0)[:, :, np.newaxis]
    gradient = (BG_START * (1 - t) + BG_END * t).astype(np.uint8)

    bg_rgba = Image.fromarray(gradient, 'RGB').convert('RGBA')

    # Rounded rectangle mask
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=rx, fill=255)

    # Apply mask for transparent rounded corners
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    img.paste(bg_rgba, mask=mask)

    # Draw hexagonal crystal facets
    draw = ImageDraw.Draw(img)
    cx, cy = int(CENTER[0] * s), int(CENTER[1] * s)

    for i, color_hex in enumerate(FACET_COLORS):
        v1 = HEX_VERTICES[i]
        v2 = HEX_VERTICES[(i + 1) % 6]
        pts = [
            (int(v1[0] * s), int(v1[1] * s)),
            (int(v2[0] * s), int(v2[1] * s)),
            (cx, cy),
        ]
        draw.polygon(pts, fill=color_hex)

    return img


def create_svg():
    """Create SVG version of the icon for web favicon."""
    return '''<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0F0A2E"/>
      <stop offset="100%" stop-color="#1E1B4B"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="108" fill="url(#bg)"/>
  <polygon points="256,88 388,172 256,260" fill="#C7D2FE"/>
  <polygon points="388,172 388,348 256,260" fill="#A5B4FC"/>
  <polygon points="388,348 256,432 256,260" fill="#6366F1"/>
  <polygon points="256,432 124,348 256,260" fill="#4F46E5"/>
  <polygon points="124,348 124,172 256,260" fill="#7C3AED"/>
  <polygon points="124,172 256,88 256,260" fill="#8B5CF6"/>
</svg>'''


def main():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    icon_dir = os.path.join(project_root, 'src-tauri', 'icons')

    print(f"Generating icons in {icon_dir}\n")

    # Generate base icon at 1024x1024 for quality
    base = create_icon(1024)

    # icon.png (512x512)
    icon_512 = base.resize((512, 512), Image.LANCZOS)
    icon_512.save(os.path.join(icon_dir, 'icon.png'))
    print("  icon.png (512x512)")

    # Standard Tauri PNGs
    for name, sz in [('32x32.png', 32), ('128x128.png', 128), ('128x128@2x.png', 256)]:
        resized = base.resize((sz, sz), Image.LANCZOS)
        resized.save(os.path.join(icon_dir, name))
        print(f"  {name} ({sz}x{sz})")

    # Windows Square logos
    for sz in [30, 44, 71, 89, 107, 142, 150, 284, 310]:
        resized = base.resize((sz, sz), Image.LANCZOS)
        resized.save(os.path.join(icon_dir, f'Square{sz}x{sz}Logo.png'))
        print(f"  Square{sz}x{sz}Logo.png")

    # StoreLogo (50x50)
    base.resize((50, 50), Image.LANCZOS).save(os.path.join(icon_dir, 'StoreLogo.png'))
    print("  StoreLogo.png (50x50)")

    # ICO (multi-resolution) - Pillow auto-resizes from the source image
    ico_img = base.resize((256, 256), Image.LANCZOS)
    ico_img.save(
        os.path.join(icon_dir, 'icon.ico'),
        format='ICO',
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    )
    print("  icon.ico (multi-resolution)")

    # ICNS (macOS)
    try:
        base.save(os.path.join(icon_dir, 'icon.icns'), format='ICNS')
        print("  icon.icns")
    except Exception as e:
        print(f"  icon.icns - SKIPPED ({e})")

    # SVG for web favicon
    svg_path = os.path.join(project_root, 'public', 'icon.svg')
    with open(svg_path, 'w', encoding='utf-8') as f:
        f.write(create_svg())
    print("  public/icon.svg")

    print("\nDone! All icons generated.")


if __name__ == '__main__':
    main()
