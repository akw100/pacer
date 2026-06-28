import { serviceClient } from '../../lib/supabase';

/**
 * Today's date as yyyy-mm-dd in the app's timezone. The bot has no per-message
 * clock from the user, and the server runs in UTC — so a run logged late at
 * night would land on the previous UTC day and fall outside the user's local
 * week in the app. Set APP_TIMEZONE to an IANA zone (e.g. 'Asia/Jerusalem') so
 * the date matches what the user (and the web app, which buckets locally) sees.
 * Defaults to UTC; an invalid zone falls back to UTC rather than breaking saves.
 */
export function today(): string {
  const tz = process.env['APP_TIMEZONE'];
  if (!tz || tz === 'UTC') return new Date().toISOString().slice(0, 10);
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** The Pacer user linked to a Telegram user id, or null if unlinked. */
export async function linkedUserId(telegramUserId: number): Promise<string | null> {
  const { data } = await serviceClient()
    .from('telegram_links')
    .select('user_id')
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle();
  return (data?.user_id as string) ?? null;
}
