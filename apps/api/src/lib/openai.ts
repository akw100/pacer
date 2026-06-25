import OpenAI from 'openai';

// Single OpenAI client for the platform (bot now; assistant later). Lazily
// constructed so the API boots without a key — callers gate on openaiEnabled().
let _client: OpenAI | null = null;

export function openaiEnabled(): boolean {
  return Boolean(process.env['OPENAI_API_KEY']);
}

export function openai(): OpenAI {
  if (!_client) {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
    _client = new OpenAI({ apiKey });
  }
  return _client;
}
