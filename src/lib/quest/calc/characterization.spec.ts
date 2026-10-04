import { describe, expect, it } from 'vitest';
import fixtureData from './characterization-fixtures.json';
import { diffQuestline, diffQuestlineQueue } from './diff';
import type { PlayerStats, Questline } from '../types';

const questlines = fixtureData as Record<string, Questline>;

const characterizationInventory = new Map<string, number>([
	['Corn', 2500],
	['Corn Oil', 400],
	['Salt', 500],
	['Potato Battery', 2500],
	['Engine', 250],
	['Jack-o-lantern', 600],
	['Bat Wing', 500],
	['Black Powder', 200],
	['Lantern', 100]
]);

const characterizationCompleted = new Set([
	'Corn of Interest::Corn of Interest Part 01',
	'Deck The Town (With Bats And Lanterns)::Deck The Town (With Bats And Lanterns) I'
]);

// diffQuestline does not consume player stats; this fixed profile is kept beside
// the golden inputs so any future eligibility characterization uses the same player state.
const characterizationStats: PlayerStats = {
	farming: 99,
	fishing: 99,
	crafting: 99,
	exploring: 99,
	tower: 220,
	cooking: 74,
	mining: 0,
	npcLevels: {}
};

void characterizationStats;

describe('real questline characterization', () => {
	it('captures Corn of Interest with fixed inventory and progress', () => {
		const output = diffQuestline(
			questlines['Corn of Interest'],
			characterizationInventory,
			characterizationCompleted,
			new Map(),
			new Map()
		);

		expect(output).toMatchSnapshot();
	});

	it('captures Lantern and Black Powder requirements', () => {
		const output = diffQuestline(
			questlines['Deck The Town (With Bats And Lanterns)'],
			characterizationInventory,
			characterizationCompleted,
			new Map(),
			new Map()
		);

		expect(output).toMatchSnapshot();
	});

	it.each(['Explosively Thankful', 'Cosplay Costume', 'A Taste for Gold'])(
		'captures the real %s questline',
		(name) => {
			const output = diffQuestline(
				questlines[name],
				characterizationInventory,
				new Set(),
				new Map(),
				new Map()
			);

			expect(output).toMatchSnapshot();
		}
	);

	it('captures shared inventory consumption across a three-questline queue', () => {
		const output = diffQuestlineQueue(
			[
				questlines['Corn of Interest'],
				questlines['Deck The Town (With Bats And Lanterns)'],
				questlines['Explosively Thankful']
			],
			characterizationInventory,
			characterizationCompleted,
			new Map(),
			new Map()
		);

		expect(output).toMatchSnapshot();
	});
});
