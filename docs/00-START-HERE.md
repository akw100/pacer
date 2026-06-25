# 00 — Start here

Four people are building Pacer in parallel, at different speeds, and nobody knows in advance who
finishes what when. This doc is how that works without stepping on each other. Read it once; it's short.

## The shape of the work

The build is **one short shared phase, then a wide parallel phase.**

1. **Foundation (cards 01–03) is the only thing that must happen first and together.** It scaffolds
   the monorepo and — crucially — defines the **contracts** every other task builds against (the
   shared zod schemas + helpers, the event bus, `broadcast()`, the route/section registries, the
   theme tokens). Until it's merged to `dev`, nobody else can really start.
2. **After that, every other card is an independent vertical slice.** Each owns its own files and
   talks to the rest only through those contracts. So slices can be built in any order, by anyone,
   and merged to `dev` the moment they're done — no waiting on each other.

This is why the order in `docs/05-ROADMAP.md` is **suggested**, not a schedule. The only hard rule
is *foundation first*. The MVP-first ordering tells you what's worth building **first** (the core
loop), not what blocks what.

## How to actually start (day 0)

- **One or two people sprint the foundation (cards 01 → 02 → 03)** and merge it to `dev` fast.
  It's mostly scaffolding — quick with Claude. These three are sequential (02 needs 01, 03 needs both).
- **Everyone else, in parallel:** read your slice's card and `docs/08-CONVENTIONS.md`, and draft your
  migration + zod schema against the contracts (they're spelled out in card 01) so you're ready to
  move the instant foundation lands.
- The moment foundation is on `dev`: everyone runs **/new-task**, picks a card from `docs/05-ROADMAP.md`,
  and goes.

## The daily loop (every task, every person)

1. **/new-task** → pulls latest `dev`, makes your `feat/<NN>-<slug>` branch, orients you on the card.
2. Build the slice (each card has a copy-paste kickoff prompt for Claude). Commit in small steps.
3. **/open-pr** → runs `pnpm typecheck`, pushes your branch, opens a PR into `dev` with the card's checklist.
4. Teammate gives it a quick look; CI (typecheck) must be green; merge into `dev`.
5. `dev` auto-deploys to **staging** → glance at it there.
6. When a batch on staging is solid, **/ship-to-prod** opens the release PR `dev` → `main` → production.

**Never push to `main` or `dev` directly.** Everything is a PR. (Hooks + branch protection enforce it.)

## When to run `/init`

`/init` writes/refreshes `CLAUDE.md` by reading the codebase. Timing matters:

- **Not now.** There's no app code yet, so it would have nothing to document — and `CLAUDE.md`
  already contains the house rules (which `/init` can't infer anyway).
- **Run it once, right after the foundation scaffold is merged to `dev` and you've pulled it** — then
  it can document the real structure (workspaces, commands, where things live) accurately for everyone.
- **Re-run after a big structural change** (a new app, a major reorg). Day-to-day feature work doesn't need it.
- **When you run it:** review the diff. Keep the hand-maintained *house rules* block at the top of
  `CLAUDE.md`; let `/init` add its "structure/commands" section below it. Don't let it delete the rules.

## Where everything is
- **Who's doing what (live task board):** [team Google Sheet](https://docs.google.com/spreadsheets/d/11e9WA84H1X96eUobMgahIMpeBUjhbPIx_4jaMnMDQhY/edit) — claim a task by putting your name in **אחראי** and set **סטטוס**. Mirrors `docs/TASKS.csv` (Hebrew, with a copy-paste kickoff prompt per task).
- **What to build & in what order:** `docs/05-ROADMAP.md` + the task rows in the [team Google Sheet](https://docs.google.com/spreadsheets/d/11e9WA84H1X96eUobMgahIMpeBUjhbPIx_4jaMnMDQhY/edit).
- **How we work (branches/PRs):** `docs/07-WORKFLOW.md`.
- **How not to collide (packages, theme, merge-safety):** `docs/08-CONVENTIONS.md`.
- **How it deploys:** `docs/09-DEPLOY.md`.
- **Product/design/data:** `docs/01-SPECS.md`, `02-PAGES-UX.md`, `03-STITCH-PROMPT.md`, `04-DATA-MODEL.md`, `06-TECH-STACK.md`.
