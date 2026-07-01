import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canSeeChallenge, type VisibilityChallenge } from './challenge-visibility';

const open: VisibilityChallenge = { creator_id: 'creator', audience: 'everyone', group_id: null };
const personal: VisibilityChallenge = { creator_id: 'creator', audience: 'user', group_id: null };
const grouped: VisibilityChallenge = { creator_id: 'creator', audience: 'group', group_id: 'g1' };

test('creator always sees their challenge', () => {
  assert.equal(canSeeChallenge(personal, [], 'creator', []), true);
  assert.equal(canSeeChallenge(grouped, [], 'creator', []), true);
});

test('open challenge is visible to anyone', () => {
  assert.equal(canSeeChallenge(open, [], 'stranger', []), true);
});

test('participant sees a challenge they are in', () => {
  assert.equal(canSeeChallenge(personal, ['invitee'], 'invitee', []), true);
  assert.equal(canSeeChallenge(personal, ['someone-else'], 'invitee', []), false);
});

test('group challenge visible to members of that group only', () => {
  assert.equal(canSeeChallenge(grouped, [], 'member', ['g1']), true);
  assert.equal(canSeeChallenge(grouped, [], 'member', ['g2']), false);
  assert.equal(canSeeChallenge(grouped, [], 'member', []), false);
});

test('non-participant stranger cannot see a personal challenge', () => {
  assert.equal(canSeeChallenge(personal, ['invitee'], 'stranger', ['g1', 'g2']), false);
});
