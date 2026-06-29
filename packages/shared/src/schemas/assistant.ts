import { z } from 'zod';

// Request/response contract for the Pacer Coach (Assistant) endpoint.
// Tool definitions live SERVER-ONLY in apps/api/src/lib/assistant.ts —
// they're never exported from this shared package.
//
// v1 is read-only and stateless: the client sends the full conversation
// history on every call; the server forwards it to OpenAI and returns the
// next assistant message synchronously.

const ROLE = z.enum(['user', 'assistant']);

export const AssistantChatMessageSchema = z.object({
  role: ROLE,
  content: z.string().trim().min(1).max(2000),
});
export type AssistantChatMessage = z.infer<typeof AssistantChatMessageSchema>;

export const AssistantChatRequestSchema = z.object({
  messages: z.array(AssistantChatMessageSchema).min(1).max(20),
});
export type AssistantChatRequest = z.infer<typeof AssistantChatRequestSchema>;

export const AssistantChatResponseSchema = z.object({
  message: z.object({
    role: z.literal('assistant'),
    content: z.string(),
  }),
  /** Names of tools the assistant invoked while answering. Payloads are
   *  never returned — this is debug breadcrumb only. */
  tools_used: z.array(z.string()),
});
export type AssistantChatResponse = z.infer<typeof AssistantChatResponseSchema>;
