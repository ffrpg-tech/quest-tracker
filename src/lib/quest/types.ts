export interface ItemQty {
	item: string;
	qty: number;
}

export interface SkillLevelRequirement {
	farming?: number;
	fishing?: number;
	crafting?: number;
	exploring?: number;
	tower?: number;
	cooking?: number;
	mining?: number;
}

export interface NpcLevelRequirement {
	npc: string;
	level: number;
}

/** One prerequisite descriptor — a quest has a single predecessor requirement, which can itself span several questlines at once. `order` pins a specific step within a given prerequisite questline, not just "the whole questline". `pred.questlines` is AND semantics (eligibility.ts's `predGaps`) — every listed questline/order pair must be reached in `completed`, not just one. */
export interface QuestlineOrderRef {
	questlines: Array<{ questline: { title: string }; order: number }>;
}

export interface Quest {
	id?: number;
	name: string;
	startDate: string;
	endDate: string;
	requirements: ItemQty[];
	seq: number;
	requiredLevels?: SkillLevelRequirement;
	/** Confirmed single NPC per quest — not a list. */
	requiredNpc?: NpcLevelRequirement;
	/** Consumed by eligibility.ts's `predGaps` — fails open (treated as satisfied) if a
	 * referenced questline title or `order` step can't be resolved against the currently
	 * loaded questlines, rather than blocking on stale/dangling upstream data. */
	pred?: QuestlineOrderRef;
	/** Array (unlike `pred`) since one quest can unlock several different follow-up quests.
	 * Not consumed anywhere — `pred` on the downstream quest is the side that actually gates
	 * eligibility; this is kept only as a raw pass-through for the deferred
	 * quest-dependency-graph idea. */
	dependentQuests?: QuestlineOrderRef[];
	/** Meaning still TBD (per Phase 2 backlog) — candidate use is a stronger permanently-retired
	 * signal for UNAVAILABLE beyond date-window expiry. Not consumed by eligibility.ts yet. */
	isHidden?: boolean;
	/** Confirmed use: prioritize main-story chains in the (not-yet-built) recommendation ranking. */
	mainQuest?: boolean;
}

/** Player stats pasted from FarmRPG's "My Profile" page — see stats.ts. */
export interface PlayerStats {
	farming: number;
	fishing: number;
	crafting: number;
	exploring: number;
	tower: number;
	cooking: number;
	mining: number;
	npcLevels: Record<string, number>;
}

/** The four paste tabs in ImportModal — hoisted here so it isn't defined twice (ImportModal.svelte and +page.svelte both need it). */
export type ImportTab = 'inventory' | 'bank' | 'completed' | 'stats';

export interface Questline {
	name: string;
	questCount: number;
	quests: Quest[];
}

export type QuestlinesData = Record<string, Questline>;

/** One row of the fetched NPC roster (see npc.json in the data pipeline).
 * `isAvailable` is a snapshot from the source at fetch time, not a real date
 * window — unlike `Quest.startDate`/`endDate`, there's no known season range
 * for the NPCs that toggle this, so an unavailable NPC is treated as
 * permanently gone (filtered out) rather than fed into the seasonal-gap
 * logic in eligibility.ts. */
export interface Npc {
	name: string;
	image: string;
	isAvailable: boolean;
}

export interface InventoryEntry {
	item: string;
	qty: number;
	maxed: boolean;
}

/** Compound key so quest-completion state survives even if two different questlines ever share a quest name. This is a pure domain rule, not persistence logic — it lives here (not persistence.ts) so the diff engine can use it without depending on the storage module. */
export function questKey(questlineName: string, questName: string): string {
	return `${questlineName}::${questName}`;
}

function isItemQty(v: unknown): v is ItemQty {
	if (!v || typeof v !== 'object') return false;
	const e = v as ItemQty;
	return typeof e.item === 'string' && typeof e.qty === 'number' && Number.isFinite(e.qty);
}

const SKILL_KEYS: (keyof SkillLevelRequirement)[] = [
	'farming',
	'fishing',
	'crafting',
	'exploring',
	'tower',
	'cooking',
	'mining',
];

function isSkillLevelRequirement(v: unknown): v is SkillLevelRequirement {
	if (!v || typeof v !== 'object') return false;
	const r = v as SkillLevelRequirement;
	return Object.entries(r).every(([key, value]) => {
		if (!SKILL_KEYS.includes(key as keyof SkillLevelRequirement)) return false;
		return value === undefined || typeof value === 'number';
	});
}

function isNpcLevelRequirement(v: unknown): v is NpcLevelRequirement {
	if (!v || typeof v !== 'object') return false;
	const n = v as NpcLevelRequirement;
	return typeof n.npc === 'string' && typeof n.level === 'number';
}

function isQuest(v: unknown): v is Quest {
	if (!v || typeof v !== 'object') return false;
	const q = v as Quest;
	return (
		(q.id === undefined || typeof q.id === 'number') &&
		typeof q.name === 'string' &&
		typeof q.startDate === 'string' &&
		typeof q.endDate === 'string' &&
		Array.isArray(q.requirements) &&
		q.requirements.every(isItemQty) &&
		typeof q.seq === 'number' &&
		(q.requiredLevels === undefined || isSkillLevelRequirement(q.requiredLevels)) &&
		(q.requiredNpc === undefined || isNpcLevelRequirement(q.requiredNpc)) &&
		(q.isHidden === undefined || typeof q.isHidden === 'boolean') &&
		(q.mainQuest === undefined || typeof q.mainQuest === 'boolean')
	);
}

function isQuestline(v: unknown): v is Questline {
	if (!v || typeof v !== 'object') return false;
	const g = v as Questline;
	return (
		typeof g.name === 'string' &&
		typeof g.questCount === 'number' &&
		Array.isArray(g.quests) &&
		g.quests.every(isQuest)
	);
}

/** Structural check on the fetched `questlines.json` payload — the fetch is a static asset, not a typed import, so nothing else verifies the CSV-generated file actually matches `QuestlinesData` before the app trusts it. */
export function isQuestlinesData(v: unknown): v is QuestlinesData {
	if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
	return Object.values(v).every(isQuestline);
}

function isNpc(v: unknown): v is Npc {
	if (!v || typeof v !== 'object') return false;
	const n = v as Npc;
	return typeof n.name === 'string' && typeof n.image === 'string' && typeof n.isAvailable === 'boolean';
}

/** Structural check on the fetched `npc.json` payload — same rationale as `isQuestlinesData`. */
export function isNpcArray(v: unknown): v is Npc[] {
	return Array.isArray(v) && v.every(isNpc);
}
