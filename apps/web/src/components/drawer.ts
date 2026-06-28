import type { FC, ReactNode } from 'react'
import { Drawer as VaulDrawer } from 'vaul'

// vaul 1.1.2 + @types/react 19 type regression: VaulDrawer.Portal's
// declared PortalProps derives via
// `ComponentPropsWithoutRef<typeof DialogPrimitive.Portal>`, which strict
// React 19 types collapse to `{}` — stripping `children` and `container`
// from the inferred props. JSX usage like `<Drawer.Portal>{...}</Drawer.Portal>`
// then trips TS2559 ("Type '{ children: Element[]; }' has no properties in
// common with type 'IntrinsicAttributes'").
//
// We retype Portal here once so the seven sheet files can pass children
// normally. When vaul ships a fix (or @types/react gets aligned), delete
// this shim and switch the imports back to `from 'vaul'`.
const Portal = VaulDrawer.Portal as FC<{
  children?: ReactNode
  container?: HTMLElement | null
}>

export const Drawer = {
  ...VaulDrawer,
  Portal,
}
