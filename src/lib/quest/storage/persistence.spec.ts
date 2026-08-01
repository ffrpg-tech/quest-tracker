import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exportProgress, importProgress, loadCompleted, loadInventory } from './persistence';
import type { PlayerStats } from '../types';

const samplePlayerStats: PlayerStats = {
	farming: 10,
	fishing: 5,
	crafting: 3,
	exploring: 7,
	tower: 1,
	cooking: 2,
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
			setItem: (key: string, value: string) => void store.set(key, value)
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
