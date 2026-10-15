import { describe, expect, it } from 'vitest';
import {
	resolveItemSources,
	getFullSourceImageUrl,
	getItemSources,
	getLocationMeta,
	getSourcesState
} from './sourcesStore.svelte';

describe('sourcesStore resolution logic', () => {
	it('converts relative image paths to full FarmRPG CDN URLs', () => {
		expect(getFullSourceImageUrl('/img/items/cave.png')).toBe(
			'https://farmrpg.com/img/items/cave.png'
		);
		expect(getFullSourceImageUrl('img/pets/cat.png')).toBe('https://farmrpg.com/img/pets/cat.png');
		expect(getFullSourceImageUrl('https://external.com/img.png')).toBe(
			'https://external.com/img.png'
		);
		expect(getFullSourceImageUrl(undefined)).toBeUndefined();
	});

	it('returns null primary when item has no sources', () => {
		const res = resolveItemSources('NonExistentItem12345', null);
		expect(res.primary).toBeNull();
		expect(res.secondary).toEqual([]);
	});

	it('returns empty array when item has no source references', () => {
		expect(getItemSources('NonExistentItem12345')).toEqual([]);
		expect(getLocationMeta('non-existent-location')).toBeUndefined();
	});

	it('exposes sources state getters correctly', () => {
		const state = getSourcesState();
		expect(typeof state.sourcesHydrated).toBe('boolean');
		expect(typeof state.sourcesError).toBe('boolean');
		expect(state.sourcesLastUpdated === null || typeof state.sourcesLastUpdated === 'string').toBe(
			true
		);
	});

	it('includes mining locations and drop mappings in static datasets', async () => {
		const fs = await import('node:fs');
		const locs = JSON.parse(fs.readFileSync('static/locations.json', 'utf8'));
		const sources = JSON.parse(fs.readFileSync('static/item-sources.json', 'utf8'));

		expect(locs['spring-cave']).toEqual({
			name: 'Spring Cave',
			type: 'mining',
			image: '/img/items/springcave.png'
		});
		expect(locs['mossrock-mine']).toEqual({
			name: 'Mossrock Mine',
			type: 'mining',
			image: '/img/items/Moss_cave.png'
		});

		expect(sources['Esperium']).toEqual(expect.arrayContaining([{ locId: 'spring-cave' }]));
		expect(sources['Calcifite']).toEqual([{ locId: 'spring-cave' }]);
		expect(sources['Fairy Crystal']).toEqual([{ locId: 'highland-hollow' }]);
		expect(sources['Pyredrop']).toEqual([{ locId: 'sol-grotto' }]);
		expect(sources['Embershard']).toEqual([{ locId: 'ember-caverns' }]);
		expect(sources['Mossy Stone']).toEqual([{ locId: 'fenrirs-den' }]);
		expect(sources['Gravicite']).toEqual([{ locId: 'mossrock-mine' }]);
	});

	it('includes locksmith, wheel of borgen, flea market, and borgen in static datasets', async () => {
		const fs = await import('node:fs');
		const locs = JSON.parse(fs.readFileSync('static/locations.json', 'utf8'));
		const sources = JSON.parse(fs.readFileSync('static/item-sources.json', 'utf8'));

		expect(locs['locksmith']).toEqual({
			name: 'Locksmith',
			type: 'store',
			image: '/img/items/basickey.png'
		});
		expect(locs['wheel-of-borgen']).toEqual({
			name: 'Wheel of Borgen',
			type: 'store',
			image: '/img/items/wheel.png'
		});
		expect(locs['flea-market']).toEqual({
			name: 'Flea Market',
			type: 'store'
		});
		expect(locs['borgen']).toEqual({
			name: "Borgen's Shop",
			type: 'store',
			image: '/img/items/borgen.png'
		});

		expect(sources['Ancient Coin']).toEqual(
			expect.arrayContaining([
				{ locId: 'flea-market' },
				{ locId: 'wheel-of-borgen' },
				{ locId: 'locksmith', tier: 'Large Chest 01' }
			])
		);
		expect(sources['Lemonade']).toEqual(
			expect.arrayContaining([
				{ locId: 'flea-market' },
				{ locId: 'wheel-of-borgen' },
				{ locId: 'locksmith', tier: 'Grab Bag 06' }
			])
		);
		expect(sources['Runestone 01']).toEqual(
			expect.arrayContaining([{ locId: 'locksmith', tier: 'Grab Bag 04' }])
		);
		expect(sources['Grab Bag 03']).toEqual([{ locId: 'borgen' }]);
	});

	it('includes temple regular chains in static datasets and maps them correctly', async () => {
		const fs = await import('node:fs');
		const locs = JSON.parse(fs.readFileSync('static/locations.json', 'utf8'));
		const sources = JSON.parse(fs.readFileSync('static/item-sources.json', 'utf8'));

		expect(locs['temple']).toEqual({
			name: 'Temples',
			type: 'temple',
			image: '/img/items/temple.png'
		});

		const regularChainsItems = [
			'Gold Mega Trout',
			'Cutlass',
			'Lucky Spiral Belt',
			'Runestone 20',
			'Diamond',
			'Honey',
			'Gold Potato',
			'Piece of Heart',
			'Gold Boot',
			'Mini Time Egg',
			'Broken Memory Belt',
			'Piece 12'
		];

		for (const item of regularChainsItems) {
			expect(sources[item]).toEqual(
				expect.arrayContaining([{ locId: 'temple', tier: 'Regular Chains' }])
			);
		}
	});
});
