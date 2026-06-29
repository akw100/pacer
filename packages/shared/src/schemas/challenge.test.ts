import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  challengeState,
  challengeWinner,
  extractYouTubeId,
  normalizeYouTubeUrl,
  youTubeEmbedUrl,
  CreateChallengeInputSchema,
  type ChallengeLeaderRow,
} from './challenge';

test('challengeState: upcoming / active / finished by date-key compare', () => {
  assert.equal(challengeState('2026-07-01', '2026-07-07', '2026-06-30'), 'upcoming');
  assert.equal(challengeState('2026-07-01', '2026-07-07', '2026-07-01'), 'active'); // inclusive start
  assert.equal(challengeState('2026-07-01', '2026-07-07', '2026-07-07'), 'active'); // inclusive end
  assert.equal(challengeState('2026-07-01', '2026-07-07', '2026-07-08'), 'finished');
});

test('extractYouTubeId: all three paste shapes + bare id', () => {
  const id = 'dQw4w9WgXcQ';
  assert.equal(extractYouTubeId(`https://youtu.be/${id}`), id);
  assert.equal(extractYouTubeId(`https://www.youtube.com/watch?v=${id}&t=30s`), id);
  assert.equal(extractYouTubeId(`https://youtube.com/shorts/${id}`), id);
  assert.equal(extractYouTubeId(`https://www.youtube.com/embed/${id}`), id);
  assert.equal(extractYouTubeId(id), id);
});

test('extractYouTubeId: rejects non-YouTube / malformed', () => {
  assert.equal(extractYouTubeId('https://vimeo.com/12345'), null);
  assert.equal(extractYouTubeId('not a url'), null);
  assert.equal(extractYouTubeId('https://youtu.be/tooShort'), null);
  assert.equal(extractYouTubeId(''), null);
});

test('normalize + embed urls are canonical', () => {
  assert.equal(normalizeYouTubeUrl('https://youtu.be/dQw4w9WgXcQ'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(youTubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(normalizeYouTubeUrl('garbage'), null);
});

test('challengeWinner: highest unique progress, else null on tie/zero', () => {
  const rows = (p: number[]): ChallengeLeaderRow[] =>
    p.map((progress, i) => ({
      user_id: `u${i}`,
      display_name: `U${i}`,
      handle: `u${i}`,
      avatar_emoji: null,
      status: 'accepted' as const,
      progress,
    }));
  assert.equal(challengeWinner(rows([30, 10, 5]))?.user_id, 'u0');
  assert.equal(challengeWinner(rows([10, 10, 5])), null); // tie at top
  assert.equal(challengeWinner(rows([0, 0, 0])), null); // nobody progressed
});

test('CreateChallengeInput: audience-conditional required fields', () => {
  const base = { metric: 'distance' as const, target: 30000, start_date: '2026-07-01', end_date: '2026-07-07' };
  assert.equal(CreateChallengeInputSchema.safeParse({ ...base, audience: 'user', target_handle: 'dana' }).success, true);
  assert.equal(CreateChallengeInputSchema.safeParse({ ...base, audience: 'user' }).success, false); // missing handle
  assert.equal(
    CreateChallengeInputSchema.safeParse({ ...base, audience: 'group', group_id: '00000000-0000-0000-0000-000000000000' }).success,
    true,
  );
  assert.equal(CreateChallengeInputSchema.safeParse({ ...base, audience: 'group' }).success, false); // missing group_id
  assert.equal(CreateChallengeInputSchema.safeParse({ ...base, audience: 'everyone' }).success, true);
  // end before start rejected
  assert.equal(
    CreateChallengeInputSchema.safeParse({ ...base, audience: 'everyone', end_date: '2026-06-30' }).success,
    false,
  );
});
