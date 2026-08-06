# FarmRPG Quest Tracker

A static web app for [FarmRPG](https://farmrpg.com) players. Paste your in-game
inventory, pick one or more questlines, and instantly see which quest in each
chain you'll run out of materials on (the "wall point") — no more manually
cross-referencing requirement lists quest by quest.

This is a fan project, not affiliated with FarmRPG. It will never be
monetized. All credit for FarmRPG itself goes to its developers.

> Notice: This project is created with the assistance of [Claude Code](https://claude.com/claude-code).

## How it works

The About page has a full "Getting started" tutorial (`src/lib/tutorial.ts`)
covering all of this in more depth; short version:

1. Optionally paste your "My Profile" page (player stats) first, to unlock
   skill/Tower/NPC-friendship eligibility checks — questlines you're not
   eligible for show LOCKED or UNAVAILABLE badges with tap-to-expand details.
2. Paste your "Help Needed → Completed" page to bulk-mark already-finished
   quests done, so completion counts and quest-to-quest prerequisite checks
   are accurate from the start.
3. Pick one or more questlines from the scrollable, filterable list to build a
   queue — order matters and can be changed by drag-and-drop, since queued
   questlines share one simulated inventory (whichever questline is first in
   the queue gets first claim on scarce shared items).
4. Select all the text on FarmRPG's own Inventory page (browser Ctrl/Cmd+A,
   or the Steam client's Edit > Select All), copy it, and paste it into the
   Inventory box on this site. Separately paste the Bank page (Deposit All /
   Withdraw All figures) to fold your Silver on hand into the simulated
   inventory too, since Silver is tracked as a requirement like any other
   item but isn't on the Inventory page.
5. The app walks each queued questline's quests in order, decrementing the
   shared simulated inventory as each quest's requirements are consumed, and
   reports the first quest in each chain where you don't have enough on hand.
   A combined "Shortfall summary" section rolls up every missing item across
   the whole queue, broken down by questline and quest, with search, mailable/
   maxed filters, and ascending/descending sort by shortfall amount.
   Shortfalls that exceed a known storage cap (from a "MAX ON HAND" line in
   your inventory paste) are flagged as CAPPED, since no amount of farming
   clears those until the cap is raised or the item is spent down elsewhere.
6. Mark quests done as you complete them — progress, inventory, player stats,
   and the questline queue are all saved to `localStorage`, and progress
   (everything except inventory) can be exported/imported as JSON.

## Developing

Install dependencies, then start the dev server:

```sh
npm install
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Testing & checks

```sh
npm run test:unit    # vitest (diff.spec.ts, persistence.spec.ts, types.spec.ts, etc.)
npm run test:e2e      # playwright install && playwright test
npm test              # test:unit --run, then test:e2e
npm run check         # svelte-check / TypeScript
npm run lint          # prettier + eslint
```

## Building & deploying

```sh
npm run build
npm run deploy   # vite build && wrangler pages deploy .svelte-kit/cloudflare
```

Preview the production build with `npm run preview`. Deploys to Cloudflare
Pages manually via `wrangler` (see `api/README.md`) rather than Cloudflare's
git-triggered auto-build, since the generated data files aren't in git.

## Project structure

```
src/lib/quest/
  types.ts             Shared types (Quest, Questline, InventoryEntry) + questKey()
  parsing/
    pasteParsing.ts    Low-level helpers shared by the other parsers (case-insensitive anchor
                       search, comma-number parsing, line splitting) over messy pasted page text
    inventory.ts       Parses a pasted Inventory-page paste into structured items (incl. "MAX ON
                       HAND" storage caps), merges into state
    bank.ts            Parses a pasted Bank-page paste into wallet/bank Silver figures
    completed.ts       Parses a pasted "Completed Requests" paste into a list of quest names
    stats.ts           Parses a pasted "My Profile" page into skill/Tower/NPC-friendship levels
  calc/
    diff.ts            Core calculation: walks questline(s) against inventory, finds the wall
                       point(s) and flags CAPPED shortfalls against known storage caps;
                       diffQuestline (single) and diffQuestlineQueue/aggregateQueueShortfalls (queue)
    eligibility.ts      Checks parsed player stats + quest-to-quest prerequisites against a
                       questline's requirements, producing LOCKED/UNAVAILABLE eligibility state
  storage/
    persistence.ts     localStorage read/write for completed-quest tracking, inventory, player
                       stats, questline queue, dark mode, JSON export/import
    questlinesStore.svelte.ts  Fetches/caches questlines.json + questlines-meta.json once per tab
    itemsStore.svelte.ts       Fetches/caches items.json once per tab
    npcsStore.svelte.ts        Fetches/caches npc.json once per tab, filters out unavailable NPCs
static/
  questlines.json      Generated, not committed — quests grouped into questlines, fetched by the
                       client at runtime
  questlines-meta.json Generated, not committed — metadata about the last data regeneration
  items.json           Generated, not committed — all known item names (for autosuggest/validation)
  npc.json             Hand-seeded, not committed — NPC friendship-level data for eligibility checks
src/lib/
  seo.ts                Site metadata constants + canonicalUrl() helper, used for meta tags/JSON-LD
  faq.ts                 FAQ Q&A pairs, shared by the visible About page section and its JSON-LD
  tutorial.ts             "Getting started" tutorial steps, shared by the About page and its JSON-LD
  changelog.ts           Parses CHANGELOG.md (Keep a Changelog format) for display on /changelog
  paraglide/              Generated i18n runtime (Paraglide/inlang) — do not hand-edit; messages
                         live in messages/en.json and messages/es.json
  ui/
    buttonClass.ts        Shared button/pill/icon Tailwind class variants
    matchesQuery.ts        Case-insensitive substring search predicate
    formatNumber.ts        Thousands-separator formatting for shortfall amounts
    statusColor.ts          Shared status-to-color mapping (Done/Ready/Short/Wall Point)
  components/
    AppHeader.svelte       Title, feedback/import/backup buttons, dark mode toggle
    InventoryPanel.svelte  Inventory table, search, stale-baseline warning
    PlayerStatsPanel.svelte View/hand-edit pasted skill/Tower/NPC levels
    QuestlinePicker.svelte Search/status/eligibility/main-quest filters, questline list,
                          drag-reorderable queue
    ShortfallSummary.svelte Collapsible combined shortfall breakdown, with search/filter/sort
    ResultsList.svelte     Per-questline results table with completion checkboxes
    ImportModal.svelte     4-tab paste importer (player stats/inventory/bank/completed quests)
    ProgressBackupModal.svelte  JSON export/import of completed quests, queue, and player stats
    LoadingOverlay.svelte  Startup hydration-stage spinner
    SiteFooter.svelte      Static footer + changelog/data-freshness links (self-contained)
src/routes/
  +page.svelte          Owns cross-component state (inventory, completion tracking, queue, dark
                       mode, modal-open flags) and wires it into the components above
  about/+page.svelte     "Getting started" tutorial + why-this-exists + FAQ
  changelog/+page.svelte Renders CHANGELOG.md via changelog.ts, grouped by minor version
  credits/+page.svelte   Static credits/acknowledgements page
  layout.css             Tailwind entry + dark mode variant
api/
  fetch-questlines.mjs  Gitignored data-regeneration script — not committed, see api/README.md
```

## Quest data

`static/questlines.json`, `static/items.json`, and `static/npc.json` are
generated (or, for `npc.json`, hand-seeded) and **not committed to this
repo**, and are fetched by the client at runtime rather than bundled into
the page's JS, so each ships as its own cacheable request — see `_headers`
for the cache headers. See `api/README.md` (gitignored, maintainer-only) for
how to regenerate `questlines.json`/`items.json`. Note: "Silver" (in-game
currency) does show up as an item requirement on some quests — that's
expected, not a data bug.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Quest/item data isn't edited via
pull request — use the in-app "Feedback / report an issue" button instead.

## Internationalization

UI strings are managed via [Paraglide](https://inlang.com/m/gerre34r/library-inlang-paraglideJs)
(`messages/en.json`, `messages/es.json`); `src/lib/paraglide/` is generated
from those and shouldn't be hand-edited.
