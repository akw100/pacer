import type { ChallengeAudience } from '@pacer/shared';

// Pure mirror of the `can_see_challenge` SQL helper (migration 0012). The route
// reads with the service client (a challenge spans many users), so it enforces
// visibility itself before returning anything. Kept pure + dependency-free so it
// can be unit-tested without a database.

export interface VisibilityChallenge {
  creator_id: string;
  audience: ChallengeAudience;
  group_id: string | null;
}

/**
 * Whether `viewer` may see `challenge`:
 *   - creator always
 *   - audience 'everyone' → anyone (open)
 *   - any participant
 *   - audience 'group' → members of that group
 */
export function canSeeChallenge(
  challenge: VisibilityChallenge,
  participantUserIds: readonly string[],
  viewer: string,
  viewerGroupIds: readonly string[],
): boolean {
  if (challenge.creator_id === viewer) return true;
  if (challenge.audience === 'everyone') return true;
  if (participantUserIds.includes(viewer)) return true;
  if (challenge.audience === 'group' && challenge.group_id && viewerGroupIds.includes(challenge.group_id)) {
    return true;
  }
  return false;
}
