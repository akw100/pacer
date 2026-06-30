import { toFile } from 'openai';
import { openai } from '../lib/openai';

/** Transcribe an audio buffer (Telegram voice = OGG/Opus) to text via Whisper. */
export async function transcribe(audio: ArrayBuffer, filename = 'voice.oga'): Promise<string> {
  const file = await toFile(Buffer.from(audio), filename);
  const res = await openai().audio.transcriptions.create({ model: 'whisper-1', file });
  return res.text.trim();
}
