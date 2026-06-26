import { Hono } from 'hono';
import { AddReactionInputSchema } from '@pacer/shared';
import type { AppEnv } from '../lib/auth';
import { emit } from '../lib/events';
import { broadcast } from '../lib/realtime';
import { serviceClient } from '../lib/supabase';
import { zValidator } from '../lib/validate';

// React to a feed item. RLS lets a co-member insert; we additionally look up
// every group the target activity is shared with so the realtime broadcast
// reaches only the right channels. Reactions are emoji-only (👏🔥💪).

async function targetSharedGroups(
  targetType: 'run' | 'workout' | 'habit_day',
  targetId: string,
): Promise<string[]> {
  const svc = serviceClient();
  if (targetType === 'run') {
    const { data } = await svc.from('runs').select('shared_group_id').eq('id', targetId).maybeSingle();
    return data?.shared_group_id ? [data.shared_group_id as string] : [];
  }
  if (targetType === 'workout') {
    const { data } = await svc.from('workouts').select('shared_group_id').eq('id', targetId).maybeSingle();
    return data?.shared_group_id ? [data.shared_group_id as string] : [];
  }
  // habit_day reactions stay user-scoped for now (habits don't have group sharing yet).
  return [];
}

export const reactions = new Hono<AppEnv>()

  .post('/', zValidator('json', AddReactionInputSchema), async (c) => {
    const db = c.get('userClient');
    const userId = c.get('userId');
    const body = c.req.valid('json');

    // Upsert so tapping twice does nothing instead of failing on the unique
    // constraint; the client treats POST as "ensure the reaction exists".
    const { data, error } = await db
      .from('reactions')
      .upsert(
        { user_id: userId, ...body },
        { onConflict: 'user_id,target_type,target_id,emoji', ignoreDuplicates: false },
      )
      .select('*')
      .single();
    if (error) return c.json({ error: error.message }, error.code === '42501' ? 403 : 400);

    emit('reaction.added', { userId, targetType: body.target_type, targetId: body.target_id });
    for (const gid of await targetSharedGroups(body.target_type, body.target_id)) {
      void broadcast(`group:${gid}`, { type: 'reaction.added', ids: { reactionId: data.id as string, targetId: body.target_id } });
    }

    return c.json(data, 201);
  })

  .delete('/', zValidator('json', AddReactionInputSchema), async (c) => {
    const db = c.get('userClient');
    const userId = c.get('userId');
    const body = c.req.valid('json');
    const { error } = await db
      .from('reactions')
      .delete()
      .eq('user_id', userId)
      .eq('target_type', body.target_type)
      .eq('target_id', body.target_id)
      .eq('emoji', body.emoji);
    if (error) return c.json({ error: error.message }, 400);

    for (const gid of await targetSharedGroups(body.target_type, body.target_id)) {
      void broadcast(`group:${gid}`, { type: 'reaction.added', ids: { targetId: body.target_id } });
    }
    return c.body(null, 204);
  });
