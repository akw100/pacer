import { Hono } from 'hono';
import { OnboardingPatchSchema, type OnboardingState } from '@pacer/shared';
import type { AppEnv } from '../lib/auth';
import { zValidator } from '../lib/validate';

// GET/PATCH /onboarding/state
//
// Per-user onboarding + dismissed-hints state. Pure personal state — every
// query runs through the caller's user client so RLS applies (own-rows only;
// see migration 0004_onboarding_state.sql).
//
// GET upserts a default row on first call so the client always gets a usable
// shape, never a 404.
// PATCH accepts a sparse body; `dismiss_hint` appends to the array via
// `array_append`, deduplicated at the client by SET-like semantics.

export const onboarding = new Hono<AppEnv>()

  .get('/state', async (c) => {
    const db = c.get('userClient');
    const userId = c.get('userId');

    const { data: existing, error: selErr } = await db
      .from('onboarding_state')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (selErr) return c.json({ error: selErr.message }, 400);
    if (existing) return c.json(existing as OnboardingState);

    // First touch — seed the row. user_id is auth.uid() per RLS insert check.
    const { data: inserted, error: insErr } = await db
      .from('onboarding_state')
      .insert({ user_id: userId })
      .select('*')
      .single();
    if (insErr) return c.json({ error: insErr.message }, 400);
    return c.json(inserted as OnboardingState);
  })

  .patch('/state', zValidator('json', OnboardingPatchSchema), async (c) => {
    const db = c.get('userClient');
    const userId = c.get('userId');
    const body = c.req.valid('json');

    // Build the partial update. dismiss_hint is handled specially because we
    // need to append into the array atomically server-side.
    const patch: Record<string, unknown> = {};
    if (body.completed_at !== undefined) patch.completed_at = body.completed_at;
    if (body.skipped_at !== undefined) patch.skipped_at = body.skipped_at;
    if (body.coachmarks_done_at !== undefined) patch.coachmarks_done_at = body.coachmarks_done_at;

    if (body.dismiss_hint) {
      // Read-modify-write so we stay within the safe PostgREST surface (no
      // raw SQL needed). Concurrent dismissals of different hints would race;
      // not a meaningful concern for per-user UI state.
      const { data: existing } = await db
        .from('onboarding_state')
        .select('dismissed_hints')
        .eq('user_id', userId)
        .maybeSingle();
      const current = (existing?.dismissed_hints as string[] | undefined) ?? [];
      if (!current.includes(body.dismiss_hint)) {
        patch.dismissed_hints = [...current, body.dismiss_hint];
      }
    }

    if (Object.keys(patch).length === 0) {
      // Idempotent no-op — return the current row.
      const { data } = await db.from('onboarding_state').select('*').eq('user_id', userId).maybeSingle();
      return c.json(data as OnboardingState);
    }

    const { data: updated, error: updErr } = await db
      .from('onboarding_state')
      .update(patch)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (updErr) return c.json({ error: updErr.message }, 400);
    return c.json(updated as OnboardingState);
  });
