import { z } from 'zod';

// Challenges — competitive goals between friends and groups (spec §5).
//
// A challenge has an AUDIENCE (a specific person by handle, a whole group, or
// open-to-everyone), a METRIC (what's measured), a TARGET, and a date window.
// Progress is computed server-side per participant from their logged activity
// inside the window — except `check_in`, a self-report counter for video/text
// challenges where progress isn't derivable from logged data.
//
// This file is the single source of truth for the challenge shapes + the pure
// helpers (state machine, YouTube normalisation, metric metadata, templates)
// that web, api, and the bot all agree on. Progress NUMBERS are computed in the
// API (it reads across participants) but the metric CATALOG lives here.

// ── Enums ────────────────────────────────────────────────────────────────────

export const ChallengeAudienceSchema = z.enum(['user', 'group', 'everyone']);
export type ChallengeAudience = z.infer<typeof ChallengeAudienceSchema>;

export const ChallengeMetricSchema = z.enum([
  'distance', // meters run in the window
  'run_count', // number of runs
  'reps', // total reps across workout sets
  'workout_count', // number of workouts
  'habit_days', // distinct days with ≥1 habit check
  'score', // total points earned in the window
  'check_in', // self-report "mark done" counter
]);
export type ChallengeMetric = z.infer<typeof ChallengeMetricSchema>;

export const ParticipantStatusSchema = z.enum(['invited', 'accepted', 'declined']);
export type ParticipantStatus = z.infer<typeof ParticipantStatusSchema>;

export const ChallengeStateSchema = z.enum(['upcoming', 'active', 'finished']);
export type ChallengeState = z.infer<typeof ChallengeStateSchema>;

// yyyy-MM-dd, matching the canonical date-key convention used by runs/habits.
const DateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected yyyy-MM-dd');

// ── Entities ─────────────────────────────────────────────────────────────────

export const ChallengeSchema = z.object({
  id: z.string().uuid(),
  creator_id: z.string().uuid(),
  audience: ChallengeAudienceSchema,
  group_id: z.string().uuid().nullable(),
  metric: ChallengeMetricSchema,
  target: z.number().positive(),
  start_date: DateKeySchema,
  end_date: DateKeySchema,
  description: z.string().max(500).nullable(),
  youtube_url: z.string().url().nullable(),
  created_at: z.string(),
});
export type Challenge = z.infer<typeof ChallengeSchema>;

export const ChallengeParticipantSchema = z.object({
  challenge_id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: ParticipantStatusSchema,
});
export type ChallengeParticipant = z.infer<typeof ChallengeParticipantSchema>;

export const ChallengeCheckInSchema = z.object({
  id: z.string().uuid(),
  challenge_id: z.string().uuid(),
  user_id: z.string().uuid(),
  check_date: DateKeySchema,
  created_at: z.string(),
});
export type ChallengeCheckIn = z.infer<typeof ChallengeCheckInSchema>;

// ── Inputs ───────────────────────────────────────────────────────────────────

// Create: `audience` drives which of (target_handle | group_id) is required —
// refined below so the API and web forms reject malformed combinations the same
// way. `youtube_url` is normalised by the caller via normalizeYouTubeUrl first.
export const CreateChallengeInputSchema = z
  .object({
    audience: ChallengeAudienceSchema,
    metric: ChallengeMetricSchema,
    target: z.number().positive().max(10_000_000),
    start_date: DateKeySchema,
    end_date: DateKeySchema,
    description: z.string().max(500).trim().optional(),
    youtube_url: z.string().url().optional(),
    // audience = 'user' → invite this handle.
    target_handle: z.string().min(3).max(20).optional(),
    // audience = 'group' → challenge this group (creator must be a member).
    group_id: z.string().uuid().optional(),
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: 'end_date must be on or after start_date',
    path: ['end_date'],
  })
  .refine((v) => v.audience !== 'user' || !!v.target_handle, {
    message: 'target_handle is required when audience is "user"',
    path: ['target_handle'],
  })
  .refine((v) => v.audience !== 'group' || !!v.group_id, {
    message: 'group_id is required when audience is "group"',
    path: ['group_id'],
  });
export type CreateChallengeInput = z.infer<typeof CreateChallengeInputSchema>;

// Edit a challenge before it starts. Audience + participants are fixed once
// created; only the "rules" (metric/target/window) and content are editable.
// All fields optional — a PATCH-style partial update.
export const UpdateChallengeInputSchema = z
  .object({
    metric: ChallengeMetricSchema.optional(),
    target: z.number().positive().max(10_000_000).optional(),
    start_date: DateKeySchema.optional(),
    end_date: DateKeySchema.optional(),
    description: z.string().max(500).trim().nullable().optional(),
    youtube_url: z.string().url().nullable().optional(),
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, {
    message: 'end_date must be on or after start_date',
    path: ['end_date'],
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });
export type UpdateChallengeInput = z.infer<typeof UpdateChallengeInputSchema>;

export const RespondChallengeInputSchema = z.object({
  status: z.enum(['accepted', 'declined']),
});
export type RespondChallengeInput = z.infer<typeof RespondChallengeInputSchema>;

export const CheckInInputSchema = z.object({
  // Defaults to today server-side when omitted.
  date: DateKeySchema.optional(),
});
export type CheckInInput = z.infer<typeof CheckInInputSchema>;

// ── Read models (API → web) ──────────────────────────────────────────────────
// The API returns challenges enriched with computed state, the caller's own
// participation, and a per-participant leaderboard. These shapes are shared so
// the web query layer infers them instead of redeclaring.

export const ChallengeLeaderRowSchema = z.object({
  user_id: z.string().uuid(),
  display_name: z.string(),
  handle: z.string(),
  avatar_emoji: z.string().nullable(),
  status: ParticipantStatusSchema,
  progress: z.number(),
});
export type ChallengeLeaderRow = z.infer<typeof ChallengeLeaderRowSchema>;

export const ChallengeWithProgressSchema = ChallengeSchema.extend({
  state: ChallengeStateSchema,
  creator_handle: z.string(),
  creator_display_name: z.string(),
  // The caller's own row: status + progress (null if not a participant yet).
  my_status: ParticipantStatusSchema.nullable(),
  my_progress: z.number(),
  // Roster sizes: accepted players, and everyone still in (accepted + invited).
  accepted_count: z.number(),
  participant_count: z.number(),
  leaderboard: z.array(ChallengeLeaderRowSchema),
});
export type ChallengeWithProgress = z.infer<typeof ChallengeWithProgressSchema>;

// ── Pure helpers (shared by web + api + bot) ─────────────────────────────────

/** Progress toward target as a clamped integer percent (0–100). */
export function progressPercent(progress: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((progress / target) * 100)));
}

/** Whether a participant has reached the target. */
export function isChallengeComplete(progress: number, target: number): boolean {
  return target > 0 && progress >= target;
}

/** upcoming (before start) · active (within window) · finished (after end). */
export function challengeState(
  startDate: string,
  endDate: string,
  todayKey: string,
): ChallengeState {
  if (todayKey < startDate) return 'upcoming';
  if (todayKey > endDate) return 'finished';
  return 'active';
}

/** Whether a finished challenge has a clear winner (top progress > 0 and unique). */
export function challengeWinner(
  rows: ChallengeLeaderRow[],
): ChallengeLeaderRow | null {
  const ranked = [...rows].sort((a, b) => b.progress - a.progress);
  const top = ranked[0];
  if (!top || top.progress <= 0) return null;
  const tie = ranked[1] && ranked[1].progress === top.progress;
  return tie ? null : top;
}

// Metric display metadata — label + unit + whether it's a self-report metric.
// `unit: 'meters'` means the raw target is in meters; the web layer converts to
// the user's km/mi at display time via the shared unit helpers (never stored).
export const CHALLENGE_METRICS: Record<
  ChallengeMetric,
  { label: string; unit: 'meters' | 'count' | 'days' | 'points'; selfReport: boolean }
> = {
  distance: { label: 'Distance', unit: 'meters', selfReport: false },
  run_count: { label: 'Runs', unit: 'count', selfReport: false },
  reps: { label: 'Reps', unit: 'count', selfReport: false },
  workout_count: { label: 'Workouts', unit: 'count', selfReport: false },
  habit_days: { label: 'Habit days', unit: 'days', selfReport: false },
  score: { label: 'Score', unit: 'points', selfReport: false },
  check_in: { label: 'Check-ins', unit: 'count', selfReport: true },
};

// One-tap creation templates (spec §5). `targetMeters`/`target` are raw canonical
// values; `days` is the window length the web pre-fills from "today".
export interface ChallengeTemplate {
  id: string;
  title: string;
  emoji: string;
  metric: ChallengeMetric;
  target: number;
  days: number;
  description?: string;
}

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  { id: 'most-km-week', title: 'Most km this week', emoji: '🏃', metric: 'distance', target: 30_000, days: 7 },
  { id: 'stretch-streak', title: '7-day habit streak', emoji: '🧘', metric: 'habit_days', target: 7, days: 7 },
  { id: 'do-video-3x', title: 'Do this video 3×', emoji: '📺', metric: 'check_in', target: 3, days: 7, description: 'Everyone does this workout three times.' },
  { id: 'five-workouts', title: '5 workouts this week', emoji: '💪', metric: 'workout_count', target: 5, days: 7 },
  { id: 'top-score', title: 'Highest score this week', emoji: '🏆', metric: 'score', target: 200, days: 7 },
  { id: 'run-streak-5', title: '5 runs this week', emoji: '👟', metric: 'run_count', target: 5, days: 7 },
  { id: 'pushup-month', title: '1000 reps this month', emoji: '🔢', metric: 'reps', target: 1000, days: 30, description: 'Rack up 1000 reps any way you like.' },
  { id: 'marathon-month', title: '100 km this month', emoji: '🏅', metric: 'distance', target: 100_000, days: 30 },
];

// ── YouTube normalisation ────────────────────────────────────────────────────
// Accept the three URL shapes users paste (youtu.be/ID, watch?v=ID, shorts/ID)
// and return a canonical embeddable URL. Returns null for anything that isn't a
// recognisable YouTube video id, so a bad paste never embeds a broken iframe.

const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function extractYouTubeId(input: string): string | null {
  const url = input.trim();
  if (!url) return null;

  // Bare id pasted directly.
  if (YT_ID_RE.test(url)) return url;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '');
  let id: string | null = null;

  if (host === 'youtu.be') {
    id = parsed.pathname.slice(1).split('/')[0] ?? null;
  } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    if (parsed.pathname === '/watch') {
      id = parsed.searchParams.get('v');
    } else if (parsed.pathname.startsWith('/shorts/')) {
      id = parsed.pathname.split('/')[2] ?? null;
    } else if (parsed.pathname.startsWith('/embed/')) {
      id = parsed.pathname.split('/')[2] ?? null;
    }
  }

  return id && YT_ID_RE.test(id) ? id : null;
}

/** Canonical watch URL we store, or null if the input isn't a YouTube video. */
export function normalizeYouTubeUrl(input: string): string | null {
  const id = extractYouTubeId(input);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

/** Privacy-friendly embed URL for the iframe (derived from a stored url/id). */
export function youTubeEmbedUrl(input: string): string | null {
  const id = extractYouTubeId(input);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}
