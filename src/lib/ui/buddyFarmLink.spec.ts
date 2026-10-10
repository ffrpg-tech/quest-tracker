import { describe, expect, it } from 'vitest';
import {
	slugify,
	buddyFarmItemUrl,
	buddyFarmLocationUrl,
	buddyFarmPetUrl,
	getSourceUrl
} from './buddyFarmLink';

describe('buddyFarmLink', () => {
	it('slugifies item names correctly', () => {
		expect(slugify('Wood')).toBe('wood');
		expect(slugify('Buddystone')).toBe('buddystone');
		expect(slugify("Cursed Effigy Hair")).toBe('cursed-effigy-hair');
		expect(slugify("Santa's Workshop")).toBe('santas-workshop');
		expect(slugify("Gary's Crushroom")).toBe('garys-crushroom');
	});

	it('builds item URLs', () => {
		expect(buddyFarmItemUrl('Wood')).toBe('https://buddy.farm/i/wood/');
		expect(buddyFarmItemUrl('Cursed Effigy Hair')).toBe('https://buddy.farm/i/cursed-effigy-hair/');
	});

	it('builds location URLs', () => {
		expect(buddyFarmLocationUrl('Small Cave')).toBe('https://buddy.farm/l/small-cave/');
		expect(buddyFarmLocationUrl('Small Pond')).toBe('https://buddy.farm/l/small-pond/');
		expect(buddyFarmLocationUrl("Santa's Workshop")).toBe('https://buddy.farm/l/santas-workshop/');
	});

	it('builds pet URLs', () => {
		expect(buddyFarmPetUrl('Cat')).toBe('https://buddy.farm/p/cat/');
		expect(buddyFarmPetUrl('Green Dragon')).toBe('https://buddy.farm/p/green-dragon/');
		expect(buddyFarmPetUrl('Pet Rock')).toBe('https://buddy.farm/p/pet-rock/');
	});

	it('resolves valid outbound source URLs only for exploring, fishing, and pets', () => {
		expect(getSourceUrl('Small Cave', 'explore')).toBe('https://buddy.farm/l/small-cave/');
		expect(getSourceUrl('Small Pond', 'fish')).toBe('https://buddy.farm/l/small-pond/');
		expect(getSourceUrl('Spring Cave', 'mining')).toBe('https://buddy.farm/l/spring-cave/');
		expect(getSourceUrl('Cat (Level 1)', 'pet')).toBe('https://buddy.farm/p/cat/');
		expect(getSourceUrl('Sinking Swamp (Explore)', 'explore')).toBe('https://buddy.farm/l/sinking-swamp/');
		// Other categories should return null (no 404 links)
		expect(getSourceUrl('Workshop', 'workshop')).toBeNull();
		expect(getSourceUrl('Sawmill', 'building')).toBeNull();
		expect(getSourceUrl('Cow Pasture', 'building')).toBeNull();
		expect(getSourceUrl('Farm Crops', 'farm')).toBeNull();
		expect(getSourceUrl('Wishing Well', 'well')).toBeNull();
		expect(getSourceUrl('Country Store', 'store')).toBeNull();
		expect(getSourceUrl('Temples', 'temple')).toBeNull();
	});
});
