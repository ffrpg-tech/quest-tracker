import { base } from '$app/paths';

interface ItemData {
	name: string;
	image: string;
	canMail?: boolean;
}

/** Item images are hotlinked directly from FarmRPG's own CDN, never downloaded/served locally. */
const FARMRPG_ORIGIN = 'https://farmrpg.com';

/** Module-level state — see questlinesStore.svelte.ts for why this is hoisted out of the page component rather than fetched in onMount. */
let imageByName = $state<Map<string, string>>(new Map());
let itemNames = $state<Set<string>>(new Set());
// Absent entries (e.g. an older cached items.sample.json fetched before this field
// shipped) mean "unknown", not "can't be mailed" — see getItemCanMail below.
let canMailByName = $state<Map<string, boolean>>(new Map());
let itemsHydrated = $state(false);
let itemsError = $state(false);
let loadPromise: Promise<void> | null = null;

async function fetchItems(): Promise<void> {
	try {
		const res = await fetch(`${base}/items.json`);
		if (!res.ok) throw new Error(`items.json fetch failed: ${res.status}`);
		const parsed: unknown = await res.json();
		if (!Array.isArray(parsed)) throw new Error('items.json failed shape validation');
		const items = parsed as ItemData[];
		imageByName = new Map(items.map((item) => [item.name, item.image]));
		itemNames = new Set(items.map((item) => item.name));
		canMailByName = new Map(
			items
				.filter((item) => item.canMail !== undefined)
				.map((item) => [item.name, item.canMail as boolean])
		);
	} catch (err) {
		console.error(err);
		itemsError = true;
	} finally {
		itemsHydrated = true;
	}
}

/** Idempotent: safe to call from every mount, only fetches on the first call. */
export function loadItems(): Promise<void> {
	if (!loadPromise) {
		loadPromise = fetchItems();
	}
	return loadPromise;
}

/** Clears the cached fetch and re-runs it — for a "retry" action after a failed fetch,
 * so the user isn't forced into a full page reload to recover from a transient network
 * blip. */
export function retryItems(): Promise<void> {
	itemsError = false;
	loadPromise = null;
	return loadItems();
}

export function getItemsState() {
	return {
		get itemNames() {
			return itemNames;
		},
		get itemsHydrated() {
			return itemsHydrated;
		},
		get itemsError() {
			return itemsError;
		}
	};
}

/** Silver is a synthetic requirement (see diff.ts) with no entry in the upstream-sourced
 * items.json, so its image is hardcoded here rather than relying on the fetched data. */
const SILVER_IMAGE = '/img/items/silver.png';

export function getItemImagePath(name: string): string | undefined {
	if (name === 'Silver') return `${FARMRPG_ORIGIN}${SILVER_IMAGE}`;
	const image = imageByName.get(name);
	return image ? `${FARMRPG_ORIGIN}${image}` : undefined;
}

/** `undefined` means "unknown" (field absent from the fetched data) — only render the
 * "can't be mailed" badge when this is explicitly `false`. */
export function getItemCanMail(name: string): boolean | undefined {
	return canMailByName.get(name);
}
