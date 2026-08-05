import type { PlayerStats } from '../types';
import { toTrimmedLines } from './pasteParsing';

// Client-side only — parses a manual select-all + copy of FarmRPG's "My
// Profile" page text, the only source for a player's skill/Tower/NPC
// friendship levels (no separate API for this). This has no relationship to
// the offline GraphQL fetch script under /api; keep decoupled, same rule as
// inventory.ts/bank.ts.

export class StatsParseError extends Error {}

/** Levels are rendered as "Level N" directly under the skill/section name — this
 * matches that shape wherever it's searched for. */
const LEVEL_LINE = /^Level (\d+)$/i;

/** A skill not yet unlocked (e.g. Cooking before a player's first meal) renders
 * "Not Started" in place of a "Level N" line — treat that as level 0 rather than
 * failing the whole parse. */
const NOT_STARTED_LINE = /^Not Started$/i;

const SKILL_LINES: { key: keyof Omit<PlayerStats, 'tower' | 'npcLevels'>; line: string }[] = [
	{ key: 'farming', line: 'Farming' },
	{ key: 'fishing', line: 'Fishing' },
	{ key: 'crafting', line: 'Crafting' },
	{ key: 'exploring', line: 'Exploring' },
	{ key: 'cooking', line: 'Cooking' }
];

// Mining has no leveled progression ("Now in Beta" instead of a level) — never
// attempt to parse a level for it, unlike the other five skills.

const TOWER_LEVEL_LINE = 'Tower Level';

/** Canonical NPC names (matching `Quest.requiredNpc.name` / `Npc.name` from the live
 * fetched roster) to fall back on when the caller doesn't have `npc.json` loaded yet —
 * e.g. tests, or a paste attempted before the NPC fetch resolves. Prefer passing the
 * live roster (see `npcsStore.svelte.ts`'s `getNpcNames()`) so a newly added NPC gets
 * picked up automatically instead of requiring this list to be hand-updated. */
const FALLBACK_NPC_NAMES = [
	'Rosalie',
	'Holger',
	'Beatrix',
	'Thomas',
	'Cecil',
	'George',
	'Jill',
	'Vincent',
	'Lorn',
	'Buddy',
	'Borgen',
	'Ric Ryph',
	'Mummy',
	'ROOMBA',
	'frank',
	'Mariya',
	'Baba Gec',
	'Geist',
	'Cid',
	'Goostav',
	'Star Meerif',
	'Charles Horsington III',
	'Gary Bearson V',
	'Captain Thomas'
];

/** Canonical name -> truncated display name as rendered on the profile page. Only
 * these four are truncated (confirmed against the old CSV's `From` column) — every
 * other NPC renders identically to its canonical name, so absence from this map means
 * "search for the canonical name as-is". Built from strong but not 100%-certain
 * evidence; validate against real `Quest.requiredNpc.name` values once the pipeline
 * fetch captures them live. */
const NPC_DISPLAY_OVERRIDES: Record<string, string> = {
	'Star Meerif': 'Star',
	'Charles Horsington III': 'Charles',
	'Gary Bearson V': 'Gary',
	'Captain Thomas': 'CptThomas'
};

/** Tries every case-insensitive occurrence of `keywordLine` (not just the first — a
 * skill name can coincidentally also be a player's username, e.g. a friend named
 * "Fishing" in the Friends list) and, for each, scans forward a short bounded
 * distance for the next "Level N" line — the mastery-claim "Rewards\nReady!" button
 * can sit between one skill's Level line and the next skill name, but never between a
 * skill name and its own Level line, so a small bounded scan is enough and keeps this
 * from grabbing an unrelated Level line far down the page. Returns the level from the
 * first occurrence that's structurally followed by one. */
function findLevelAfter(lines: string[], keywordLine: string, maxScan = 4): number | null {
	for (let idx = 0; idx < lines.length; idx++) {
		if (lines[idx].toLowerCase() !== keywordLine.toLowerCase()) continue;
		for (let i = idx + 1; i < Math.min(lines.length, idx + 1 + maxScan); i++) {
			const m = LEVEL_LINE.exec(lines[i]);
			if (m) return parseInt(m[1], 10);
			if (NOT_STARTED_LINE.test(lines[i])) return 0;
		}
	}
	return null;
}

/** Tries every case-insensitive occurrence of `displayName` (not just the first) and
 * returns the level from the first one structurally followed by a "Level N" line. This
 * is what naturally skips the "Friendship Levels" teaser section, which shows an NPC
 * name followed by unrelated text (e.g. "Daily Chores"), not a level, ahead of the real
 * friendship-levels list later on the page. */
function findNpcLevel(lines: string[], displayName: string): number | null {
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].toLowerCase() !== displayName.toLowerCase()) continue;
		const next = lines[i + 1];
		if (!next) continue;
		const m = LEVEL_LINE.exec(next);
		if (m) return parseInt(m[1], 10);
	}
	return null;
}

function findTowerLevel(lines: string[]): number {
	const idx = lines.findIndex((l) => l.toLowerCase() === TOWER_LEVEL_LINE.toLowerCase());
	if (idx === -1) return 0; // Valid outcome for Tower-locked players, not a parse error.
	const next = lines[idx + 1];
	if (!next || !/^\d+$/.test(next)) return 0;
	return parseInt(next, 10);
}

/**
 * Parses raw copy-pasted "My Profile" page text into structured player stats.
 *
 * The page renders a lot of surrounding chrome (chat sidebar, nav menu,
 * farm-house descriptions) and — critically — renders the skills block twice
 * and has a decoy "Friendship Levels" teaser before the real list. Anchoring
 * is by content (skill/NPC name immediately followed by a "Level N" line),
 * not by position, since fixed-line-offset parsing can't survive either of
 * those quirks.
 */
export function parsePlayerStatsPaste(
	rawText: string,
	npcNames: string[] = FALLBACK_NPC_NAMES
): PlayerStats {
	const lines = toTrimmedLines(rawText);

	const stats: Partial<Record<(typeof SKILL_LINES)[number]['key'], number>> = {};
	for (const { key, line } of SKILL_LINES) {
		const level = findLevelAfter(lines, line);
		if (level === null) {
			throw new StatsParseError(
				`Could not find your ${line} level in the pasted content — make sure you copied the full "My Profile" page.`
			);
		}
		stats[key] = level;
	}

	const npcLevels: Record<string, number> = {};
	for (const canonical of npcNames) {
		const display = NPC_DISPLAY_OVERRIDES[canonical] ?? canonical;
		const level = findNpcLevel(lines, display);
		if (level !== null) npcLevels[canonical] = level;
	}

	return {
		farming: stats.farming as number,
		fishing: stats.fishing as number,
		crafting: stats.crafting as number,
		exploring: stats.exploring as number,
		cooking: stats.cooking as number,
		tower: findTowerLevel(lines),
		npcLevels
	};
}
