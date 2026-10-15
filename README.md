# FarmRPG Quest Tracker

A fast, client-side web application for [FarmRPG](https://farmrpg.com) players. Paste your in-game inventory, pick one or more questlines, and instantly see the exact quest in each chain where you will run out of materials (the "wall point") — without manually cross-referencing wiki pages and requirement spreadsheets.

This is an **unofficial, free, non-commercial fan project**. It is not affiliated with, endorsed by, or sponsored by FarmRPG or Magic and Wires, LLC. It will never be monetized. All credit for FarmRPG itself belongs to its developers.

---

## Features

- **Multi-Chain Simulation & Wall-Point Detection**: Queue multiple questlines in priority order. The simulator threads a single shared inventory across the queue, decrementing materials as quests are completed and flagging the first quest where you run dry.
- **Combined Shortfall Summary**: Roll up every missing item across your entire queue into one consolidated list. Filter by mailable items, source categories, search by item name, and sort by deficit quantity. Bottlenecks that exceed your bag capacity are flagged as **CAPPED**.
- **Recursive Craft Tree & Craftable Counts**: Deep ingredient breakdown showing multi-tier recipe requirements and remaining shortages. Inlines craftable quantities (`+N` craftable from current inventory stock), with stock consumption correctly deducted across earlier quests in the queue.
- **1-Click Trade / Request List Generator**: Export missing mailable items formatted directly for FarmRPG in-game chat (`LF ((Item Name)) xCount`). Automatically excludes unmailable items and greedily chunks lines to strictly adhere to the in-game 250-character chat limit.
- **Drop Sources & Buddy.farm Integration**: View item drop locations, workshop crafts, fishing spots, farm production buildings, wishing well drops, and mining caves directly inline, with 1-click links out to [buddy.farm](https://buddy.farm).
- **Mining Floors Dashboard**: Track mining cave floor progression across Spring Cave, Highland Hollow, Sol Grotto, Ember Caverns, Fenrir's Den, and Mossrock Mine, with automatic gating on mining floor quest prerequisites.
- **Real-Time Eligibility Engine**: Evaluates player skill levels (farming, fishing, crafting, exploring, tower, cooking, mining), NPC friendship ranks, mining floors, quest-to-quest prerequisites, and annual recurring seasonal event date windows (with New Year boundary crossing support).
- **Universal Smart Importer**: Single unified paste box that auto-detects and parses inventory, player stats, bank silver, mining floors, and completed quests in a single pass, alongside dedicated paste tabs.
- **Offline-First & Data Backup**: All progress, inventory, queue, and preferences are stored locally in your browser (`localStorage`). Easily export/import progress backups as JSON across devices.
- **Mobile Optimized**: Clean responsive interface with a floating quick-action menu, bottom sheets for filters, sticky headers, and dark mode support.

---

## Local Development Setup

### Prerequisites

- Node.js (v20+ or v24 recommended)
- npm

### Quickstart

1. Clone the repository and install dependencies:
   ```sh
   npm install
   ```
2. Start the local development server:

   ```sh
   npm run dev
   ```

   > **Zero-Setup Fallback**: `npm run dev` and `npm run test` automatically run `scripts/seed-data.mjs` on `predev`/`pretest`. If no data files exist in `static/`, it copies committed mock sample files (`static/*.sample.json`) into `static/*.json`. It never overwrites existing real data.

   _(Optional)_ **Download Live Game Catalog**:
   If you want to test against the full, real catalog (~580+ questlines) instead of sample data, download the latest public data files directly from the deployed site into `static/`:

   ```sh
   curl -o static/questlines.json https://farm-rpg-quest-tracker.pages.dev/questlines.json
   curl -o static/questlines-meta.json https://farm-rpg-quest-tracker.pages.dev/questlines-meta.json
   curl -o static/items.json https://farm-rpg-quest-tracker.pages.dev/items.json
   curl -o static/recipes.json https://farm-rpg-quest-tracker.pages.dev/recipes.json
   curl -o static/npc.json https://farm-rpg-quest-tracker.pages.dev/npc.json
   curl -o static/mining.json https://farm-rpg-quest-tracker.pages.dev/mining.json
   curl -o static/locations.json https://farm-rpg-quest-tracker.pages.dev/locations.json
   curl -o static/item-sources.json https://farm-rpg-quest-tracker.pages.dev/item-sources.json
   curl -o static/item-sources-meta.json https://farm-rpg-quest-tracker.pages.dev/item-sources-meta.json
   ```

3. Open your browser to the local URL shown in your terminal (typically `http://localhost:5173`).

---

## AI Assistant Setup

This project provides unified agent guidelines in [AGENTS.md](AGENTS.md):

- **Claude Code**: Reads [CLAUDE.md](CLAUDE.md), which redirects directly to [AGENTS.md](AGENTS.md) (`@AGENTS.md`).
- **Google Antigravity**: Configured via workspace rules and references [AGENTS.md](AGENTS.md) for commands, directory architecture, conventions, and calculation invariants.

---

## Available Scripts

The following scripts are defined in `package.json`:

```sh
# Development & Sync
npm run seed-data                  # Dev-only fallback: copies *.sample.json to static/*.json if missing
npm run predev                     # Runs seed-data before dev
npm run pretest                    # Runs seed-data before test
npm run dev                        # Starts Vite development server
npm run prepare                    # Runs svelte-kit sync

# Testing & Code Quality
npm run test:unit                  # Runs Vitest unit test suites
npm test                           # Runs unit tests (--run) followed by Playwright e2e tests
npm run test:e2e                   # Installs Playwright browser binaries and runs e2e tests
npm run check                      # Runs svelte-check TypeScript validation
npm run check:watch                # Runs svelte-check in watch mode
npm run lint                       # Runs Prettier check and ESLint
npm run format                     # Auto-formats code with Prettier

# Building & Deployment
npm run build                      # Builds production bundle via Vite
npm run preview                    # Previews production build locally
npm run deploy                     # Builds and deploys to Cloudflare Pages via wrangler

# Legacy Scripts (Non-functional)
npm run fetch:questlines           # Legacy: bulk GraphQL fetcher (upstream API is now private)
npm run fetch:questlines:incremental # Legacy: incremental GraphQL fetcher (upstream API is now private)
```

---

## Data Pipeline & Architecture

### Irreplaceable Local Database

`static/questlines.json`, `static/items.json`, and `static/recipes.json` are **gitignored** (`.gitignore`) and are **not generated** from an open API. Because the original upstream GraphQL endpoint was made private, bulk automated re-scraping is no longer possible. The local JSON databases maintained on the project author's machine serve as the irreplaceable source of truth.

### Incremental Quest Updates

New quests, items, and seasonal date adjustments are added incrementally using internal maintainer tools:

- `api/paste-to-questline.mjs`: Parses copied raw quest page text (`quest.php?id=...`) and upserts requirements, skills, prerequisites, and dates into `static/questlines.json` and `static/items.json`.
- `api/append/append.mjs`: Parses `buddy.farm` per-quest page data into the local catalog.

### Client-Side Runtime Loading

Rather than bundling mega-byte JSON files into the client's JavaScript chunks, the client fetches `questlines.json`, `items.json`, `recipes.json`, `npc.json`, `mining.json`, `locations.json`, and `item-sources.json` at runtime via reactive Svelte stores (`src/lib/quest/storage/`). These static requests are cached with long TTL headers defined in `_headers`.

---

## Building & Deploying

Production builds target **Cloudflare Pages** using `@sveltejs/adapter-cloudflare`:

```sh
npm run deploy
```

### Why Manual Wrangler Deploy?

Because the master databases (`static/questlines.json`, `static/items.json`, etc.) are gitignored, automatic deployment on git push is **disabled** in the Cloudflare Pages dashboard. A git-triggered cloud build would only have access to synthetic sample fixtures (`*.sample.json`). Deployments are executed manually from the maintainer's environment using `wrangler pages deploy .svelte-kit/cloudflare`.

---

## Contributing & Bug Reports

We welcome bug fixes, UI improvements, and performance optimizations! Please see [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.

- **Reporting Missing or Incorrect Quest Data**: Do not open a PR editing `questlines.json` directly. Instead, use the in-app **Feedback / report an issue** button, message `kodyy` in-game, or submit the 1-click Google Form report when an unmatched quest is flagged during import.
