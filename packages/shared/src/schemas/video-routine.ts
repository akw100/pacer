import { z } from 'zod';

// A YouTube workout video turned into a step-through routine: one still frame +
// label per section. Sections + frame bytes are produced by the Python frames
// worker (services/frames); this schema is the contract the api validates the
// worker's callback against and the web app types its UI from.
//
// Units: timestamps are SECONDS (integers) per the repo's canonical-units rule —
// derive mm:ss at display time.

const youtubeUrlRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;

export const VideoSectionSchema = z.object({
  idx:        z.number().int().nonnegative(),
  title:      z.string().min(1),
  start_sec:  z.number().int().nonnegative(),
  end_sec:    z.number().int().positive(),
  frame_path: z.string().min(1), // storage object path: <userId>/<routineId>/<idx>.jpg
  move_label: z.string().nullish(),
});
export type VideoSection = z.infer<typeof VideoSectionSchema>;

// A section as returned to the client: the storage path is swapped for a
// short-lived signed URL the api mints at read time.
export const VideoSectionWithUrlSchema = VideoSectionSchema.extend({
  frame_url: z.string(),
});
export type VideoSectionWithUrl = z.infer<typeof VideoSectionWithUrlSchema>;

export const VideoRoutineStatus = z.enum(['processing', 'ready', 'error']);
export type VideoRoutineStatusType = z.infer<typeof VideoRoutineStatus>;

// What the web app POSTs to create a routine.
export const VideoRoutineCreateSchema = z.object({
  youtube_url: z.string().regex(youtubeUrlRegex, 'Expected a YouTube video URL'),
});
export type VideoRoutineCreate = z.infer<typeof VideoRoutineCreateSchema>;

// The stored row (frame paths, not URLs). like_count / liked_by_me are derived
// and attached by the api on list endpoints (absent on the raw row).
export const VideoRoutineSchema = z.object({
  id:          z.string().uuid(),
  user_id:     z.string().uuid(),
  youtube_url: z.string(),
  video_id:    z.string().nullish(),
  title:       z.string().nullish(),
  status:      VideoRoutineStatus,
  error:       z.string().nullish(),
  sections:    z.array(VideoSectionSchema).nullish(),
  is_public:   z.boolean(),
  like_count:  z.number().int().nonnegative().optional(),
  liked_by_me: z.boolean().optional(),
  created_at:  z.string(),
});
export type VideoRoutine = z.infer<typeof VideoRoutineSchema>;

// Owner-only update (currently just the public toggle).
export const VideoRoutineUpdateSchema = z.object({ is_public: z.boolean() });
export type VideoRoutineUpdate = z.infer<typeof VideoRoutineUpdateSchema>;

// A routine as returned by GET /:id — sections carry signed frame URLs.
export const VideoRoutineWithUrlsSchema = VideoRoutineSchema.omit({ sections: true }).extend({
  sections: z.array(VideoSectionWithUrlSchema).nullish(),
});
export type VideoRoutineWithUrls = z.infer<typeof VideoRoutineWithUrlsSchema>;

// What the frames worker POSTs back to /internal/video-routines/:id/complete.
// Validated by the api before it persists — the single enforcement point for the
// shape the (separately-defined) Pydantic model in the worker produces.
export const WorkerCompleteSchema = z.object({
  status:   VideoRoutineStatus.exclude(['processing']),
  title:    z.string().nullish(),
  video_id: z.string().nullish(),
  sections: z.array(VideoSectionSchema).optional(),
  error:    z.string().nullish(),
});
export type WorkerComplete = z.infer<typeof WorkerCompleteSchema>;
