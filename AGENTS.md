# AGENTS.md — FarmRPG Quest Tracker

Project guidance and architecture reference for AI coding agents (Claude Code, Google Antigravity, etc.).

## What this project is

FarmRPG Quest Tracker is a client-side SvelteKit static web application for players of [FarmRPG](https://farmrpg.com). Players paste their in-game inventory, profile stats, bank silver, and completed quests, then queue one or more questlines (order matters — queued questlines share a single simulated inventory).

The app calculates:

1. **Wall Points**: The exact first quest in each chain the player cannot complete with current materials.
2. **Shortfall Summary**: A combined queue-wide rollup of all missing materials with CAPPED indicators for bottlenecks exceeding storage limits.
3. **Recursive Craft Tree**: Multi-tier crafting solver showing raw material requirements and craftable counts, accounting for shared ingredients consumed earlier in the queue.
4. **Trade / Shopping List Export**: 1-click in-game chat request messages formatted with `LF ((Item)) xCount` syntax, strictly chunked to the 250-character FarmRPG chat limit.
5. **Eligibility Checks**: Real-time gating on player skills, tower level, NPC friendship ranks, mining cave floors, quest prerequisites, and annual recurring seasonal event date windows.

This is an **unofficial, free, non-commercial fan project**. It is not affiliated with, endorsed by, or sponsored by FarmRPG or Magic and Wires, LLC. It will never be monetized.

---

## Commands

All commands from `package.json`:

| Command                                | Action                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `npm run dev`                          | Starts Vite dev server (runs `npm run seed-data` automatically before starting).                       |
| `npm run build`                        | Builds production bundle via Vite and `@sveltejs/adapter-cloudflare`.                                  |
| `npm run preview`                      | Previews the production build locally.                                                                 |
| `npm run test:unit`                    | Runs unit tests via Vitest (`diff`, `eligibility`, `recipes`, `persistence`, etc.).                    |
| `npm test`                             | Runs unit tests (`--run`) followed by Playwright e2e tests.                                            |
| `npm run test:e2e`                     | Installs Playwright browser binaries and runs e2e tests.                                               |
| `npm run check`                        | Runs SvelteKit sync and `svelte-check` TypeScript validation.                                          |
| `npm run check:watch`                  | Runs `svelte-check` in watch mode.                                                                     |
| `npm run lint`                         | Runs Prettier check and ESLint across the codebase.                                                    |
| `npm run format`                       | Auto-formats code with Prettier.                                                                       |
| `npm run deploy`                       | Builds and deploys to Cloudflare Pages (`vite build && wrangler pages deploy .svelte-kit/cloudflare`). |
| `npm run seed-data`                    | Dev-only helper (`scripts/seed-data.mjs`) copying mock sample fixtures to `static/` if missing.        |
| `npm run prepare`                      | SvelteKit sync helper (`svelte-kit sync`).                                                             |
| `npm run fetch:questlines`             | **LEGACY / NON-FUNCTIONAL**: Upstream GraphQL API is private; do not use.                              |
| `npm run fetch:questlines:incremental` | **LEGACY / NON-FUNCTIONAL**: Legacy incremental fetcher; do not use.                                   |

---

## Directory-Level Architecture Map

Strictly one line per directory/module (no per-file listings):

- `api/`: Gitignored maintainer scripts, manual quest-paste parsers, and scratch data utilities.
- `messages/`: Paraglide JSON localization catalogs (`en.json`, `es.json`) for UI internationalization.
- `scripts/`: Dev utilities, notably `seed-data.mjs` for copying mock sample fixtures into `static/`.
- `static/`: Public web root hosting the irreplaceable local source-of-truth JSON databases, sample fixtures, metadata, `robots.txt`, and `sitemap.xml`.
- `src/`: SvelteKit application source root containing HTML shell, layout, client/server hooks, and ambient typings.
- `src/lib/assets/`: Static SVGs and branding icons bundled into the client build.
- `src/lib/components/`: Reusable Svelte UI components (modals, panels, pickers, craft trees, bottom sheets).
- `src/lib/components/content/`: Static text content blocks shared across routes and modals (Tutorial, Why, Credits).
- `src/lib/data/`: Build-time or fallback static data files.
- `src/lib/paraglide/`: Compiler-generated Paraglide i18n runtime bindings (never hand-edit).
- `src/lib/quest/calc/`: Domain calculation engines (inventory queue diffing, eligibility gating, recursive crafting planner).
- `src/lib/quest/export/`: Chat message formatting and text chunking utilities for in-game trade export (`LF ((Item)) xCount`).
- `src/lib/quest/parsing/`: Text parsers for FarmRPG game text (inventory, profile stats, bank, mining, completed quests, and unified smart auto-detector).
- `src/lib/quest/storage/`: LocalStorage persistence layers and module-level reactive Svelte stores fetching static JSON catalogs.
- `src/lib/ui/`: Presentation helpers, Tailwind class composers, DOM utilities, and external buddy.farm link formatters.
- `src/routes/`: SvelteKit file-based routing tree (`/`, `/about`, `/changelog`, `/credits`).

---

## Data Flow & How Data Actually Gets Updated

### 1. The Database Is Local and Irreplaceable

`static/questlines.json`, `static/items.json`, and `static/recipes.json` are **gitignored** (`.gitignore`), but they are **NOT** generated. The original upstream GraphQL API was made private, so automated bulk scraping is impossible. The local JSON files on the maintainer's machine are the irreplaceable source of truth.

### 2. How New Quests and Items Are Added

New content is added **incrementally** using maintainer paste utilities:

- `api/paste-to-questline.mjs`: The maintainer selects all text on a new in-game quest page (`quest.php?id=...`), copies it, and runs `node paste-to-questline.mjs <paste.txt> --id <ID>`. The script parses quest name, requirements, prerequisite chains, skill/mining/NPC requirements, and date windows, and incrementally upserts them into `static/questlines.json` and `static/items.json`.
- `api/append/append.mjs`: Auxiliary maintainer script that parses buddy.farm per-quest `page-data.json` objects and merges them into `questlines.json` and `items.json`.
- `api/dump-quest-ids.mjs`: Legacy audit script that previously diffed GraphQL IDs against `questlines.json`.
- `api/fetch-questlines.mjs`: Legacy bulk fetch script (now defunct due to private API).

### 3. Client Runtime Loading

At runtime, `src/routes/+page.svelte` preloads and asynchronously fetches static JSON databases once per browser tab:

- `questlinesStore.svelte.ts`: `questlines.json` and `questlines-meta.json`
- `itemsStore.svelte.ts`: `items.json`
- `recipesStore.svelte.ts`: `recipes.json`
- `npcsStore.svelte.ts`: `npc.json`
- `miningStore.svelte.ts`: `mining.json`
- `sourcesStore.svelte.ts`: `locations.json`, `item-sources.json`, and `item-sources-meta.json`

Assets are fetched via `fetch()` and edge-cached via `_headers`, never bundled into JavaScript chunks.

### 4. User Simulation Pipeline

1. **Import**: User pastes raw game text into the unified `smartParser.ts` or dedicated tabs (`parsing/`).
2. **State & Persistence**: Parsed state is held in reactive `$state` and saved to `localStorage` (`persistence.ts`) with SSR guards.
3. **Queue Diffing**: `diffQuestlineQueue()` (`diff.ts`) threads the simulated inventory through queued questlines in array order.
4. **Crafting Planning**: `CraftingPlanner` (`recipes.ts`) uses binary search demand checks to determine craftable quantities, properly decrementing intermediate ingredients already claimed earlier in the queue.
5. **Rollup & Export**: `aggregateQueueShortfalls()` rolls up deficits. `generateRequestList()` (`requestList.ts`) filters to mailable items and formats them into 250-character chunks for in-game trade chat.

---

## Deployment Target & Why Manual Wrangler Deploy

- **Target**: Cloudflare Pages via `@sveltejs/adapter-cloudflare`.
- **Why Manual Deploy**: Because `static/questlines.json`, `static/items.json`, and `static/recipes.json` are gitignored and not tracked in git. If Cloudflare Pages built automatically from GitHub pushes, the Cloudflare build environment would only find the synthetic mock fixtures generated by `seed-data.mjs`!
- **Workflow**: Automatic deployments on push are disabled in the Cloudflare Pages dashboard. Deploys are run manually from the maintainer's machine:
  ```sh
  npm run deploy
  ```
  This runs `vite build` using the real local databases and deploys `.svelte-kit/cloudflare` via `wrangler pages deploy`.

---

## Conventions

- **Svelte 5 Runes**: Use runes exclusively (`$state`, `$derived`, `$props`, `$bindable`, `$effect`).
- **Tailwind CSS v4**: Dark mode is controlled via `.dark` class on `<html>` using Tailwind v4's `@custom-variant dark (&:where(.dark, .dark *));` in `src/routes/layout.css`.
- **Plain CSS in `layout.css`**: `layout.css` is imported via JS as a plain stylesheet, NOT a Svelte `<style>` block. Svelte `:global()` pseudo-selectors have no meaning there and will be dropped.
- **Icons**: Always import from `@lucide/svelte`. Never import from the deprecated `lucide-svelte` package.
- **SSR Safety**: All browser APIs (`localStorage`, `window`) must be guarded with `hasLocalStorage()` or invoked inside client-only lifecycle handlers (`onMount`).
- **Security**: `importProgress()` in `persistence.ts` must only extract `.completed` arrays from parsed JSON (deliberate prototype-pollution guard).
- **Verification Standards**: Always verify changes by running `npm run lint`, `npm run check`, and `npm run test:unit`.

---

## Invariants & Gotchas

1. **`static/*.json` IS IRREPLACEABLE**: `questlines.json`, `items.json`, and `recipes.json` cannot be re-fetched from upstream. Never delete or overwrite them wholesale. All updates must be made incrementally. They are not committed to git on purpose (game data); the recovery copy is the live deployment (`https://farm-rpg-quest-tracker.pages.dev/*.json`). Never suggest committing them.
2. **Shared Inventory Ordering**: Whichever questline is earlier in the queue gets first claim on scarce shared items. Do not "fix" queue diffing to treat questlines independently.
3. **Queue-Aware Crafting Stock (v0.5.2)**: Ingredients consumed by crafting for earlier quests reduce available stock for subsequent quests.
4. **Capped Shortfalls**: Items exceeding known storage limits (from "MAX ON HAND" inventory lines) are flagged `CAPPED` because farming alone cannot resolve them until capacity is upgraded.
5. **Silver Requirement Synthesis**: Silver requirements are synthesized as `{ item: 'Silver', qty: requiredSilver }` so they participate in shortfall tracking alongside normal items.
6. **Title Sanitization**: Upstream quest titles with literal `<br/>` tags must be sanitized to a space in all parsers.
7. **HTML5 Drag-and-Drop in Firefox**: Firefox aborts drags unless `dataTransfer.setData` is called in `dragstart`. Always keep this call in drag handlers.
8. **Dev-Only Seed Data**: `scripts/seed-data.mjs` only copies mock sample fixtures (`*.sample.json`) if the real file is absent. It never overwrites real data. Open-source contributors work against sample mock data.

---

## Flagged Errors in Old `CLAUDE.md`

For reference, the following inaccuracies in the previous `CLAUDE.md` have been corrected:

- **Data Regeneration**: Old doc treated `fetch-questlines.mjs` as active. The upstream API is now private; data is maintained incrementally via `api/paste-to-questline.mjs`.
- **Missing Data Catalogs**: Old doc omitted `recipes.json`, `mining.json`, `locations.json`, `item-sources.json`, and their stores.
- **Outdated Seed Scope**: Old doc listed only 3 seed targets; `seed-data.mjs` seeds 5 files.
- **Outdated Tab Count**: Old doc stated `ImportModal` has 3 tabs; it now has 5 tabs plus `smartParser`.
- **Missing Features**: Old doc omitted recursive craft tree calculations (`recipes.ts`) and trade request list exports (`requestList.ts`).
