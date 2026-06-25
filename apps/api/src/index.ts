// Placeholder. Foundation B replaces this with the Hono server, the in-process
// event bus, broadcast()/realtime, and the route registry.
//
// The import proves cross-workspace raw-TS resolution of @pacer/shared at
// typecheck time (no build/dist step).
import { scoreFor } from '@pacer/shared';

export const placeholder = scoreFor({ reason: 'workout' });
