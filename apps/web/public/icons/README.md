# Pacer PWA icons + share card

`icon.svg` is the canonical source — vector, so it renders crisp at any install
size. `icon-square.svg` is the full-bleed variant (no rounded corners) used for
the Android maskable icon and the iOS apple-touch-icon, where the platform
applies its own mask. `og-image.svg` is the 1200×630 link-preview card.

## Regenerating the rasters

The PNGs are committed (built artifacts) but fully reproducible from the SVGs
with `./generate.sh` — macOS-only, no deps (uses `qlmanage` + `sips`). Run it
after editing any source SVG:

```
./generate.sh
```

It produces:

| File                         | Size    | Used by                                  |
| ---------------------------- | ------- | ---------------------------------------- |
| `icon-192.png`               | 192×192 | manifest (Android home-screen badge)     |
| `icon-512.png`               | 512×512 | manifest (splash / high-DPI)             |
| `icon-maskable-512.png`      | 512×512 | manifest (Android adaptive-icon, masked) |
| `apple-touch-icon.png`       | 180×180 | iOS home screen (`<link rel=apple-…>`)   |
| `favicon-32.png` / `-16.png` | 32 / 16 | browser tab                              |
| `og-image.png`               | 1200×630| Open Graph / Twitter link previews       |

`og-image.png` is excluded from the service-worker precache (see `globIgnores`
in `src/pwa/manifest.config.ts`) — only link-preview crawlers fetch it.
