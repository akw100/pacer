import { z } from 'zod';
import { openai } from '../lib/openai';

const MODEL = 'gpt-4o-mini';

export const HabitMatchSchema = z.object({
  matched: z.boolean(),
  habit_name: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});
export type HabitMatch = z.infer<typeof HabitMatchSchema>;

const HABIT_JSON_SCHEMA = {
  name: 'habit_match',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      matched: { type: 'boolean' },
      habit_name: { type: ['string', 'null'], description: 'exact name from the provided list, or null' },
      confidence: { type: 'number' },
    },
    required: ['matched', 'habit_name', 'confidence'],
  },
} as const;

/** Validate the model's JSON string against HabitMatchSchema. Throws on bad shape. */
export function parseHabitJson(raw: string): HabitMatch {
  return HabitMatchSchema.parse(JSON.parse(raw));
}

/** Decide if `message` is a check-in for one of the user's habits. */
export async function parseHabit(message: string, habitNames: string[]): Promise<HabitMatch> {
  const sys =
    "Decide if the message reports completing one of the user's habits today. " +
    `Habits: ${JSON.stringify(habitNames)}. ` +
    'Set matched true only if it clearly matches one; habit_name must be EXACTLY one of the listed names or null.';
  const res = await openai().chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_schema', json_schema: HABIT_JSON_SCHEMA },
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: message },
    ],
  });
  return parseHabitJson(res.choices[0]?.message.content ?? '');
}
