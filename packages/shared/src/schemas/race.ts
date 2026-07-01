import { z } from 'zod';
export const RaceStatusSchema = z.enum(['lobby', 'active', 'finished', 'cancelled']);
export type RaceStatus = z.infer<typeof RaceStatusSchema>;
export const ParticipantRoleSchema = z.enum(['runner', 'spectator']);
export type ParticipantRole = z.infer<typeof ParticipantRoleSchema>;
export const ParticipantStateSchema = z.enum(['invited', 'joined', 'ready', 'racing', 'finished', 'dnf']);
export type ParticipantState = z.infer<typeof ParticipantStateSchema>;
export const RaceSchema = z.object({
  id: z.string().uuid(), creator_id: z.string().uuid(), target_meters: z.number().int().positive(),
  status: RaceStatusSchema, start_at: z.string().nullable(), finished_at: z.string().nullable(),
  winner_id: z.string().uuid().nullable(), rematch_of: z.string().uuid().nullable(), created_at: z.string(),
});
export type Race = z.infer<typeof RaceSchema>;
export const RaceParticipantSchema = z.object({
  race_id: z.string().uuid(), user_id: z.string().uuid(), role: ParticipantRoleSchema, state: ParticipantStateSchema,
  final_meters: z.number().nullable(), finished_at: z.string().nullable(), elapsed_seconds: z.number().nullable(),
  manual_finish: z.boolean(), run_id: z.string().uuid().nullable(), joined_at: z.string(),
});
export type RaceParticipant = z.infer<typeof RaceParticipantSchema>;
export const CreateRaceInputSchema = z.object({ target_meters: z.number().int().positive() });
export type CreateRaceInput = z.infer<typeof CreateRaceInputSchema>;
export const InviteInputSchema = z.object({ userIds: z.array(z.string().uuid()).min(1) });
export type InviteInput = z.infer<typeof InviteInputSchema>;
export const JoinInputSchema = z.object({ role: ParticipantRoleSchema.default('runner') });
export type JoinInput = z.infer<typeof JoinInputSchema>;
export const FinishInputSchema = z.object({ final_meters: z.number().positive(), manual: z.boolean().default(false) });
export type FinishInput = z.infer<typeof FinishInputSchema>;
