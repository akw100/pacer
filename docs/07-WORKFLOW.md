# 07 — Git workflow

## Branches
| Branch | Role | Deploys to | How it's updated |
| --- | --- | --- | --- |
| `main` | **production** | Railway production | **only** by merging a PR from `dev` |
| `dev` | **staging / integration** | Railway staging | **only** by merging a PR from a feature branch |
| `feat/<NN>-<slug>` | one task card | — | your day-to-day work; branched off `dev` |

`fix/<slug>` for bug fixes, `chore/<slug>` for tooling. **One task card = one branch = one PR.**

**Nobody pushes to `main` or `dev` directly — ever.** This is enforced three ways: the `pre-push`
hook (local), GitHub branch protection (server), and code review. If you find yourself typing
`git push origin main`, stop — open a PR.

## The loop (use the skills — they do the steps for you)
1. **/new-task** — pulls latest `dev`, creates `feat/<NN>-<slug>`, orients you on the card.
2. Build. Commit in small, clear steps. Run `pnpm typecheck` as you go.
3. **/open-pr** — runs the typecheck gate, pushes your branch, opens a PR **into `dev`** with the
   card's acceptance-criteria checklist (from `.github/PULL_REQUEST_TEMPLATE.md`).
4. A teammate reviews; CI (`typecheck`) must be green. Merge into `dev` (squash). Delete the branch.
5. `dev` auto-deploys to **staging** — glance at it there.
6. When a verified batch is ready, **/ship-to-prod** opens the release PR `dev` → `main`. Merging
   it deploys production.

## Pull request rules
- Base = `dev` for normal work; base = `main` only for a release PR from `dev`.
- Keep PRs to one card's scope. If you touched files outside your card's ownership, that's a smell —
  see `08-CONVENTIONS.md`.
- Fill the template: link the card, tick the acceptance criteria, tick the merge-safety checklist.
- Don't merge on red CI. Don't merge someone else's PR without a look.

## Commits
- Small and present-tense: `feat(logging): run form`, `fix(groups): join-code collision`, `chore: ci`.
- Never commit `.env`, keys, or `node_modules` (the `.gitignore` + `pre-commit` hook stop you).
- Never edit a migration that's already merged — add a new timestamped one.

## Releasing to production
1. Confirm staging (the `dev` deploy) is healthy.
2. `/ship-to-prod` → review `git log origin/main..origin/dev` (exactly what's shipping) → open the PR.
3. Merge = deploy. Tag if you like: `git tag v1.0 && git push --tags`.

## Hotfixes
Production bug? Branch off `main` as `fix/<slug>`, PR **into `main`**, merge (deploys prod), then
**merge `main` back into `dev`** so the two don't drift.

## One-time repo setup (whoever creates the GitHub repo)
```bash
git switch -c dev && git push -u origin dev
git switch main   && git push -u origin main
./scripts/protect-branches.sh <owner>/<repo>   # PR-only on main & dev (needs gh admin)
```
The git hooks need **no** setup step — they self-activate on each teammate's first `pnpm install`
(a root `prepare` script points git at `.githooks/`).
`protect-branches.sh` sets: `main` requires 1 approving review + no direct/force push; `dev` requires
a PR (0 reviews, so a solo dev self-merges fast) + no force push. Once CI passes once, make the
`typecheck` check required (instructions printed by the script). If GitHub refuses protection on a
free private repo, the `pre-push` hook + review discipline are the fallback (or make the repo public).
