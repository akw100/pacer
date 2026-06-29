import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLinkCode, LINK_CODE_ALPHABET } from './linkCode';

test('generateLinkCode is 8 chars from the unambiguous alphabet', () => {
  for (let i = 0; i < 200; i++) {
    const code = generateLinkCode();
    assert.equal(code.length, 8);
    for (const ch of code) assert.ok(LINK_CODE_ALPHABET.includes(ch), `bad char ${ch}`);
  }
});

test('alphabet excludes ambiguous characters', () => {
  for (const ch of ['I', 'L', 'O', '0', '1']) {
    assert.ok(!LINK_CODE_ALPHABET.includes(ch));
  }
});
