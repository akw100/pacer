#!/usr/bin/env bash
# Regenerate Pacer's raster icons + share card from the SVG sources.
# macOS-only, zero deps: qlmanage rasterizes SVG, sips forces exact size/format.
# Run from anywhere: ./generate.sh
set -euo pipefail
cd "$(dirname "$0")"

# render <source.svg> <size> <output.png>  — square, exact size
render() {
  qlmanage -t -s "$2" -o . "$1" >/dev/null 2>&1
  sips -z "$2" "$2" "$1.png" --out "$3" >/dev/null
  rm -f "$1.png"
}

render icon.svg        192 icon-192.png
render icon.svg        512 icon-512.png
render icon-square.svg 512 icon-maskable-512.png
render icon-square.svg 180 apple-touch-icon.png
render icon.svg         32 favicon-32.png
render icon.svg         16 favicon-16.png

# Share card is 1200x630. qlmanage pads non-square SVGs onto a square canvas,
# so render at 1200 then crop the centered 630px band back out.
qlmanage -t -s 1200 -o . og-image.svg >/dev/null 2>&1
sips -s format png -c 630 1200 og-image.svg.png --out og-image.png >/dev/null
rm -f og-image.svg.png

echo "Regenerated icons + og-image.png"
