// ── Subscriber registry (APPEND-ONLY) ──────────────────────────────────────
// Importing a `subscribers/<slice>.ts` module runs its top-level `on(...)`
// calls as an import side-effect, wiring that slice's handlers onto the
// in-process event bus (lib/events.ts). app.ts imports THIS file once at boot
// so every registered subscriber is active.
//
// To add a subscriber: create `subscribers/<slice>.ts` that calls
// `on('run.logged', handler)` at module top level, then add ONE line here:
//
//     import './<slice>';
//
// This card (Foundation B) defines the bus and registry but subscribes to
// nothing — slices register their own handlers. Keep this list append-only.

import './scoring';
import './groups';
import './challenges';
