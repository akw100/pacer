import type { DomainEventName, DomainEventPayloads } from '@pacer/shared';

// In-process event bus — the synchronous, same-server seam between slices. A
// slice EMITS a domain event (e.g. logging emits `run.logged`); other slices'
// subscribers react (scoring awards points). Strongly typed over the shared
// event catalog so a wrong payload shape is a compile error at emit/on.
//
// Dispatch is synchronous and isolated: one handler throwing is logged and does
// NOT block the others or the emitter. Cross-server fan-out is realtime.ts's job.

type Handler<N extends DomainEventName> = (
  payload: DomainEventPayloads[N],
) => void | Promise<void>;

// Stored loosely; the per-event types are enforced at the on()/emit() boundary,
// where the single cast is contained. (A generic-indexed mapped type collapses
// the element type to `never`, so we keep the store opaque internally.)
type StoredHandler = (payload: never) => void | Promise<void>;
const handlers = new Map<DomainEventName, StoredHandler[]>();

/** Subscribe to a domain event. Register from a `subscribers/<slice>.ts` module. */
export function on<N extends DomainEventName>(name: N, handler: Handler<N>): void {
  const list = handlers.get(name) ?? [];
  list.push(handler as StoredHandler);
  handlers.set(name, list);
}

/** Emit a domain event to all subscribers. Isolated: a failing handler can't break the others. */
export function emit<N extends DomainEventName>(name: N, payload: DomainEventPayloads[N]): void {
  const list = handlers.get(name);
  if (!list) return;
  for (const stored of list) {
    const handler = stored as Handler<N>;
    try {
      const result = handler(payload);
      if (result instanceof Promise) {
        result.catch((err: unknown) => {
          console.error(`[events] async handler for "${name}" failed:`, err);
        });
      }
    } catch (err) {
      console.error(`[events] handler for "${name}" failed:`, err);
    }
  }
}
