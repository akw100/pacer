// Invite-code generator for private groups. Pure — caller passes its own
// randomness source so the function is deterministic + testable. Alphabet
// excludes the four letters humans mis-read on a phone screen:
// 0/O, 1/I/L (and lowercase to avoid case issues over chat).

export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPRSTVWXYZ23456789' as const;
export const JOIN_CODE_LENGTH = 6;

/**
 * Build a 6-char join code from the restricted alphabet. The `rand` callback
 * returns a float in [0, 1) (Math.random by default). Use a crypto-backed
 * source in production callers; this signature lets callers swap it without
 * pulling Node-only `crypto` into the shared package.
 */
export function generateJoinCode(rand: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    const idx = Math.floor(rand() * JOIN_CODE_ALPHABET.length);
    code += JOIN_CODE_ALPHABET[idx];
  }
  return code;
}
