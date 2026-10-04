import { base } from '$app/paths';

export interface MiningData {
	name: string;
	image: string;
}

/** Cave images are hotlinked directly from FarmRPG's CDN */
const FARMRPG_ORIGIN = 'https://farmrpg.com';

/** Module-level state hoisted out of components */
let imageByName = $state<Map<string, string>>(new Map());
let locationNames = $state<string[]>([]);
let miningHydrated = $state(false);
let miningError = $state(false);
let loadPromise: Promise<void> | null = null;

async function fetchMining(): Promise<void> {
	try {
		const res = await fetch(`${base}/mining.json`);
		if (!res.ok) throw new Error(`mining.json fetch failed: ${res.status}`);
		const parsed: unknown = await res.json();
		if (!Array.isArray(parsed)) throw new Error('mining.json failed shape validation');
		const locations = parsed as MiningData[];

		imageByName = new Map(locations.map((loc) => [loc.name, loc.image]));
		locationNames = locations.map((loc) => loc.name);
	} catch (err) {
		console.error(err);
		miningError = true;
	} finally {
		miningHydrated = true;
	}
}

/** Idempotent: safe to call from every mount, only fetches on the first call. */
export function loadMining(): Promise<void> {
	if (!loadPromise) {
		loadPromise = fetchMining();
	}
	return loadPromise;
}

/** Clears the cached fetch and re-runs it for retry actions. */
export function retryMining(): Promise<void> {
	miningError = false;
	loadPromise = null;
	return loadMining();
}

export function getMiningState() {
	return {
		get locationNames() {
			return locationNames;
		},
		get miningHydrated() {
			return miningHydrated;
		},
		get miningError() {
			return miningError;
		}
	};
}

export function getMiningImagePath(name: string): string | undefined {
	const image = imageByName.get(name);
	return image ? `${FARMRPG_ORIGIN}${image}` : undefined;
}