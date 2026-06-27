import { Hono } from 'hono';
import { WorkerCompleteSchema } from '@pacer/shared';
import type { AppEnv } from '../lib/auth';
import { env } from '../lib/env';
import { serviceClient } from '../lib/supabase';
import { zValidator } from '../lib/validate';

// Mounted under /internal/video-routines (a PUBLIC_PATH_PREFIX, so no user JWT).
// The frames worker calls this when a job finishes. Guarded by the shared
// INTERNAL_TOKEN; writes are trusted server work via the service-role client —
// the single DB write-path, with the payload validated against the shared schema.
export const videoRoutinesInternal = new Hono<AppEnv>()
  .use('*', async (c, next) => {
    if (c.req.header('x-internal-token') !== env.internalToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    return next();
  })

  .post('/:id/complete', zValidator('json', WorkerCompleteSchema), async (c) => {
    const id = c.req.param('id');
    const { status, title, video_id, sections, error } = c.req.valid('json');

    const { error: dbError } = await serviceClient()
      .from('video_routines')
      .update({ status, title, video_id, sections: sections ?? null, error: error ?? null })
      .eq('id', id);
    if (dbError) return c.json({ error: dbError.message }, 400);

    return c.json({ ok: true });
  });
