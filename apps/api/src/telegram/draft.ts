import { z } from 'zod';
import type { RunCreate } from '@pacer/shared';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// What the model returns. Canonical units: meters & seconds (see CLAUDE.md).
// `pace` and `confidence` are bot-only signals, never stored.
export const RunDraftSchema = z.object({
  distance_meters:  z.number().positive(),
  duration_seconds: z.number().int().positive(),
  run_date:         z.string().regex(dateRegex).nullish(),
  pace:             z.string().nullish(),
  confidence:       z.number().min(0).max(1),
});
export type RunDraft = z.infer<typeof RunDraftSchema>;

/** Map a confirmed draft to the shared RunCreate shape. `today` is yyyy-mm-dd. */
export function draftToRunCreate(draft: RunDraft, today: string): RunCreate {
  return {
    run_date: draft.run_date ?? today,
    distance_meters: draft.distance_meters,
    duration_seconds: draft.duration_seconds,
    warm_up: false,
    stretched: false,
    post_run_food: false,
    source: 'telegram',
  };
}

// In-memory pending drafts, keyed by `${chat_id}:${message_id}`. A draft is
// taken exactly once (on ✓ or ✗); process restart drops pending drafts, which
// is fine — the user just re-sends.
const drafts = new Map<string, RunDraft>();
export function putDraft(key: string, draft: RunDraft): void {
  drafts.set(key, draft);
}
export function takeDraft(key: string): RunDraft | undefined {
  const d = drafts.get(key);
  drafts.delete(key);
  return d;
}
