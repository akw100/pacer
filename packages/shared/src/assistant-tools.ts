// STUB ONLY. The tool-name catalog other slices reference. The full tool
// definitions + executor are built later by the Assistant tool-layer card
// (card 10) under packages/shared/src/assistant/ — this file is replaced there.

export type AssistantToolName =
  | 'log_run'
  | 'log_workout'
  | 'check_habit'
  | 'create_challenge'
  | 'get_stats'
  | 'get_leaderboard'
  | 'navigate';

export type AssistantToolDef = {
  name: AssistantToolName;
  description: string;
  parameters: object; // JSON Schema
};

export const ASSISTANT_TOOLS: AssistantToolDef[] = []; // filled by the assistant card
