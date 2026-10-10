import type { InventoryEntry, PlayerStats } from '../types';

const STORAGE_KEY = 'farmrpg-quest-tracker:completed-v1';
const DARK_MODE_KEY = 'farmrpg-quest-tracker:dark-mode';
const INVENTORY_KEY = 'farmrpg-quest-tracker:inventory-v1';
const QUEUE_KEY = 'farmrpg-quest-tracker:queue-v1';
const INVENTORY_BASELINE_KEY = 'farmrpg-quest-tracker:inventory-baseline-completed-v1';
const CHANGELOG_SEEN_KEY = 'farmrpg-quest-tracker:changelog-seen-v1';
const PLAYER_STATS_KEY = 'farmrpg-quest-tracker:player-stats-v1';
const EXPORT_VERSION = 2;

function hasLocalStorage(): boolean {
	return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** Reads a JSON array, keeping every element that passes `isValidElement` and dropping only the bad ones, rather than discarding the whole saved array over one malformed entry (a corrupted write or a stray manual localStorage edit shouldn't wipe an otherwise-good history). Any failure below "valid JSON array" (missing key, bad JSON, not an array) falls back to `[]`. Shared by every localStorage-backed array read in this module. */
function loadJSONArray<T>(key: string, isValidElement: (el: unknown) => el is T): T[] {
	if (!hasLocalStorage()) return [];
	try {
		const raw = window.localStorage.getItem(key);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(isValidElement);
	} catch {
		return [];
	}
}

/** Writes a value as JSON. Returns false on write failure (storage full/unavailable in
 * private browsing) so callers can warn the user that this write won't persist this
 * session, rather than the failure being silent. Returns true when there's no
 * localStorage to write to at all (SSR) — that's not a failure worth warning about. */
function saveJSON(key: string, value: unknown): boolean {
	if (!hasLocalStorage()) return true;
	try {
		window.localStorage.setItem(key, JSON.stringify(value));
		return true;
	} catch {
		return false;
	}
}

function isString(v: unknown): v is string {
	return typeof v === 'string';
}

export function loadCompleted(): Set<string> {
	return new Set(loadJSONArray(STORAGE_KEY, isString));
}

export function saveCompleted(completed: Set<string>): boolean {
	return saveJSON(STORAGE_KEY, Array.from(completed));
}

/** Snapshot of `completed` at the moment the inventory was last pasted — lets the UI
 * detect quests checked off since then (a real-world consumption the pasted inventory
 * doesn't reflect yet). Deliberately a set, not a count: a count can't distinguish
 * "checked a new quest" from "checked one, unchecked another" since both leave the
 * size unchanged, so staleness must be computed by membership, not cardinality. */
export function loadInventoryBaseline(): Set<string> {
	return new Set(loadJSONArray(INVENTORY_BASELINE_KEY, isString));
}

export function saveInventoryBaseline(completed: Set<string>): boolean {
	return saveJSON(INVENTORY_BASELINE_KEY, Array.from(completed));
}

/** Falls back to the OS/browser preference when nothing has been saved yet. */
export function loadDarkMode(): boolean {
	if (!hasLocalStorage()) return false;
	const raw = window.localStorage.getItem(DARK_MODE_KEY);
	if (raw === 'true') return true;
	if (raw === 'false') return false;
	return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function saveDarkMode(enabled: boolean): boolean {
	return saveJSON(DARK_MODE_KEY, enabled);
}

function isInventoryEntry(v: unknown): v is InventoryEntry {
	if (!v || typeof v !== 'object') return false;
	const e = v as InventoryEntry;
	return (
		typeof e.item === 'string' &&
		typeof e.qty === 'number' &&
		Number.isFinite(e.qty) &&
		e.qty >= 0 &&
		typeof e.maxed === 'boolean'
	);
}

export function loadInventory(): InventoryEntry[] {
	return loadJSONArray(INVENTORY_KEY, isInventoryEntry);
}

export function saveInventory(inventory: InventoryEntry[]): boolean {
	return saveJSON(INVENTORY_KEY, inventory);
}

function isPlayerStats(v: unknown): v is PlayerStats {
	if (!v || typeof v !== 'object') return false;
	const s = v as PlayerStats;
	return (
		typeof s.farming === 'number' &&
		typeof s.fishing === 'number' &&
		typeof s.crafting === 'number' &&
		typeof s.exploring === 'number' &&
		typeof s.tower === 'number' &&
		typeof s.cooking === 'number' &&
		!!s.npcLevels &&
		typeof s.npcLevels === 'object' &&
		Object.values(s.npcLevels).every((v) => typeof v === 'number')
	);
}

/** Null means "never pasted" — distinct from a real all-zero stats object (a brand-new
 * character before any leveling). Mirrors loadInventory/saveInventory's single-object
 * JSON pattern; no existing helper handles a non-array shape, so this is a small
 * symmetrical one rather than reshaping PlayerStats into an array. */
export function loadPlayerStats(): PlayerStats | null {
	if (!hasLocalStorage()) return null;
	try {
		const raw = window.localStorage.getItem(PLAYER_STATS_KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		return isPlayerStats(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

export function savePlayerStats(stats: PlayerStats): boolean {
	return saveJSON(PLAYER_STATS_KEY, stats);
}

/** Resets to "never pasted" — removing the key rather than writing an all-zero object,
 * since the latter is a real (if unlikely) PlayerStats value in its own right. */
export function clearPlayerStats(): void {
	if (!hasLocalStorage()) return;
	window.localStorage.removeItem(PLAYER_STATS_KEY);
}

export function loadQueue(): string[] {
	return loadJSONArray(QUEUE_KEY, isString);
}

export function saveQueue(queue: string[]): boolean {
	return saveJSON(QUEUE_KEY, queue);
}

/** Null means "never viewed the changelog" — every real version is a non-empty string. */
export function loadLastSeenChangelogVersion(): string | null {
	if (!hasLocalStorage()) return null;
	return window.localStorage.getItem(CHANGELOG_SEEN_KEY);
}

export function saveLastSeenChangelogVersion(version: string): void {
	if (!hasLocalStorage()) return;
	window.localStorage.setItem(CHANGELOG_SEEN_KEY, version);
}

export interface ProgressExport {
	version: number;
	exportedAt: string;
	completed: string[];
	/** Questline queue, in order — retains *what and why* the player was working toward,
	 * not just which quests are already done. Absent from v1 exports. */
	queue?: string[];
	/** Pasted player stats (level/skill values), included so a backup/restore cycle
	 * doesn't silently drop them from their own separate localStorage key. Absent when
	 * the player never pasted stats, or in exports predating this field. */
	playerStats?: PlayerStats;
}

export interface ImportedProgress {
	completed: Set<string>;
	/** Null when the imported file predates queue export (v1) or omitted it — callers
	 * should leave the current queue untouched rather than clobbering it with an empty one. */
	queue: string[] | null;
	/** Null when the imported file predates player stats export, omitted them (never
	 * pasted), or failed validation — callers should leave current stats untouched. */
	playerStats: PlayerStats | null;
}

export function exportProgress(
	completed: Set<string>,
	queue: string[],
	playerStats: PlayerStats | null
): string {
	const payload: ProgressExport = {
		version: EXPORT_VERSION,
		exportedAt: new Date().toISOString(),
		completed: Array.from(completed).sort(),
		queue,
		...(playerStats && { playerStats })
	};
	return JSON.stringify(payload, null, 2);
}

/** Returns null (rather than throwing) when the pasted/uploaded text isn't a recognizable export, so the caller can show an error without crashing. */
export function importProgress(text: string): ImportedProgress | null {
	try {
		const parsed = JSON.parse(text);
		if (!parsed || !Array.isArray(parsed.completed)) return null;
		return {
			completed: new Set(
				parsed.completed.filter((v: unknown): v is string => typeof v === 'string')
			),
			queue: Array.isArray(parsed.queue)
				? parsed.queue.filter((v: unknown): v is string => typeof v === 'string')
				: null,
			playerStats: isPlayerStats(parsed.playerStats) ? parsed.playerStats : null
		};
	} catch {
		return null;
	}
}

const MAX_CAPACITY_KEY = 'farmrpg-quest-tracker:max-capacity-v1';
const SHOW_ALL_ITEMS_KEY = 'farmrpg-quest-tracker:show-all-items';
const SHOW_CRAFTABLE_KEY = 'farmrpg-quest-tracker:show-craftable';
const APP_VERSION_KEY = 'farmrpg-quest-tracker:app-version';

export function loadMaxCapacity(): number | null {
	if (!hasLocalStorage()) return null;
	const raw = window.localStorage.getItem(MAX_CAPACITY_KEY);
	if (!raw) return null;
	const num = Number(raw);
	return Number.isFinite(num) && num > 0 ? num : null;
}

export function saveMaxCapacity(capacity: number | null): boolean {
	if (!hasLocalStorage()) return true;
	if (capacity === null || capacity <= 0) {
		window.localStorage.removeItem(MAX_CAPACITY_KEY);
		return true;
	}
	return saveJSON(MAX_CAPACITY_KEY, capacity);
}

export function loadShowAllItems(): boolean {
	if (!hasLocalStorage()) return false;
	return window.localStorage.getItem(SHOW_ALL_ITEMS_KEY) === 'true';
}

export function saveShowAllItems(enabled: boolean): boolean {
	return saveJSON(SHOW_ALL_ITEMS_KEY, enabled);
}

export function loadShowCraftable(): boolean {
	if (!hasLocalStorage()) return true;
	const raw = window.localStorage.getItem(SHOW_CRAFTABLE_KEY);
	if (raw === null) return true; // Default true
	return raw === 'true';
}

export function saveShowCraftable(enabled: boolean): boolean {
	return saveJSON(SHOW_CRAFTABLE_KEY, enabled);
}

const SHOW_LOCATION_SOURCES_KEY = 'farmrpg-quest-tracker:show-location-sources';
const SHOW_ALTERNATIVE_SOURCES_KEY = 'farmrpg-quest-tracker:show-alternative-sources';

export function loadShowLocationSources(): boolean {
	if (!hasLocalStorage()) return true;
	const raw = window.localStorage.getItem(SHOW_LOCATION_SOURCES_KEY);
	if (raw === null) return true; // Default true
	return raw === 'true';
}

export function saveShowLocationSources(enabled: boolean): boolean {
	return saveJSON(SHOW_LOCATION_SOURCES_KEY, enabled);
}

export function loadShowAlternativeSources(): boolean {
	if (!hasLocalStorage()) return true;
	const raw = window.localStorage.getItem(SHOW_ALTERNATIVE_SOURCES_KEY);
	if (raw === null) return true; // Default true
	return raw === 'true';
}

export function saveShowAlternativeSources(enabled: boolean): boolean {
	return saveJSON(SHOW_ALTERNATIVE_SOURCES_KEY, enabled);
}

export function loadCachedAppVersion(): string | null {
	if (!hasLocalStorage()) return null;
	return window.localStorage.getItem(APP_VERSION_KEY);
}

export function saveCachedAppVersion(version: string): boolean {
	if (!hasLocalStorage()) return true;
	window.localStorage.setItem(APP_VERSION_KEY, version);
	return true;
}

const QUESTLINE_FILTERS_KEY = 'farmrpg-quest-tracker:questline-filters-v1';
const SHORTFALL_FILTERS_KEY = 'farmrpg-quest-tracker:shortfall-filters-v1';

export type QuestlineStatusFilter = 'not-started' | 'ongoing' | 'done';
export type EligibilityFilter = 'eligible' | 'locked';

export interface QuestlineFilters {
	status: QuestlineStatusFilter[];
	eligibility: EligibilityFilter[];
	showUnavailable: boolean;
	mainQuestOnly: boolean;
}

export const DEFAULT_QUESTLINE_FILTERS: QuestlineFilters = {
	status: ['not-started', 'ongoing'],
	eligibility: ['eligible'],
	showUnavailable: false,
	mainQuestOnly: false
};

export function loadQuestlineFilters(): QuestlineFilters {
	if (!hasLocalStorage()) return { ...DEFAULT_QUESTLINE_FILTERS };
	try {
		const raw = window.localStorage.getItem(QUESTLINE_FILTERS_KEY);
		if (!raw) return { ...DEFAULT_QUESTLINE_FILTERS };
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_QUESTLINE_FILTERS };
		return {
			status: Array.isArray(parsed.status)
				? parsed.status.filter((s: unknown): s is QuestlineStatusFilter =>
						s === 'not-started' || s === 'ongoing' || s === 'done'
				  )
				: DEFAULT_QUESTLINE_FILTERS.status,
			eligibility: Array.isArray(parsed.eligibility)
				? parsed.eligibility.filter((e: unknown): e is EligibilityFilter =>
						e === 'eligible' || e === 'locked'
				  )
				: DEFAULT_QUESTLINE_FILTERS.eligibility,
			showUnavailable: typeof parsed.showUnavailable === 'boolean' ? parsed.showUnavailable : false,
			mainQuestOnly: typeof parsed.mainQuestOnly === 'boolean' ? parsed.mainQuestOnly : false
		};
	} catch {
		return { ...DEFAULT_QUESTLINE_FILTERS };
	}
}

export function saveQuestlineFilters(filters: QuestlineFilters): boolean {
	return saveJSON(QUESTLINE_FILTERS_KEY, filters);
}

export type MailFilter = 'mailable' | 'not-mailable';
export type SortDirection = 'desc' | 'asc';

export interface ShortfallFilters {
	sortDirection: SortDirection;
	mailFilters: MailFilter[];
	maxedOnly: boolean;
	exceedsCapOnly: boolean;
	sourceFilters?: string[];
	categoryFilters?: string[];
}

export const DEFAULT_SHORTFALL_FILTERS: ShortfallFilters = {
	sortDirection: 'desc',
	mailFilters: ['mailable', 'not-mailable'],
	maxedOnly: false,
	exceedsCapOnly: false,
	sourceFilters: [],
	categoryFilters: []
};

export function loadShortfallFilters(): ShortfallFilters {
	if (!hasLocalStorage()) return { ...DEFAULT_SHORTFALL_FILTERS };
	try {
		const raw = window.localStorage.getItem(SHORTFALL_FILTERS_KEY);
		if (!raw) return { ...DEFAULT_SHORTFALL_FILTERS };
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SHORTFALL_FILTERS };
		return {
			sortDirection: parsed.sortDirection === 'asc' ? 'asc' : 'desc',
			mailFilters: Array.isArray(parsed.mailFilters)
				? parsed.mailFilters.filter((m: unknown): m is MailFilter =>
						m === 'mailable' || m === 'not-mailable'
				  )
				: DEFAULT_SHORTFALL_FILTERS.mailFilters,
			maxedOnly: typeof parsed.maxedOnly === 'boolean' ? parsed.maxedOnly : false,
			exceedsCapOnly: typeof parsed.exceedsCapOnly === 'boolean' ? parsed.exceedsCapOnly : false,
			sourceFilters: Array.isArray(parsed.sourceFilters)
				? parsed.sourceFilters.filter(isString)
				: [],
			categoryFilters: Array.isArray(parsed.categoryFilters)
				? parsed.categoryFilters.filter(isString)
				: []
		};
	} catch {
		return { ...DEFAULT_SHORTFALL_FILTERS };
	}
}

export function saveShortfallFilters(filters: ShortfallFilters): boolean {
	return saveJSON(SHORTFALL_FILTERS_KEY, filters);
}

export function hasUnreadChangelog(currentVersion: string): boolean {
	if (!hasLocalStorage()) return false;
	const seen = loadLastSeenChangelogVersion();
	return seen !== currentVersion;
}
