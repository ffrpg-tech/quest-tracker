import { describe, it, expect, afterEach } from 'vitest';
import {
	exportProgress,
	importProgress,
	loadCompleted,
	loadInventory,
	loadPlayerStats,
	savePlayerStats,
	loadMaxCapacity,
	saveMaxCapacity,
	loadShowAllItems,
	saveShowAllItems,
	loadShowCraftable,
	saveShowCraftable,
	loadShowLocationSources,
	saveShowLocationSources,
	loadShowAlternativeSources,
	saveShowAlternativeSources,
	loadQuestlineFilters,
	saveQuestlineFilters,
	loadShortfallFilters,
	saveShortfallFilters,
	hasUnreadChangelog,
	saveLastSeenChangelogVersion
} from './persistence';
import type { PlayerStats } from '../types';

const samplePlayerStats: PlayerStats = {
	farming: 10,
	fishing: 5,
	crafting: 3,
	exploring: 7,
	tower: 1,
	cooking: 2,
	mining: 4,
	npcLevels: { Otis: 4 }
};

describe('exportProgress / importProgress', () => {
	it('round-trips a completed set and queue through JSON', () => {
		const completed = new Set(['Chain A::Quest I', 'Chain A::Quest II']);
		const queue = ['Chain B', 'Chain A'];
		const json = exportProgress(completed, queue, null);
		const restored = importProgress(json);
		expect(restored?.completed).toEqual(completed);
		expect(restored?.queue).toEqual(queue);
		expect(restored?.playerStats).toBeNull();
	});

	it('round-trips player stats through JSON when present', () => {
		const completed = new Set(['Chain A::Quest I']);
		const queue = ['Chain A'];
		const json = exportProgress(completed, queue, samplePlayerStats);
		const restored = importProgress(json);
		expect(restored?.playerStats).toEqual(samplePlayerStats);
	});

	it('returns queue: null when importing a v1 export that predates the queue field', () => {
		const completed = new Set(['Chain A::Quest I']);
		const v1Json = JSON.stringify({
			version: 1,
			exportedAt: new Date().toISOString(),
			completed: Array.from(completed)
		});
		const restored = importProgress(v1Json);
		expect(restored?.completed).toEqual(completed);
		expect(restored?.queue).toBeNull();
		expect(restored?.playerStats).toBeNull();
	});

	it('returns null for unparseable JSON instead of throwing', () => {
		expect(importProgress('not json')).toBeNull();
	});

	it('returns null when the JSON is valid but not a recognizable export shape', () => {
		expect(importProgress('{"foo": "bar"}')).toBeNull();
		expect(importProgress('[]')).toBeNull();
	});
});

/** vitest runs this file under the 'node' environment (no jsdom), so `window`
 * doesn't exist by default — hasLocalStorage() would always report false and
 * every load* function would short-circuit to its empty fallback without
 * exercising the parse/filter path at all. A minimal in-memory localStorage
 * stand-in on globalThis.window is enough to actually drive that path. */
function stubLocalStorage(initial: Record<string, string> = {}) {
	const store = new Map(Object.entries(initial));
	(globalThis as { window?: unknown }).window = {
		localStorage: {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => void store.set(key, value),
			removeItem: (key: string) => void store.delete(key)
		}
	};
}

describe('loadCompleted / loadInventory — per-element filtering', () => {
	afterEach(() => {
		delete (globalThis as { window?: unknown }).window;
	});

	it('keeps the valid entries and drops only the malformed one, instead of discarding the whole saved array', () => {
		stubLocalStorage({
			'farmrpg-quest-tracker:completed-v1': JSON.stringify([
				'Chain A::Quest I',
				42,
				'Chain A::Quest II'
			])
		});
		expect(loadCompleted()).toEqual(new Set(['Chain A::Quest I', 'Chain A::Quest II']));
	});

	it('keeps valid inventory rows and drops a malformed one (bad qty) rather than wiping the whole inventory', () => {
		stubLocalStorage({
			'farmrpg-quest-tracker:inventory-v1': JSON.stringify([
				{ item: 'Wood', qty: 10, maxed: false },
				{ item: 'Corrupted', qty: -5, maxed: false },
				{ item: 'Iron', qty: 3, maxed: true }
			])
		});
		expect(loadInventory()).toEqual([
			{ item: 'Wood', qty: 10, maxed: false },
			{ item: 'Iron', qty: 3, maxed: true }
		]);
	});
});

describe('player stats persistence', () => {
	afterEach(() => {
		delete (globalThis as { window?: unknown }).window;
	});

	it('round-trips mining floors without dropping the rest of the profile', () => {
		stubLocalStorage();
		expect(savePlayerStats(samplePlayerStats)).toBe(true);
		expect(loadPlayerStats()).toEqual(samplePlayerStats);
	});

	it('rejects a partial player stats object', () => {
		stubLocalStorage({
			'farmrpg-quest-tracker:player-stats-v1': JSON.stringify({
				miningFloors: { fenrirsDen: 100 }
			})
		});
		expect(loadPlayerStats()).toBeNull();
	});
});

describe('preferences and capacity persistence', () => {
	afterEach(() => {
		delete (globalThis as { window?: unknown }).window;
	});

	it('round-trips max capacity', () => {
		stubLocalStorage();
		expect(loadMaxCapacity()).toBeNull();
		saveMaxCapacity(1500);
		expect(loadMaxCapacity()).toBe(1500);
		saveMaxCapacity(null);
		expect(loadMaxCapacity()).toBeNull();
	});

	it('round-trips showAllItems and showCraftable', () => {
		stubLocalStorage();
		expect(loadShowAllItems()).toBe(false);
		saveShowAllItems(true);
		expect(loadShowAllItems()).toBe(true);

		expect(loadShowCraftable()).toBe(true); // default true
		saveShowCraftable(false);
		expect(loadShowCraftable()).toBe(false);
	});

	it('round-trips questline filters and falls back to defaults', () => {
		stubLocalStorage();
		const defaults = loadQuestlineFilters();
		expect(defaults.status).toEqual(['not-started', 'ongoing']);
		expect(defaults.eligibility).toEqual(['eligible']);
		expect(defaults.showUnavailable).toBe(false);
		expect(defaults.mainQuestOnly).toBe(false);

		saveQuestlineFilters({
			status: ['done'],
			eligibility: ['locked'],
			showUnavailable: true,
			mainQuestOnly: true
		});

		const loaded = loadQuestlineFilters();
		expect(loaded.status).toEqual(['done']);
		expect(loaded.eligibility).toEqual(['locked']);
		expect(loaded.showUnavailable).toBe(true);
		expect(loaded.mainQuestOnly).toBe(true);
	});

	it('round-trips shortfall filters and falls back to defaults', () => {
		stubLocalStorage();
		const defaults = loadShortfallFilters();
		expect(defaults.sortDirection).toBe('desc');
		expect(defaults.mailFilters).toEqual(['mailable', 'not-mailable']);
		expect(defaults.maxedOnly).toBe(false);
		expect(defaults.exceedsCapOnly).toBe(false);
		expect(defaults.sourceFilters).toEqual([]);
		expect(defaults.categoryFilters).toEqual([]);

		saveShortfallFilters({
			sortDirection: 'asc',
			mailFilters: ['mailable'],
			maxedOnly: true,
			exceedsCapOnly: true,
			sourceFilters: ['workshop', 'small-cave'],
			categoryFilters: ['pet', 'explore']
		});

		const loaded = loadShortfallFilters();
		expect(loaded.sortDirection).toBe('asc');
		expect(loaded.mailFilters).toEqual(['mailable']);
		expect(loaded.maxedOnly).toBe(true);
		expect(loaded.exceedsCapOnly).toBe(true);
		expect(loaded.sourceFilters).toEqual(['workshop', 'small-cave']);
		expect(loaded.categoryFilters).toEqual(['pet', 'explore']);
	});

	it('round-trips showLocationSources and showAlternativeSources with default true', () => {
		stubLocalStorage();
		expect(loadShowLocationSources()).toBe(true);
		expect(loadShowAlternativeSources()).toBe(true);

		saveShowLocationSources(false);
		expect(loadShowLocationSources()).toBe(false);

		saveShowAlternativeSources(false);
		expect(loadShowAlternativeSources()).toBe(false);
	});

	it('correctly reports unread changelog status', () => {
		stubLocalStorage();
		expect(hasUnreadChangelog('0.4.2')).toBe(true);
		saveLastSeenChangelogVersion('0.4.2');
		expect(hasUnreadChangelog('0.4.2')).toBe(false);
		expect(hasUnreadChangelog('0.4.3')).toBe(true);
	});
});
