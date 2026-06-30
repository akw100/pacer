import OpenAI from 'openai';
import { z } from 'zod';
import type { AssistantChatMessage } from '@pacer/shared';
import { env } from './env';

// Pacer Coach — the server-side LLM glue for /assistant/chat.
//
// EVERY tool here is READ-ONLY. The catalog lives in this file only (never
// exported to the shared package); the executor calls existing Pacer
// endpoints with the CALLER'S JWT (not service-role), so RLS and identity
// behave exactly as if the user hit those endpoints themselves. The LLM
// never sees the JWT, and we never log the user's message content.
//
// Stateless: no chat history persistence. The client sends the full
// conversation on every request; we forward it to OpenAI Responses API and
// return the next assistant message.

// ── Tool catalog (server-only) ─────────────────────────────────────────

const TOOL_NAMES = [
  'get_score_summary',
  'get_recent_activity',
  'get_friends_leaderboard',
  'get_my_groups',
] as const;
type ToolName = (typeof TOOL_NAMES)[number];

const TOOL_NAME_SET = new Set<string>(TOOL_NAMES);

interface ToolDef {
  name: ToolName;
  description: string;
  parameters: object;
}

const TOOLS: ToolDef[] = [
  {
    name: 'get_score_summary',
    description:
      "The caller's weekly score, lifetime score, and current activity streak (whole days).",
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'get_recent_activity',
    description:
      "The caller's logged runs and workouts within the last N days. Default 7. Max 30.",
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'integer', minimum: 1, maximum: 30, default: 7 },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'get_friends_leaderboard',
    description:
      'Current-week comparison: the caller plus accepted friends — distance (meters), runs, workouts, score per person, with the caller\'s rank if computable.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'get_my_groups',
    description:
      "The list of groups the caller belongs to. Each entry has id, name, and member_count.",
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
];

// ── System prompt ──────────────────────────────────────────────────────

const SYSTEM_PROMPT = [
  'You are "Pacer Coach", a read-only assistant inside the Pacer fitness app.',
  '',
  'Strict rules:',
  "- You can ONLY read the caller's own data via the provided tools.",
  '- You CANNOT create, edit, delete, log, check, accept, decline, or otherwise',
  '  change anything. If the user asks for any write action, explain that Pacer',
  '  Coach is read-only in v1 and direct them to the in-app buttons (Log run,',
  '  Log workout, Habits, etc.).',
  "- You never see other users' data beyond what the tools return as aggregates.",
  '- If a tool returns no data, say so honestly. Never fabricate numbers, names,',
  '  dates, or activities.',
  '- Distances are stored in meters; convert to km in your answers',
  '  (1 km = 1000 m). Times are stored in seconds.',
  '- Be concise, warm, and specific. One short paragraph or a tiny list when it',
  '  helps. Avoid filler.',
  '- Refuse politely if asked to do anything outside fitness coaching or',
  '  anything that requires writing data.',
].join('\n');

// ── Tool executor ──────────────────────────────────────────────────────

const API_BASE =
  (process.env['API_INTERNAL_URL'] ?? `http://localhost:${env.port}`).replace(/\/$/, '');

/** Lightweight per-tool args validators. We accept the LLM-supplied JSON
 *  object and parse it via zod before calling the executor — invalid args
 *  become tool errors the LLM can react to, not server crashes. */
const TOOL_ARG_SCHEMAS: Record<ToolName, z.ZodTypeAny> = {
  get_score_summary: z.object({}).strict().default({}),
  get_recent_activity: z
    .object({ days: z.number().int().min(1).max(30).optional() })
    .strict()
    .default({}),
  get_friends_leaderboard: z.object({}).strict().default({}),
  get_my_groups: z.object({}).strict().default({}),
};

async function callPacer<T>(path: string, callerJwt: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${callerJwt}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Pacer ${path} → ${res.status} ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function execTool(
  name: ToolName,
  rawArgs: unknown,
  callerJwt: string,
): Promise<unknown> {
  const parsed = TOOL_ARG_SCHEMAS[name].safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return { error: 'invalid_arguments', issues: parsed.error.flatten() };
  }
  const args = parsed.data as Record<string, unknown>;

  switch (name) {
    case 'get_score_summary':
      return callPacer('/score/summary', callerJwt);

    case 'get_recent_activity': {
      const days = typeof args['days'] === 'number' ? (args['days'] as number) : 7;
      const today = new Date();
      const start = new Date(today);
      start.setDate(start.getDate() - (days - 1));
      const from = toDateKey(start);
      const to = toDateKey(today);
      const [runs, workouts] = await Promise.all([
        callPacer<unknown[]>(`/runs?from=${from}&to=${to}`, callerJwt),
        callPacer<unknown[]>(`/workouts?from=${from}&to=${to}`, callerJwt),
      ]);
      return { from, to, runs, workouts };
    }

    case 'get_friends_leaderboard':
      return callPacer('/friends/leaderboard', callerJwt);

    case 'get_my_groups':
      return callPacer('/groups', callerJwt);
  }
}

// ── Tool loop driver ──────────────────────────────────────────────────

const MAX_ITERATIONS = 3;

interface RunAssistantResult {
  message: { role: 'assistant'; content: string };
  tools_used: string[];
}

let _client: OpenAI | null = null;
function openai(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: env.openaiKey });
  return _client;
}

/** Map our internal tool catalog to the OpenAI Responses API tool shape. */
function tools_for_openai(): Array<{
  type: 'function';
  name: string;
  description: string;
  parameters: object;
}> {
  return TOOLS.map((t) => ({
    type: 'function',
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

/** OpenAI input items are loosely typed in v6; we keep an internal alias
 *  so the body of `runAssistant` stays readable without sprinkling
 *  `as never` everywhere. */
type ResponseInputItem = Record<string, unknown>;

export async function runAssistant(
  messages: AssistantChatMessage[],
  callerJwt: string,
): Promise<RunAssistantResult> {
  const client = openai();
  const model = env.openaiChatModel;

  const input: ResponseInputItem[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const toolsUsed: string[] = [];

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const response = await client.responses.create({
      model,
      instructions: SYSTEM_PROMPT,
      input: input as never,
      tools: tools_for_openai() as never,
      tool_choice: 'auto',
    });

    type OutputItem = {
      type: string;
      role?: string;
      content?: Array<{ type: string; text?: string }>;
      name?: string;
      arguments?: string;
      call_id?: string;
    };
    const output = (response.output ?? []) as OutputItem[];

    const fnCalls = output.filter((it) => it.type === 'function_call');
    if (fnCalls.length === 0) {
      const text = extractText(output);
      return { message: { role: 'assistant', content: text }, tools_used: toolsUsed };
    }

    // Execute each function call; append both the call and its output to
    // the input array so the next iteration sees the loop's history.
    for (const fc of fnCalls) {
      const name = fc.name ?? '';
      let argsObj: unknown = {};
      try {
        argsObj = fc.arguments ? JSON.parse(fc.arguments) : {};
      } catch {
        argsObj = { error: 'arguments_json_parse_failed' };
      }

      // Server-side allowlist: never execute a tool not in the catalog.
      let result: unknown;
      if (!TOOL_NAME_SET.has(name)) {
        result = { error: 'unknown_tool', tool: name };
      } else {
        toolsUsed.push(name);
        try {
          result = await execTool(name as ToolName, argsObj, callerJwt);
        } catch (err) {
          result = { error: 'tool_execution_failed', message: err instanceof Error ? err.message : 'unknown' };
        }
      }

      input.push({
        type: 'function_call',
        call_id: fc.call_id,
        name,
        arguments: fc.arguments ?? '{}',
      });
      input.push({
        type: 'function_call_output',
        call_id: fc.call_id,
        output: JSON.stringify(result),
      });
    }
  }

  // If we hit the iteration cap, ask the model one more time to summarize
  // what it has — without tools — so the user always gets a reply.
  const final = await openai().responses.create({
    model,
    instructions: SYSTEM_PROMPT,
    input: input as never,
  });
  type OutputItem = {
    type: string;
    role?: string;
    content?: Array<{ type: string; text?: string }>;
  };
  const text = extractText((final.output ?? []) as OutputItem[]);
  // Never hand the UI an empty bubble — if the model returned nothing parseable
  // (e.g. an unexpected output shape), say so instead of rendering blank.
  const content = text || "Sorry — I couldn't put together a reply just then. Mind trying again?";
  return { message: { role: 'assistant', content }, tools_used: toolsUsed };
}

function extractText(
  output: Array<{ type: string; role?: string; content?: Array<{ type: string; text?: string; refusal?: string }> }>,
): string {
  for (const item of output) {
    if (item.type === 'message' && item.role === 'assistant' && Array.isArray(item.content)) {
      const parts: string[] = [];
      for (const c of item.content) {
        if ((c.type === 'output_text' || c.type === 'text') && typeof c.text === 'string') {
          parts.push(c.text);
        } else if (c.type === 'refusal' && typeof c.refusal === 'string') {
          // A refusal is still a message to show the user, not an empty reply.
          parts.push(c.refusal);
        }
      }
      if (parts.length) return parts.join('').trim();
    }
  }
  return '';
}
