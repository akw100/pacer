import { z } from 'zod';

export const HabitSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1),
  emoji: z.string().min(1),
  sort: z.number().int().nonnegative(),
  archivedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});

export type Habit = z.infer<typeof HabitSchema>;

export const HabitCreateSchema = HabitSchema.omit({
  id: true,
  userId: true,
  archivedAt: true,
  createdAt: true,
}).partial({
  sort: true,
}).extend({
  name: z.string().min(1),
  emoji: z.string().min(1),
});

export type HabitCreate = z.infer<typeof HabitCreateSchema>;

export const HabitUpdateSchema = HabitSchema.pick({
  name: true,
  emoji: true,
  sort: true,
  archivedAt: true,
}).partial();

export type HabitUpdate = z.infer<typeof HabitUpdateSchema>;

export const HabitCheckSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  habitId: z.string().uuid(),
  checkDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  createdAt: z.string().datetime(),
});

export type HabitCheck = z.infer<typeof HabitCheckSchema>;

export const HabitCheckCreateSchema = z.object({
  habitId: z.string().uuid(),
  checkDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type HabitCheckCreate = z.infer<typeof HabitCheckCreateSchema>;
