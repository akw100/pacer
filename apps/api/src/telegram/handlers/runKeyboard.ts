import { InlineKeyboard } from 'grammy';

export function buildRunKeyboard(groups: { id: string; name: string }[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text('➖0.5km', 'redit:dm:-500').text('➕0.5km', 'redit:dm:500').row();
  kb.text('➖1min', 'redit:ds:-60').text('➕1min', 'redit:ds:60').row();
  for (const g of groups) kb.text(`✓ Save to ${g.name}`, `save:${g.id}`).row();
  kb.text(groups.length ? '✓ Save (just me)' : '✓ Save', 'save').row();
  kb.text('✗ Discard', 'discard');
  return kb;
}
