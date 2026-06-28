// Post-build: make deep deck routes survive a fresh page load on a static host.
//
// The deck is a BrowserRouter SPA (basename "/presentation/") served as a
// SUBFOLDER of the main web app. The host's SPA fallback sends unknown paths to
// the ROOT index.html (the auth-gated app), so a cold load of a deep deck route
// — most importantly /s/<id>/presenter, which presenter mode opens in a new
// window — lands on the app and gets bounced to the login page.
//
// Fix without touching host config: write a real directory + index.html at each
// deep route, so the static server serves the DECK's own index.html there (its
// client router then resolves the exact path). This mirrors why /presentation/
// already works — it's a real directory with an index.html.
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const outDir = path.resolve(process.argv[2] ?? '../web/public/presentation')
const slidesDir = path.resolve('slides')

const html = await readFile(path.join(outDir, 'index.html'), 'utf8')

const entries = await readdir(slidesDir, { withFileTypes: true })
const slideIds = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name)

// open-slide's per-slide routes (see its router): the viewer and the presenter window.
const routes = slideIds.flatMap((id) => [`s/${id}`, `s/${id}/presenter`])

for (const route of routes) {
  const dir = path.join(outDir, route)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'index.html'), html)
}

console.log(`spa-fallback: wrote ${routes.length} deep-route index.html copies for [${slideIds.join(', ')}]`)
