// 8-char human-readable codes, excluding I/L/O/0/1 to avoid misreads when a
// user types the code from the app into Telegram.
export const LINK_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateLinkCode(): string {
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += LINK_CODE_ALPHABET[Math.floor(Math.random() * LINK_CODE_ALPHABET.length)];
  }
  return out;
}
