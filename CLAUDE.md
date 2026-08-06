# CLAUDE.md — farm-rpg-quest-tracker

Project-specific guidance. See the global `~/.claude/CLAUDE.md` for
cross-project rules (Windows/shell discipline, commit conventions,
verification standard) — those still apply here and aren't repeated below.

## What this project is

FarmRPG Quest Tracker — a SvelteKit static app. Player pastes their FarmRPG
inventory (and optionally player stats, for eligibility checks) and queues
one or more questlines (order matters — they share one inventory). The app
reports the first quest in each chain they can't complete with current
materials, plus a combined shortfall summary across the whole queue. Fan
project, not affiliated with FarmRPG, will never be monetized.

## Data pipeline (read before touching quest/item data)

- `static/questlines.json`, `static/items.json`, and `static/npc.json` are
  **generated, not committed to this repo** — the regeneration script and
  instructions live in `api/` (`api/README.md`, `api/fetch-questlines.mjs`),
  which is itself gitignored in full; don't hand-edit the data files, and
  don't un-gitignore the `api/` directory or its credentials. All three are
  `fetch()`-ed by the client at runtime (`itemsStore.svelte.ts`,
  `questlinesStore.svelte.ts`, `npcsStore.svelte.ts`) rather than statically
  imported, so each ships as its own cacheable request instead of bloating
  the page's JS bundle — see `_headers` (project root) for the cache
  headers. Don't switch any of them back to a static import without
  re-solving that egress problem some other way. `npc.json`'s `isAvailable`
  is a snapshot at fetch time, not a real date range — `npcsStore.svelte.ts`
  filters `isAvailable: false` NPCs out entirely (permanently gone) rather
  than feeding them into the seasonal-gap logic in `eligibility.ts`, which
  needs actual `startDate`/`endDate` values that this data doesn't have.
  `api/fetch-questlines.mjs` doesn't fetch NPC data yet — `static/npc.json`
  is currently seeded by hand from a one-off API response; wire it into the
  fetch script if/when that source is confirmed stable.
  `questlinesStore.svelte.ts` also fetches `static/questlines-meta.json`
  (also generated/gitignored) for `dataLastUpdated`; a missing/malformed meta
  file fails silently rather than surfacing `questlinesError`, since it's
  supplementary.
- A fresh clone won't have those gitignored files. `npm run dev` and
  `npm run test` run a `predev`/`pretest` `seed-data` step
  (`scripts/seed-data.mjs`) that copies committed, synthetic
  `static/questlines.sample.json` / `items.sample.json` / `npc.sample.json`
  into the real filenames **only if they don't already exist** — never
  overwrites real fetched data. See `CONTRIBUTING.md`.
- Questline grouping/ordering and quest identity come from an external
  source's own structure — no title-parsing step derives them. A quest
  belonging to multiple questlines gets a full `Quest` object denormalized
  into each questline's `quests[]`. Titles that wrap onto a second line
  upstream can carry a literal `<br/>`, which must be sanitized to a space
  wherever titles are produced — don't reintroduce the raw `<br/>` into
  `Quest.name`.
- Quests carry no rewards concept — don't add a `rewards` field without
  confirming the upstream source actually has an equivalent.
- A per-quest silver requirement is folded into a synthetic
  `{item: "Silver", qty: requiredSilver}` requirement alongside real item
  requirements, so it participates in shortfall tracking like any other
  item.
- There's no `Quest.label` — the UI shows `seq` (the upstream ordering
  value) instead of a parsed "II"/"Part 2"-style badge.
- Some quests aren't part of any named chain at all (one-off requests) —
  these are grouped under their own title as a singleton questline rather
  than dropped, so every quest that exists ends up somewhere in
  `questlines.json`.

## Svelte / Tailwind gotchas specific to this repo

- `src/routes/layout.css` is a **plain `.css` file imported via JS**, not a
  compiled `.svelte <style>` block. Svelte's `:global()` pseudo-selector has
  no meaning there — using it silently drops the rule (this caused the dark
  mode background bug once). Write plain selectors in that file.
- Dark mode is a `.dark` class on `<html>`, toggled via Tailwind v4's
  `@custom-variant dark (&:where(.dark, .dark *));` in `layout.css`. Persisted
  via `saveDarkMode`/`loadDarkMode` in `persistence.ts`, but only written
  _after_ hydration reads the saved value first — writing before that would
  overwrite a saved preference with the default.
- Icons: use `@lucide/svelte`, **not** the deprecated `lucide-svelte` package.

## Folder layout (`src/lib/quest/`)

- `types.ts` (shared types + `questKey()`) sits at the top level; everything
  else is grouped by concern: `parsing/` (paste parsers), `calc/` (the diff
  engine), `storage/` (localStorage persistence + the questlines fetch
  store). Cross-references below still use bare filenames
  (`diff.ts`, `persistence.ts`, etc.) — resolve them against this layout.

## Core calculation invariants (`src/lib/quest/calc/diff.ts`)

- `walkQuestline` is the shared internal engine: it walks a single questline's
  quests in order against a mutated `Map` inventory, decrementing per
  requirement and flooring at 0 (never negative), so later quests in the
  chain still get meaningful numbers even after a shortfall. Both public
  entry points below call it.
- `diffQuestline(questline, startingInventory, completed)` clones the
  inventory privately before calling `walkQuestline` — use this for a single
  questline.
- `diffQuestlineQueue(questlines, startingInventory, completed)` clones the
  inventory **once** and threads that same mutated `Map` through every
  questline in array order via `walkQuestline` — whichever questline is
  earlier in the queue gets first claim on scarce shared items. This is
  intentionally ordering-dependent; don't "fix" it to diff each questline
  independently.
- Both entry points also take an optional `caps: Map<string, number>`
  (item name → known storage cap, from "MAX ON HAND" lines in an inventory
  paste — see `inventory.ts`). A `Shortfall`'s `capped` flag is set when a
  single requirement exceeds the item's cap — that shortfall can't be
  cleared by farming alone until the cap is raised or the item is spent down
  elsewhere, which the UI surfaces as a distinct CAPPED badge rather than an
  ordinary shortfall.
- `aggregateQueueShortfalls(results)` rolls up each questline's already-
  computed `totalShortfalls` into one queue-wide per-item breakdown
  (`byQuestline` → `byQuest`), without re-walking any inventory.
- Quests already in the `completed` Set are skipped entirely — no requirement
  check, no inventory deduction — since that consumption already happened
  before the current inventory snapshot was taken.
- `totalShortfalls` (chain-level) and `aggregateQueueShortfalls` (queue-level)
  both accumulate through the shared `accumulateShortfall` helper, which
  keeps `needed`/`have`/`short` mutually consistent (`have = needed - short`)
  — a past bug let `needed`/`have` freeze at the first quest's values while
  only `short` kept summing correctly. There's a regression test for this in
  `diff.spec.ts`; keep it green if you touch either rollup. The same helper
  also carries `capped` through the rollup, so a capped shortfall at the
  chain level stays flagged at the queue level too.
- `questKey(questlineName, questName)` lives in `types.ts` (not
  `persistence.ts`) — `diff.ts` is a pure calculation module and shouldn't
  import from the storage-specific persistence module.

## Paste parsing (`src/lib/quest/parsing/pasteParsing.ts`, `inventory.ts`, `bank.ts`, `completed.ts`)

- `pasteParsing.ts` holds low-level helpers shared across the three page
  parsers (`indexOfCaseInsensitive`, `parseCommaNumber`, `toTrimmedLines`) —
  fix comma-number or line-splitting bugs there once rather than in each
  parser.
- `inventory.ts` treats `"MAX ON HAND"` as the only status flag that sets an
  entry's `maxed` field; a maxed entry's pasted qty is trusted as the item's
  real storage cap and feeds `diff.ts`'s `caps` map from `+page.svelte`.
  Editing a row's qty by hand clears `maxed`, since a manual edit is the
  player's own claim, not a re-observed cap.
- `bank.ts` parses a pasted Bank-page paste for `walletSilver` ("Deposit
  All") and `bankSilver` ("Withdraw All") — it only reads inside the
  "BULK OPTIONS" block via exact (not substring) line matching, since the
  page also has a "Deposit"/"Withdraw" (no "All") pair earlier for one-off
  amounts. It's deliberately decoupled from `inventory.ts`: it only ever
  produces a Silver figure and knows nothing about items.

## Persistence (`src/lib/quest/storage/persistence.ts`)

- All reads/writes go through `hasLocalStorage()` guard — this file must stay
  SSR-safe.
- `importProgress` must only ever extract `.completed` (array of strings) from
  parsed JSON — never spread/merge the parsed object's own keys elsewhere.
  This is a deliberate prototype-pollution guard; don't loosen it for
  convenience.
- `loadQueue`/`saveQueue` persist the ordered questline-name queue under the
  `farmrpg-quest-tracker:queue-v1` key. `+page.svelte` filters the loaded
  queue against currently known questline names on hydration, dropping any
  stale saved name that no longer matches a real questline.

## Component layout (`src/routes/+page.svelte` + `src/lib/components/`)

- `+page.svelte` itself only holds cross-cutting state that multiple
  components need to share (`inventory`, `completed`/`inventoryBaseline`/
  `staleKeys`, `selectedQuestlineNames`, `darkMode`, the modal-open flags) and
  wires it into child components via props/callbacks — most components own
  their own local UI state (search text, drag state, paste-tab state) instead
  of that living in the page. `completed`/`inventoryBaseline`/`staleKeys` are
  `SvelteSet`s passed down **by reference** and mutated directly by
  `ImportModal`/`ProgressBackupModal`; they call the `onCompletedChanged`
  callback prop afterward so `+page.svelte` can recompute
  `completedCountByQuestline` (which it alone owns, since it's the one thing
  those mutations don't update incrementally).
- `QuestlinePicker.svelte` owns `selectedQuestlineNames` as a `$bindable` —
  order is meaningful (drives the shared-inventory walk order in
  `diffQuestlineQueue`) — plus the search/status-filter state and drag-reorder
  (`dragFromIndex`/`dragOverIndex` + `handleQueueDrop`). Firefox aborts an
  HTML5 drag if `dataTransfer.setData` isn't called in `dragstart` (Chromium
  doesn't enforce this) — keep that call if you touch the drag handlers.
- `+page.svelte`'s `diffResults` (from `diffQuestlineQueue`) drives
  `ResultsList.svelte`; `shortfallSummary` (from `aggregateQueueShortfalls`)
  drives `ShortfallSummary.svelte`. Both are `$derived` from
  `selectedQuestlines` + `inventoryMap` + `completed`.
- `ImportModal.svelte` owns all three paste tabs (`ImportTab = 'inventory' |
'bank' | 'completed'`) and their paste-text/message state internally;
  `open`/`tab` are `$bindable` props so `+page.svelte` and other components
  (the header's Import button, the inventory panel's import icon, the
  questline picker's import-completed icon) can all open it on a given tab
  by just assigning those two bindables. Collapsing the how-to-help panel on
  tab change is a `$effect` reacting to the `tab` prop inside `ImportModal`
  itself, not a function callers have to remember to call — this replaces
  the old `switchImportTab` convention and can't be forgotten from a new call
  site. The Bank tab feeds `parseBankPaste` and, when `includeBankBalance` is
  checked, folds wallet + bank Silver into the simulated inventory as a
  synthetic Silver entry.
- `FeedbackModal.svelte` is static instructional content (contact `kodyy`
  in-game), not a submission form/API — `+page.svelte` owns
  `feedbackModalOpen` and passes it down as the modal's `open` `$bindable`,
  same wiring pattern as the other modals.

## Workflow notes

- When asked to run `/simplify`, `/code-review`, `/security-review` in
  sequence, respect the order given even if it differs from habit — the user
  has explicitly corrected this once already (wants review before security
  scan).
