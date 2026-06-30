import { serviceClient } from '../../lib/supabase';
import { todayKey } from '../../lib/today';

/** Today's date as yyyy-mm-dd in the app's timezone (see lib/today). */
export function today(): string {
  return todayKey();
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

/** The user's distance-unit preference (km|mi); defaults to 'km' if unset. */
export async function userUnits(userId: string): Promise<'km' | 'mi'> {
  const { data } = await serviceClient()
    .from('profiles')
    .select('units')
    .eq('id', userId)
    .maybeSingle();
  return (data?.units as 'km' | 'mi' | null) ?? 'km';
}

/** Names of the user's habits (for intent classification + matching). */
export async function habitNames(userId: string): Promise<string[]> {
  const { data } = await serviceClient().from('habits').select('name').eq('user_id', userId);
  return ((data ?? []) as { name: string }[]).map((h) => h.name);
}

/** Groups the user belongs to (id + name) — drives the share-to-group buttons. */
export async function userGroups(userId: string): Promise<{ id: string; name: string }[]> {
  const { data } = await serviceClient()
    .from('group_members')
    .select('group_id, groups!inner(name)')
    .eq('user_id', userId);
  type Row = { group_id: string; groups: { name: string } };
  return ((data ?? []) as unknown as Row[]).map((r) => ({ id: r.group_id, name: r.groups.name }));
}
