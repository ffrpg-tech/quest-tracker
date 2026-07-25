# Changelog

All notable changes to the Farm RPG Quest Wall Calculator are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Entries
are grouped by feature/release, not by individual commit.

This file is the source of truth for the in-app [changelog page](/changelog) —
the page parses this file directly, so an entry added here is what users see.

## [Unreleased]

## [0.2.1] - 2026-07-25

### Added

- Item names in the inventory, results, and shortfall summary now link out to their buddy.farm item page.
- A FAQ entry about hard-refreshing when a new feature or data update isn't showing up, since the browser or a CDN in between can serve a stale cache.

### Changed

- The questline picker's status, eligibility, and main-quest filters are now compact icons instead of text pills, and the expired-season filter is relabeled Unavailable to match the UNAVAILABLE badge it controls.
- Completed questlines are now hidden from the picker by default — toggle the Done icon back on to see them.

## [0.2.0] - 2026-07-21

### Added

- Player progression: paste your "My Profile" page to check skill, Tower, and NPC friendship level requirements, not just materials. Questlines you're not yet eligible for show a LOCKED or UNAVAILABLE (expired-season) badge, with tap-to-expand details on exactly what's missing; the questline picker gains Eligible/Locked filters and an opt-in toggle for expired-season chains.
- Quest-to-quest prerequisites are now checked too — a quest that depends on progress in another questline shows LOCKED with a "Complete X first" explanation until that prerequisite is actually done.
- A "Player stats" panel for viewing and hand-editing your pasted skill/Tower/NPC levels, alongside a matching paste tab in the Import dialog.
- Items that can't be sent via in-game mail are flagged with a "CAN'T MAIL" badge, so shortfall planning accounts for items you'll have to source yourself.
- Main-story questlines get a star in the picker, plus a "Main quest" filter pill alongside the existing status/eligibility filters, to narrow the list to just the main story.
- The Shortfall summary can now be filtered to just mailable or just not-mailable items.

## [0.1.5] - 2026-07-19

### Changed

- Mobile layout overhaul: the Inventory and Questline panels, Shortfall summary, and each questline's quest list are now height-capped with their own internal scrolling on narrow screens, instead of growing to fit all their content and burying the footer under a very long page.
- The Questline panel gets extra height on mobile relative to the Inventory panel, since it packs a search box, status filters, the quest list, and the queue into the same space.
- The header's "Feedback" and "Progress backup" buttons collapse to icon-only on mobile (with accessible labels), matching the existing Help and dark-mode icon buttons; "Import data" keeps its label as the primary action.
- Each Results row now stacks the questline name above its status on mobile instead of squeezing both onto one line and ellipsis-truncating the text.
- Each questline's expandable quest list now renders as a stacked card per quest on mobile instead of a 5-column table, so quest names and shortfall numbers no longer wrap awkwardly or overlap.
- The footer's text is smaller and its paragraphs have more breathing room on mobile.

## [0.1.4] - 2026-07-18

### Added

- A brief confirmation now appears right after a paste is successfully parsed.
- Item icons now appear next to item names in the inventory list, results, and shortfall summary.
- A visible FAQ section on the About page, and a "?" header button linking straight to it.
- A warning banner if your browser blocks saving (private browsing, storage full), so you know to back up your progress before closing the tab.
- "Retry" buttons when quest or item data fails to load, instead of needing a full page reload.
- Tapping a "CAPPED" badge now shows its explanation inline, for players on touch devices where hover tooltips don't work.

### Changed

- Pasted inventory items that aren't needed by any quest are no longer imported, keeping the inventory list focused on what's actually relevant.
- The inventory list's "(MAX)" tag is now colored red so maxed-out items stand out at a glance.
- Every questline now shows its completed count out of its total (e.g. "0/18"), colored red at 0, orange while in progress, and green once finished, instead of only showing a count once you'd started.
- Result rows now use consistent, plain-English statuses: "Done", "Ready", "Short", and "Wall Point" (previously a mix of lowercase, all-caps, and abbreviations like "OK").
- Clearing your inventory now asks for confirmation first, matching the existing confirmation on progress-import overwrite.
- Parse errors and successes are now visually distinct (red vs. neutral text) instead of looking identical.
- The "Import data" button now stands out as the primary action in the header.
- The startup loading screen now also tracks quest and item data loading, not just saved preferences.

### Fixed

- Quest data no longer gets re-fetched every time you navigate back to the calculator page — it now loads once per tab.
- Paste parsing is more resilient to chat/menu text sitting near the inventory, bank, or completed-quest markers — it can no longer lock onto a chat message that happens to contain marker-like text.
- Inventory and completed-quest pastes are now checked against the page's own reported item/quest count, so a truncated paste (a collapsed category, or a list that wasn't fully scrolled into view) fails with a clear message instead of silently importing incomplete data.
- Fixed a bug where leftover text after your completed-quests list could get miscounted as an extra completed quest.
- Fixed the results table's sticky header rendering underneath checked-off (faded) rows instead of on top of them.

## [0.1.3] - 2026-07-16

### Added

- Import your Silver balance by pasting your Bank page — pulls from wallet ("Deposit All") by default, with an option to include your bank balance ("Withdraw All") too.
- Shortfalls that exceed an item's known storage cap (from a "MAX ON HAND" inventory paste) are flagged "CAPPED" — a sign that no amount of farming will clear the shortfall until the cap is raised or the item is spent down elsewhere.

### Changed

- Editing an item's quantity by hand clears its "maxed" flag, since the new number is your own claim rather than a re-observed storage cap.
- Updated Credits acknowledgements.

### Fixed

- A failed questlines fetch no longer wipes your saved questline queue — it's treated the same as still-loading rather than "nothing matched."

## [0.1.2] - 2026-07-16

### Changed

- Importing your inventory no longer needs a browser-console script — select all the text on your Inventory page and paste it in directly.
- Importing completed quests works the same way now — select all the text on your Help Needed > Completed page and paste it in, no console script needed.
- Quest rewards are no longer tracked, reflecting a change in the underlying quest data.
- Silver now shows up as a requirement on quests that need it.
- The small per-quest label badge (e.g. "II", "Part 2") is replaced by its position number in the chain.
- The "MAX ON HAND" storage-cap indicator is no longer conflated with the separate "Mastered"/"Grand Mastered" crafting indicators.

## [0.1.1] - 2026-07-16

### Added

- In-app changelog page, with a header badge that flags unseen releases.
- Inventory staleness warning: flags when you've checked off quests since your last inventory paste, so shortfall numbers don't silently go stale.
- Shortfall summary search/filter, and a copyable list of quest names from a "mark completed" paste that didn't match any known quest.
- `questlines.json` is now validated against its expected shape at runtime before the app trusts it (it's a fetched static asset, not a typed import).
- The questline picker now shows when the underlying quest CSV was last updated, sourced from its git history rather than build time.
- Real acknowledgements on the About and Credits pages, replacing placeholder text.

### Changed

- Layout: inventory and questline panels now fill the viewport height
  instead of a fixed max height.

## [0.1.0] - 2026-07-15

### Added

- Quest tracker calculator: paste your FarmRPG inventory, pick a questline, and see the first quest you can't complete with current materials.
- Multi-questline queue support — queue and reorder several questlines that share one inventory, with a combined shortfall summary across the queue.
- SEO metadata and static marketing pages (About, Credits).
- README, CONTRIBUTING guide, and project documentation.

### Changed

- Switched deploy adapter from Vercel to Cloudflare Pages.
