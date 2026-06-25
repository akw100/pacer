import { serviceClient } from '../../lib/supabase';

/** Today as yyyy-mm-dd (server timezone). */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
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
