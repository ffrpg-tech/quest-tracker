import { describe, expect, it } from 'vitest';
import {
	resolveItemSources,
	getFullSourceImageUrl,
	getItemSources,
	getLocationMeta,
	getSourcesState,
	type LocationMeta,
	type ItemSourceRef
} from './sourcesStore.svelte';
import type { PlayerStats } from '../types';

describe('sourcesStore resolution logic', () => {
	it('converts relative image paths to full FarmRPG CDN URLs', () => {
		expect(getFullSourceImageUrl('/img/items/cave.png')).toBe('https://farmrpg.com/img/items/cave.png');
		expect(getFullSourceImageUrl('img/pets/cat.png')).toBe('https://farmrpg.com/img/pets/cat.png');
		expect(getFullSourceImageUrl('https://external.com/img.png')).toBe('https://external.com/img.png');
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
		expect(state.sourcesLastUpdated === null || typeof state.sourcesLastUpdated === 'string').toBe(true);
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
});
