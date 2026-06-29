import { z } from 'zod';
import { openai } from '../lib/openai';

const MODEL = 'gpt-4o-mini';

export const IntentSchema = z.object({
  intent: z.enum(['run', 'workout', 'habit', 'none']),
  confidence: z.number().min(0).max(1),
});
export type Intent = z.infer<typeof IntentSchema>;

const INTENT_JSON_SCHEMA = {
  name: 'intent',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      intent: { type: 'string', enum: ['run', 'workout', 'habit', 'none'] },
      confidence: { type: 'number' },
    },
    required: ['intent', 'confidence'],
  },
} as const;

/** Validate the model's JSON string against IntentSchema. Throws on bad shape. */
export function parseIntentJson(raw: string): Intent {
  return IntentSchema.parse(JSON.parse(raw));
}

/** Classify a free-text message: run (a run), workout (strength/gym), habit (daily habit check-in), or none. */
export async function parseIntent(message: string, habitNames: string[]): Promise<Intent> {
  const sys =
    'Classify the message as one of: run (a run/jog with distance+time), ' +
    'workout (strength/gym/mobility/swim/bike session), habit (a short daily-habit check-in like "stretched today"), ' +
    `or none. The user's habits are: ${JSON.stringify(habitNames)}. Reply with the intent and confidence 0..1.`;
  const res = await openai().chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_schema', json_schema: INTENT_JSON_SCHEMA },
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: message },
    ],
  });
  return parseIntentJson(res.choices[0]?.message.content ?? '');
}
