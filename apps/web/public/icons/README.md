# Pacer PWA icons

`icon.svg` is the canonical source — vector, so it renders crisp at any
install size. The manifest also lists three PNG fallbacks because:

- Older Android Chrome versions still prefer raster icons for the home-screen
  badge.
- Maskable icons (Android adaptive-icon clipping) are spec'd as PNG only.

## Placeholder PNGs (commit-time)

`icon-192.png`, `icon-512.png`, and `icon-maskable-512.png` ship as 1×1
transparent placeholders so the build succeeds and the manifest validator
doesn't 404. Replace them with real renders of `icon.svg` before launch —
any image tool works (Figma export, ImageMagick, sharp, etc.):

```
# Example, ImageMagick:
magick icon.svg -resize 192x192 icon-192.png
magick icon.svg -resize 512x512 icon-512.png
# For the maskable one, add 12% safe-zone padding around the glyph.
```

The Lighthouse "installable" audit will still pass with the SVG entry alone
on modern Chrome / Edge / Safari Tech Preview.
