import { RunDraftSchema, type RunDraft } from './draft';
import { openai } from '../lib/openai';

const MODEL = 'gpt-4o-mini';

// JSON-schema the model must satisfy. Units are explicit so the model returns
// canonical meters & seconds, never display values.
const RUN_JSON_SCHEMA = {
  name: 'run_draft',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      distance_meters:  { type: 'number', description: 'total distance in METERS' },
      duration_seconds: { type: 'integer', description: 'total duration in SECONDS' },
      run_date:         { type: ['string', 'null'], description: 'yyyy-mm-dd if stated, else null' },
      pace:             { type: ['string', 'null'], description: 'pace text if shown, else null' },
      confidence:       { type: 'number', description: '0..1 confidence in the extraction' },
    },
    required: ['distance_meters', 'duration_seconds', 'run_date', 'pace', 'confidence'],
  },
} as const;

const SYSTEM =
  'Extract a single run from the input. Distance in METERS, duration in SECONDS. ' +
  'If the input is not a run, set confidence to 0. Use null for unknown fields.';

/** Validate the model's JSON string against RunDraftSchema. Throws on bad shape. */
export function parseRunDraftJson(raw: string): RunDraft {
  return RunDraftSchema.parse(JSON.parse(raw));
}

/** Parse free text into a RunDraft via OpenAI structured output. */
export async function parseText(message: string): Promise<RunDraft> {
  const res = await openai().chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_schema', json_schema: RUN_JSON_SCHEMA },
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: message },
    ],
  });
  return parseRunDraftJson(res.choices[0]?.message.content ?? '');
}

/** Parse a watch/treadmill photo into a RunDraft via OpenAI vision. */
export async function parsePhoto(imageUrl: string): Promise<RunDraft> {
  const res = await openai().chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_schema', json_schema: RUN_JSON_SCHEMA },
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract the run shown on this screen.' },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
  });
  return parseRunDraftJson(res.choices[0]?.message.content ?? '');
}
