import { base } from '$app/paths';
import { SvelteSet } from 'svelte/reactivity';
import { getSourceUrl } from '$lib/ui/buddyFarmLink';
import type { PlayerStats } from '../types';

export interface LocationMeta {
	name: string;
	image?: string;
	type:
		| 'explore'
		| 'fish'
		| 'store'
		| 'farm'
		| 'building'
		| 'pet'
		| 'well'
		| 'exchange'
		| 'temple'
		| 'workshop'
		| 'mining';
	reqSkill?: 'exploring' | 'fishing' | 'farming' | 'mining';
	reqLevel?: number;
	reqQuest?: string;
	season?: { startDate: string; endDate: string };
}

export interface ItemSourceRef {
	locId: string;
	tier?: string;
	season?: { startDate: string; endDate: string };
}

export interface ResolvedSource {
	locId: string;
	name: string;
	image?: string;
	type: LocationMeta['type'];
	tier?: string;
	unlocked: boolean;
	reqSkill?: string;
	reqLevel?: number;
	isSeasonal?: boolean;
	seasonalActive?: boolean;
	seasonalDates?: string;
	buddyUrl?: string;
}

export interface ItemSourcesResolution {
	primary: ResolvedSource | null;
	secondary: ResolvedSource[];
}

const FARMRPG_ORIGIN = 'https://farmrpg.com';

let locationsMap = $state<Map<string, LocationMeta>>(new Map());
let itemSourcesMap = $state<Map<string, ItemSourceRef[]>>(new Map());
let sourcesHydrated = $state(false);
let sourcesError = $state(false);
let sourcesLastUpdated = $state<string | null>(null);
let loadPromise: Promise<void> | null = null;

async function fetchSourcesMeta(): Promise<void> {
	try {
		const res = await fetch(`${base}/item-sources-meta.json`);
		if (!res.ok) return;
		const parsed: unknown = await res.json();
		if (
			parsed &&
			typeof parsed === 'object' &&
			'lastUpdated' in parsed &&
			typeof parsed.lastUpdated === 'string'
		) {
			sourcesLastUpdated = parsed.lastUpdated;
		}
	} catch (err) {
		console.error('Failed to load item-sources-meta:', err);
	}
}

async function fetchSources(): Promise<void> {
	try {
		const [locRes, sourcesRes] = await Promise.all([
			fetch(`${base}/locations.json`),
			fetch(`${base}/item-sources.json`),
			fetchSourcesMeta()
		]);

		if (!locRes.ok) throw new Error(`locations.json fetch failed: ${locRes.status}`);
		if (!sourcesRes.ok) throw new Error(`item-sources.json fetch failed: ${sourcesRes.status}`);

		const parsedLoc: unknown = await locRes.json();
		const parsedSources: unknown = await sourcesRes.json();

		if (!parsedLoc || typeof parsedLoc !== 'object') {
			throw new Error('locations.json failed shape validation');
		}
		if (!parsedSources || typeof parsedSources !== 'object') {
			throw new Error('item-sources.json failed shape validation');
		}

		locationsMap = new Map(Object.entries(parsedLoc as Record<string, LocationMeta>));
		itemSourcesMap = new Map(Object.entries(parsedSources as Record<string, ItemSourceRef[]>));
	} catch (err) {
		console.error('Failed to load item sources:', err);
		sourcesError = true;
	} finally {
		sourcesHydrated = true;
	}
}

export function loadSources(): Promise<void> {
	if (!loadPromise) {
		loadPromise = fetchSources();
	}
	return loadPromise;
}

export function retrySources(): Promise<void> {
	sourcesError = false;
	loadPromise = null;
	return loadSources();
}

export function getItemSources(itemName: string): ItemSourceRef[] {
	return itemSourcesMap.get(itemName) ?? [];
}

export function getLocationMeta(locId: string): LocationMeta | undefined {
	return locationsMap.get(locId);
}

export function getAllLocations(): Map<string, LocationMeta> {
	return locationsMap;
}

export function getSourcesState() {
	return {
		get sourcesHydrated() {
			return sourcesHydrated;
		},
		get sourcesError() {
			return sourcesError;
		},
		get sourcesLastUpdated() {
			return sourcesLastUpdated;
		}
	};
}

export function getFullSourceImageUrl(imagePath?: string): string | undefined {
	if (!imagePath) return undefined;
	if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
	return `${FARMRPG_ORIGIN}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
}

const failedImages = new SvelteSet<string>();

export function isImageFailed(imagePath?: string): boolean {
	if (!imagePath) return true;
	return failedImages.has(imagePath);
}

export function markImageFailed(imagePath?: string): void {
	if (imagePath) {
		failedImages.add(imagePath);
	}
}

function checkSeasonActive(
	season?: { startDate: string; endDate: string },
	now = new Date()
): { isSeasonal: boolean; active: boolean; dates: string } {
	if (!season) return { isSeasonal: false, active: true, dates: '' };

	const [startM, startD] = season.startDate.split('-').map(Number);
	const [endM, endD] = season.endDate.split('-').map(Number);

	const curM = now.getMonth() + 1;
	const curD = now.getDate();
	const curCode = curM * 100 + curD;
	const startCode = startM * 100 + startD;
	const endCode = endM * 100 + endD;

	let active = false;
	if (startCode <= endCode) {
		active = curCode >= startCode && curCode <= endCode;
	} else {
		// Window crosses new year
		active = curCode >= startCode || curCode <= endCode;
	}

	const fmtMonth = (m: number, d: number) => {
		const dt = new Date(2026, m - 1, d);
		return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	};

	return {
		isSeasonal: true,
		active,
		dates: `${fmtMonth(startM, startD)} – ${fmtMonth(endM, endD)}`
	};
}

/**
 * Resolves an item's primary location and secondary alternatives.
 * Priority rule: Authored array order in item-sources.json.
 * The first unlocked source in array order becomes primary.
 */
export function resolveItemSources(
	itemName: string,
	playerStats: PlayerStats | null
): ItemSourcesResolution {
	const refs = itemSourcesMap.get(itemName);
	if (!refs || refs.length === 0) {
		return { primary: null, secondary: [] };
	}

	const resolvedList: ResolvedSource[] = [];

	for (const ref of refs) {
		const loc = locationsMap.get(ref.locId);
		if (!loc) continue;

		let unlocked = true;
		if (loc.reqSkill && loc.reqLevel) {
			const skillLvl = playerStats ? (playerStats[loc.reqSkill] ?? 0) : 0;
			// If player has stats, check skill; if stats not imported yet (null), treat level 1 as unlocked
			unlocked = playerStats ? skillLvl >= loc.reqLevel : loc.reqLevel <= 1;
		}

		const season = ref.season || loc.season;
		const seasonStatus = checkSeasonActive(season);

		const buddyUrl = getSourceUrl(loc.name, loc.type) ?? undefined;

		resolvedList.push({
			locId: ref.locId,
			name: loc.name,
			image: loc.image,
			type: loc.type,
			tier: ref.tier,
			unlocked,
			reqSkill: loc.reqSkill,
			reqLevel: loc.reqLevel,
			isSeasonal: seasonStatus.isSeasonal,
			seasonalActive: seasonStatus.active,
			seasonalDates: seasonStatus.dates,
			buddyUrl
		});
	}

	if (resolvedList.length === 0) {
		return { primary: null, secondary: [] };
	}

	// First unlocked source in authored order is primary
	let primaryIndex = resolvedList.findIndex((s) => s.unlocked);
	if (primaryIndex === -1) {
		// All are locked: pick the one with lowest level requirement
		let minReq = Infinity;
		primaryIndex = 0;
		for (let i = 0; i < resolvedList.length; i++) {
			const req = resolvedList[i].reqLevel ?? Infinity;
			if (req < minReq) {
				minReq = req;
				primaryIndex = i;
			}
		}
	}

	const primary = resolvedList[primaryIndex];
	const secondary = resolvedList.filter((_, idx) => idx !== primaryIndex);

	return { primary, secondary };
}
