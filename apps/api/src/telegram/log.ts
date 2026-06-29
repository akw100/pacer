// Minimal structured logger for the bot. One JSON line per event so logs are
// greppable/parseable in Railway. Never throws.
type Fields = Record<string, unknown>;

function emit(level: 'info' | 'warn' | 'error', event: string, fields: Fields = {}): void {
  try {
    const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  } catch {
    console.error(`[telegram] log failed for event ${event}`);
  }
}

export const log = {
  info: (event: string, fields?: Fields) => emit('info', event, fields),
  warn: (event: string, fields?: Fields) => emit('warn', event, fields),
  error: (event: string, fields?: Fields) => emit('error', event, fields),
};
