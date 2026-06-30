import { WorkoutDraftSchema, type WorkoutDraft } from './workoutDraft';
import { openai } from '../lib/openai';

const MODEL = 'gpt-4o-mini';

// JSON-schema the model must satisfy. Mirrors RUN_JSON_SCHEMA in parse.ts:
// every property is required (strict mode) and nullable where unknown.
const WORKOUT_JSON_SCHEMA = {
  name: 'workout_draft',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string' },
      kind: { type: 'string', enum: ['strength', 'mobility', 'swim', 'bike', 'other'] },
      sets: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            exercise_name: { type: 'string' },
            sets: { type: 'integer' },
            reps: { type: 'integer' },
            weight: { type: ['number', 'null'] },
          },
          required: ['exercise_name', 'sets', 'reps', 'weight'],
        },
      },
      duration_seconds: { type: ['integer', 'null'] },
      workout_date: { type: ['string', 'null'], description: 'yyyy-mm-dd if stated, else null' },
      confidence: { type: 'number', description: '0..1 confidence in the extraction' },
    },
    required: ['name', 'kind', 'sets', 'duration_seconds', 'workout_date', 'confidence'],
  },
} as const;

const SYSTEM =
  'Extract a single strength/mobility/cardio workout from the input. ' +
  'Weights in kg; set/rep counts as integers. Use null for unknown fields. confidence 0..1.';

/** Validate the model's JSON string against WorkoutDraftSchema. Throws on bad shape. */
export function parseWorkoutDraftJson(raw: string): WorkoutDraft {
  const obj = JSON.parse(raw) as Record<string, unknown>;
  // The model occasionally emits workout_date as prose ("today") instead of
  // yyyy-mm-dd. Our schema requires the strict format; treat anything malformed
  // as absent — draftToWorkoutCreate defaults workout_date to today.
  if (typeof obj['workout_date'] === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(obj['workout_date'])) {
    obj['workout_date'] = null;
  }
  return WorkoutDraftSchema.parse(obj);
}

/** Parse free text into a WorkoutDraft via OpenAI structured output. */
export async function parseWorkout(message: string, today: string): Promise<WorkoutDraft> {
  const sys = `${SYSTEM} Today is ${today}.`;
  const res = await openai().chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_schema', json_schema: WORKOUT_JSON_SCHEMA },
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: message },
    ],
  });
  return parseWorkoutDraftJson(res.choices[0]?.message.content ?? '');
}

/** Parse a workout-board/whiteboard photo into a WorkoutDraft via OpenAI vision. */
export async function parseWorkoutPhoto(imageUrl: string, today: string): Promise<WorkoutDraft> {
  const sys = `${SYSTEM} Today is ${today}.`;
  const res = await openai().chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_schema', json_schema: WORKOUT_JSON_SCHEMA },
    messages: [
      { role: 'system', content: sys },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract the workout shown in this image.' },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
  });
  return parseWorkoutDraftJson(res.choices[0]?.message.content ?? '');
}
