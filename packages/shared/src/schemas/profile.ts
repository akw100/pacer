import { z } from 'zod';

// Mirrors the `profiles` table (see docs/04-DATA-MODEL.md). The actual table +
// RLS + auth trigger are Foundation B's migration; this is the shared shape.
export const ProfileSchema = z.object({
  id: z.string().uuid(),
  handle: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-z0-9_]+$/), // case-normalized
  displayName: z.string().min(1),
  units: z.enum(['km', 'mi']),
  theme: z.enum(['light', 'dark']),
  weekStart: z.union([z.literal(0), z.literal(1)]), // Sun | Mon
  avatarEmoji: z.string().optional(),
  nudgePref: z.enum(['off', 'daily', 'weekly']),
  createdAt: z.string().datetime(),
});
export type Profile = z.infer<typeof ProfileSchema>;

// User-editable fields only — the validator `PATCH /profile/me` reuses.
// `id` and `createdAt` are server-managed and never patched.
export const ProfileUpdateSchema = ProfileSchema.pick({
  handle: true,
  displayName: true,
  units: true,
  theme: true,
  weekStart: true,
  avatarEmoji: true,
  nudgePref: true,
}).partial();
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;
