import { Hono } from 'hono';
import { VideoRoutineCreateSchema } from '@pacer/shared';
import type { VideoRoutine, VideoSection, VideoSectionWithUrl } from '@pacer/shared';
import type { AppEnv } from '../lib/auth';
import { env } from '../lib/env';
import { serviceClient } from '../lib/supabase';
import { zValidator } from '../lib/validate';

const BUCKET = 'video-frames';
const SIGNED_URL_TTL = 4 * 60 * 60; // 4h — sized for a slow, paused workout session
const PROCESSING_TIMEOUT_MS = 15 * 60 * 1000;

export const videoRoutines = new Hono<AppEnv>()

  .get('/', async (c) => {
    const db = c.get('userClient');
    const userId = c.get('userId');
    const { data, error } = await db
      .from('video_routines')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) return c.json({ error: error.message }, 400);
    return c.json((data as VideoRoutine[]).map(coerceTimeout));
  })

  .get('/:id', async (c) => {
    const db = c.get('userClient');
    const id = c.req.param('id');
    const { data, error } = await db
      .from('video_routines')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return c.json({ error: error.message }, error.code === 'PGRST116' ? 404 : 400);

    const routine = coerceTimeout(data as VideoRoutine);
    const sections = await withSignedUrls(routine.sections ?? null);
    return c.json({ ...routine, sections });
  })

  .post('/', zValidator('json', VideoRoutineCreateSchema), async (c) => {
    const db = c.get('userClient');
    const userId = c.get('userId');
    const { youtube_url } = c.req.valid('json');

    const { data: routine, error } = await db
      .from('video_routines')
      .insert({ user_id: userId, youtube_url, status: 'processing' })
      .select('*')
      .single();
    if (error) return c.json({ error: error.message }, 400);

    // Kick off the worker and await only its fast ack. A lost kickoff becomes an
    // honest error row rather than a permanent spinner.
    try {
      const res = await fetch(`${env.framesServiceUrl}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-token': env.internalToken },
        body: JSON.stringify({ routineId: routine.id, userId, youtubeUrl: youtube_url }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`worker responded ${res.status}`);
    } catch {
      await db
        .from('video_routines')
        .update({ status: 'error', error: "Couldn't start processing — try again." })
        .eq('id', routine.id);
      return c.json({ ...routine, status: 'error', error: "Couldn't start processing — try again." }, 202);
    }

    return c.json(routine, 202);
  })

  .delete('/:id', async (c) => {
    const db = c.get('userClient');
    const id = c.req.param('id');
    const userId = c.get('userId');
    // Best-effort frame cleanup (service role); the row delete is the source of truth.
    void removeFrames(userId, id);
    const { error } = await db.from('video_routines').delete().eq('id', id).eq('user_id', userId);
    if (error) return c.json({ error: error.message }, 400);
    return c.body(null, 204);
  });

// A row stuck in 'processing' past the timeout is reported as an error at read
// time — no background sweeper. Pure: never writes back.
function coerceTimeout(row: VideoRoutine): VideoRoutine {
  if (row.status !== 'processing') return row;
  const age = Date.now() - new Date(row.created_at).getTime();
  if (age < PROCESSING_TIMEOUT_MS) return row;
  return { ...row, status: 'error', error: 'Processing timed out — try again.' };
}

async function withSignedUrls(
  sections: VideoSection[] | null,
): Promise<VideoSectionWithUrl[] | null> {
  if (!sections || sections.length === 0) return sections === null ? null : [];
  const paths = sections.map((s) => s.frame_path);
  const { data } = await serviceClient().storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
  const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return sections.map((s) => ({ ...s, frame_url: byPath.get(s.frame_path) ?? '' }));
}

async function removeFrames(userId: string, routineId: string): Promise<void> {
  const prefix = `${userId}/${routineId}`;
  const storage = serviceClient().storage.from(BUCKET);
  const { data } = await storage.list(prefix);
  if (data && data.length > 0) {
    await storage.remove(data.map((f) => `${prefix}/${f.name}`));
  }
}
