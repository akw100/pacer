// Coachmark tour configuration. Each step finds its anchor via a DOM
// selector (we don't want to add data-coach attributes to other slices'
// files — and DOM selectors gracefully no-op when the anchor isn't on the
// current screen).

export interface CoachmarkStep {
  id: 'fab' | 'score' | 'group-tab';
  /** Multiple selectors tried in order — first hit wins. */
  selectors: string[];
  title: string;
  body: string;
  /** Where the bubble sits relative to the anchor. */
  placement: 'top' | 'bottom' | 'left' | 'right';
}

export const COACHMARK_STEPS: CoachmarkStep[] = [
  {
    id: 'fab',
    selectors: [
      '[data-coach="fab"]',
      'button[aria-label="Log activity"]',
    ],
    title: 'Log anything, one tap away',
    body:
      'This + button is always here. Tap it to log a run, a workout, or a habit — the sheet handles the rest.',
    placement: 'top',
  },
  {
    id: 'score',
    selectors: [
      '[data-coach="score"]',
      '[aria-label^="Weekly points"]',
    ],
    title: 'Your weekly score',
    body:
      'Every logged activity earns points. Your score resets every week — it keeps the competition fresh.',
    placement: 'bottom',
  },
  {
    id: 'group-tab',
    selectors: [
      '[data-coach="group-tab"]',
      'a[href="/group"]',
    ],
    title: 'Compete with your people',
    body:
      'Create or join a group. Tag any activity to it to climb the leaderboard — your personal log stays separate.',
    placement: 'top',
  },
];
