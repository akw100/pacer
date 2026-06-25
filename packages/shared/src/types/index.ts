// Domain types not derived from a zod schema — the canonical scalars the
// unit/date helpers and entity schemas share so there's one source of truth.

export type Units = 'km' | 'mi';

// Matches profiles.week_start: 0 = Sunday, 1 = Monday.
export type WeekStart = 0 | 1;
