import { describe, it, expect } from 'vitest';
import {
	aggregateQueueShortfalls,
	diffQuestline,
	diffQuestlineQueue,
	findRunsDryPoints
} from './diff';
import { questKey, type Questline } from '../types';

const questline: Questline = {
	name: 'Test Chain',
	questCount: 3,
	quests: [
		{
			name: 'Test Chain I',
			startDate: '',
			endDate: '',
			requirements: [{ item: 'Wood', qty: 5 }],
			seq: 1
		},
		{
			name: 'Test Chain II',
			startDate: '',
			endDate: '',
			requirements: [{ item: 'Wood', qty: 10 }],
			seq: 2
		},
		{
			name: 'Test Chain III',
			startDate: '',
			endDate: '',
			requirements: [{ item: 'Wood', qty: 1 }],
			seq: 3
		}
	]
};

describe('diffQuestline', () => {
	it('finds no wall point when inventory covers the whole chain', () => {
		const result = diffQuestline(questline, new Map([['Wood', 20]]));
		expect(result.wallPointIndex).toBeNull();
		expect(result.quests.every((q) => q.ok)).toBe(true);
	});

	it('identifies the exact quest where inventory runs dry', () => {
		// 5 for quest I leaves 7, quest II needs 10 -> shortfall of 3 at index 1
		const result = diffQuestline(questline, new Map([['Wood', 12]]));
		expect(result.wallPointIndex).toBe(1);
		expect(result.quests[0].ok).toBe(true);
		expect(result.quests[1].ok).toBe(false);
		expect(result.quests[1].shortfalls).toEqual([{ item: 'Wood', needed: 10, have: 7, short: 3 }]);
	});

	it('keeps needed/have/short internally consistent in totalShortfalls when the same item is short across multiple quests', () => {
		// Wood=12: quest I (need 5) leaves 7; quest II (need 10, have 7) is short
		// 3, inv floors at 0; quest III (need 1, have 0) is short 1. Aggregate
		// across both shortfalls should be needed=11, short=4, have=needed-short=7
		// — not the first-hit quest's stale {needed:10, have:7} with only short
		// correctly summed.
		const result = diffQuestline(questline, new Map([['Wood', 12]]));
		expect(result.totalShortfalls).toEqual([
			{
				item: 'Wood',
				needed: 11,
				have: 7,
				short: 4,
				byQuest: [
					{ questName: 'Test Chain II', seq: 2, short: 3 },
					{ questName: 'Test Chain III', seq: 3, short: 1 }
				]
			}
		]);
	});

	it('treats a missing item as zero on hand rather than throwing', () => {
		const result = diffQuestline(questline, new Map());
		expect(result.wallPointIndex).toBe(0);
		expect(result.quests[0].shortfalls[0]).toEqual({
			item: 'Wood',
			needed: 5,
			have: 0,
			short: 5
		});
	});

	it('skips requirement checks and inventory deduction for quests already marked complete', () => {
		// Only 6 Wood on hand — quest I alone would eat 5 of it, but it's marked
		// done, so quest II's shortfall should be computed against the full 6.
		const completed = new Set([questKey('Test Chain', 'Test Chain I')]);
		const result = diffQuestline(questline, new Map([['Wood', 6]]), completed);

		expect(result.quests[0].done).toBe(true);
		expect(result.quests[0].ok).toBe(true);
		expect(result.quests[0].shortfalls).toEqual([]);

		expect(result.quests[1].done).toBe(false);
		expect(result.quests[1].ok).toBe(false);
		expect(result.quests[1].shortfalls).toEqual([{ item: 'Wood', needed: 10, have: 6, short: 4 }]);
		expect(result.wallPointIndex).toBe(1);
	});

	it('flags a shortfall as capped when the requirement exceeds a known storage cap', () => {
		// Player's Wood caps out at 8 (from a "MAX ON HAND" paste) — quest II
		// needs 10 at once, which is structurally impossible regardless of how
		// much they farm, not an ordinary "gather more" shortfall.
		const caps = new Map([['Wood', 8]]);
		const result = diffQuestline(questline, new Map([['Wood', 8]]), new Set(), caps);

		// Quest I consumes 5 of the 8 Wood on hand first, leaving 3 for quest II.
		expect(result.quests[1].shortfalls).toEqual([
			{ item: 'Wood', needed: 10, have: 3, short: 7, capped: true }
		]);
		expect(result.totalShortfalls[0].capped).toBe(true);
	});

	it('does not flag a shortfall as capped when the requirement is within the known cap', () => {
		// Cap is 20, well above what any single quest needs — an ordinary
		// shortfall from having too little on hand right now, not a cap issue.
		const caps = new Map([['Wood', 20]]);
		const result = diffQuestline(questline, new Map([['Wood', 6]]), new Set(), caps);

		expect(result.quests[1].shortfalls[0].capped).toBeUndefined();
	});

	it('uses nested recipes and shares their raw materials across the walk', () => {
		const craftQuestline: Questline = {
			name: 'Craft Chain',
			questCount: 2,
			quests: [
				{
					name: 'Craft Chain I',
					startDate: '',
					endDate: '',
					requirements: [{ item: 'Crate', qty: 1 }],
					seq: 1
				},
				{
					name: 'Craft Chain II',
					startDate: '',
					endDate: '',
					requirements: [{ item: 'Crate', qty: 1 }],
					seq: 2
				}
			]
		};
		const recipes = new Map([
			['Crate', [{ item: 'Board', qty: 2 }]],
			['Board', [{ item: 'Wood', qty: 1 }]]
		]);

		const result = diffQuestline(
			craftQuestline,
			new Map([['Wood', 2]]),
			new Set(),
			new Map(),
			recipes
		);

		expect(result.quests[0].shortfalls[0]).toEqual({
			item: 'Crate',
			needed: 1,
			have: 0,
			short: 1,
			craftableQty: 1,
			craftTree: expect.objectContaining({ item: 'Crate', needed: 1, left: 0, craftable: true })
		});
		expect(result.quests[1].shortfalls[0]).toEqual({
			item: 'Crate',
			needed: 1,
			have: 0,
			short: 1,
			craftableQty: 0,
			craftTree: expect.objectContaining({ item: 'Crate', needed: 1, left: 1, craftable: true }),
			rawShortfalls: new Map([['Wood', 2]])
		});
	});

	it('does not double spend shared raws between two different intermediate items in the same queue', () => {
		const questlineA: Questline = {
			name: 'Chain A',
			questCount: 1,
			quests: [
				{
					name: 'Chain A I',
					startDate: '',
					endDate: '',
					requirements: [{ item: 'Crate', qty: 1 }],
					seq: 1
				}
			]
		};
		const questlineB: Questline = {
			name: 'Chain B',
			questCount: 1,
			quests: [
				{
					name: 'Chain B I',
					startDate: '',
					endDate: '',
					requirements: [{ item: 'Tool', qty: 1 }],
					seq: 1
				}
			]
		};
		const recipes = new Map([
			['Crate', [{ item: 'Board', qty: 1 }]],
			['Board', [{ item: 'Wood', qty: 2 }]],
			['Tool', [{ item: 'Handle', qty: 1 }]],
			['Handle', [{ item: 'Wood', qty: 2 }]]
		]);

		const [resultA, resultB] = diffQuestlineQueue(
			[questlineA, questlineB],
			new Map([['Wood', 2]]),
			new Set(),
			new Map(),
			recipes
		);

		// Chain A gets the 2 Wood to craft 1 Crate (via 1 Board)
		expect(resultA.quests[0].shortfalls[0]).toMatchObject({
			item: 'Crate',
			needed: 1,
			have: 0,
			short: 1,
			craftableQty: 1,
			craftTree: expect.objectContaining({ item: 'Crate', craftableQty: 1, left: 0 })
		});

		// Chain B cannot double-spend the 2 Wood: Tool (via Handle) cannot be crafted
		expect(resultB.quests[0].shortfalls[0]).toMatchObject({
			item: 'Tool',
			needed: 1,
			have: 0,
			short: 1,
			craftableQty: 0,
			craftTree: expect.objectContaining({ item: 'Tool', craftableQty: 0, left: 1 }),
			rawShortfalls: new Map([['Wood', 2]])
		});
	});

	it('transfers priority when queue order of different intermediate items is reversed', () => {
		const questlineA: Questline = {
			name: 'Chain A',
			questCount: 1,
			quests: [
				{
					name: 'Chain A I',
					startDate: '',
					endDate: '',
					requirements: [{ item: 'Crate', qty: 1 }],
					seq: 1
				}
			]
		};
		const questlineB: Questline = {
			name: 'Chain B',
			questCount: 1,
			quests: [
				{
					name: 'Chain B I',
					startDate: '',
					endDate: '',
					requirements: [{ item: 'Tool', qty: 1 }],
					seq: 1
				}
			]
		};
		const recipes = new Map([
			['Crate', [{ item: 'Board', qty: 1 }]],
			['Board', [{ item: 'Wood', qty: 2 }]],
			['Tool', [{ item: 'Handle', qty: 1 }]],
			['Handle', [{ item: 'Wood', qty: 2 }]]
		]);

		// Reverse queue order: Chain B comes first
		const [resultB, resultA] = diffQuestlineQueue(
			[questlineB, questlineA],
			new Map([['Wood', 2]]),
			new Set(),
			new Map(),
			recipes
		);

		// Chain B now gets the 2 Wood
		expect(resultB.quests[0].shortfalls[0]).toMatchObject({
			item: 'Tool',
			needed: 1,
			have: 0,
			short: 1,
			craftableQty: 1,
			craftTree: expect.objectContaining({ item: 'Tool', craftableQty: 1, left: 0 })
		});

		// Chain A now has 0 craftable
		expect(resultA.quests[0].shortfalls[0]).toMatchObject({
			item: 'Crate',
			needed: 1,
			have: 0,
			short: 1,
			craftableQty: 0,
			craftTree: expect.objectContaining({ item: 'Crate', craftableQty: 0, left: 1 }),
			rawShortfalls: new Map([['Wood', 2]])
		});
	});

	it('does not double spend shared raws between two different intermediate items in the same questline', () => {
		const questline: Questline = {
			name: 'Multi-Craft Chain',
			questCount: 2,
			quests: [
				{
					name: 'Step 1',
					startDate: '',
					endDate: '',
					requirements: [{ item: 'Crate', qty: 1 }],
					seq: 1
				},
				{
					name: 'Step 2',
					startDate: '',
					endDate: '',
					requirements: [{ item: 'Tool', qty: 1 }],
					seq: 2
				}
			]
		};
		const recipes = new Map([
			['Crate', [{ item: 'Board', qty: 1 }]],
			['Board', [{ item: 'Wood', qty: 2 }]],
			['Tool', [{ item: 'Handle', qty: 1 }]],
			['Handle', [{ item: 'Wood', qty: 2 }]]
		]);

		const result = diffQuestline(
			questline,
			new Map([['Wood', 2]]),
			new Set(),
			new Map(),
			recipes
		);

		expect(result.quests[0].shortfalls[0]).toMatchObject({
			item: 'Crate',
			needed: 1,
			have: 0,
			short: 1,
			craftableQty: 1,
			craftTree: expect.objectContaining({ item: 'Crate', craftableQty: 1, left: 0 })
		});

		expect(result.quests[1].shortfalls[0]).toMatchObject({
			item: 'Tool',
			needed: 1,
			have: 0,
			short: 1,
			craftableQty: 0,
			craftTree: expect.objectContaining({ item: 'Tool', craftableQty: 0, left: 1 }),
			rawShortfalls: new Map([['Wood', 2]])
		});
	});

	it('does not double spend shared raws between two different intermediate items in the same quest', () => {
		const questline: Questline = {
			name: 'Single Quest Multi-Item',
			questCount: 1,
			quests: [
				{
					name: 'Step 1',
					startDate: '',
					endDate: '',
					requirements: [
						{ item: 'Crate', qty: 1 },
						{ item: 'Tool', qty: 1 }
					],
					seq: 1
				}
			]
		};
		const recipes = new Map([
			['Crate', [{ item: 'Board', qty: 1 }]],
			['Board', [{ item: 'Wood', qty: 2 }]],
			['Tool', [{ item: 'Handle', qty: 1 }]],
			['Handle', [{ item: 'Wood', qty: 2 }]]
		]);

		const result = diffQuestline(
			questline,
			new Map([['Wood', 2]]),
			new Set(),
			new Map(),
			recipes
		);

		expect(result.quests[0].shortfalls[0]).toMatchObject({
			item: 'Crate',
			needed: 1,
			have: 0,
			short: 1,
			craftableQty: 1,
			craftTree: expect.objectContaining({ item: 'Crate', craftableQty: 1, left: 0 })
		});

		expect(result.quests[0].shortfalls[1]).toMatchObject({
			item: 'Tool',
			needed: 1,
			have: 0,
			short: 1,
			craftableQty: 0,
			craftTree: expect.objectContaining({ item: 'Tool', craftableQty: 0, left: 1 }),
			rawShortfalls: new Map([['Wood', 2]])
		});
	});

	it('handles asymmetric tier depths sharing a raw material with stock for one', () => {
		// Grand Crate: 3 tiers (Grand Crate -> Crate -> Board -> Wood: 2)
		// Tool: 2 tiers (Tool -> Handle -> Wood: 2)
		const questline: Questline = {
			name: 'Asymmetric Chain',
			questCount: 2,
			quests: [
				{
					name: 'Step 1',
					startDate: '',
					endDate: '',
					requirements: [{ item: 'Grand Crate', qty: 1 }],
					seq: 1
				},
				{
					name: 'Step 2',
					startDate: '',
					endDate: '',
					requirements: [{ item: 'Tool', qty: 1 }],
					seq: 2
				}
			]
		};
		const recipes = new Map([
			['Grand Crate', [{ item: 'Crate', qty: 1 }]],
			['Crate', [{ item: 'Board', qty: 1 }]],
			['Board', [{ item: 'Wood', qty: 2 }]],
			['Tool', [{ item: 'Handle', qty: 1 }]],
			['Handle', [{ item: 'Wood', qty: 2 }]]
		]);

		const result = diffQuestline(
			questline,
			new Map([['Wood', 2]]),
			new Set(),
			new Map(),
			recipes
		);

		expect(result.quests[0].shortfalls[0]).toMatchObject({
			item: 'Grand Crate',
			craftableQty: 1,
			craftTree: expect.objectContaining({
				item: 'Grand Crate',
				craftableQty: 1,
				left: 0,
				children: [
					expect.objectContaining({
						item: 'Crate',
						craftableQty: 1,
						left: 0,
						children: [
							expect.objectContaining({
								item: 'Board',
								craftableQty: 1,
								left: 0,
								children: [
									expect.objectContaining({
										item: 'Wood',
										have: 2,
										needed: 2,
										left: 0
									})
								]
							})
						]
					})
				]
			})
		});

		expect(result.quests[1].shortfalls[0]).toMatchObject({
			item: 'Tool',
			craftableQty: 0,
			craftTree: expect.objectContaining({
				item: 'Tool',
				craftableQty: 0,
				left: 1,
				children: [
					expect.objectContaining({
						item: 'Handle',
						craftableQty: 0,
						left: 1,
						children: [
							expect.objectContaining({
								item: 'Wood',
								have: 0,
								needed: 2,
								left: 2
							})
						]
					})
				]
			}),
			rawShortfalls: new Map([['Wood', 2]])
		});
	});

	it('does not starve a later intermediate item if an earlier intermediate item cannot be crafted', () => {
		// Chain A needs Crate (needs 4 Wood), stock only has 2 Wood -> Crate craftableQty: 0
		// Chain B needs Tool (needs 2 Wood) -> should be able to craft 1 Tool using the 2 Wood!
		const questlineA: Questline = {
			name: 'Chain A',
			questCount: 1,
			quests: [
				{
					name: 'Chain A I',
					startDate: '',
					endDate: '',
					requirements: [{ item: 'Crate', qty: 1 }],
					seq: 1
				}
			]
		};
		const questlineB: Questline = {
			name: 'Chain B',
			questCount: 1,
			quests: [
				{
					name: 'Chain B I',
					startDate: '',
					endDate: '',
					requirements: [{ item: 'Tool', qty: 1 }],
					seq: 1
				}
			]
		};
		const recipes = new Map([
			['Crate', [{ item: 'Board', qty: 1 }]],
			['Board', [{ item: 'Wood', qty: 4 }]],
			['Tool', [{ item: 'Handle', qty: 1 }]],
			['Handle', [{ item: 'Wood', qty: 2 }]]
		]);

		const [resultA, resultB] = diffQuestlineQueue(
			[questlineA, questlineB],
			new Map([['Wood', 2]]),
			new Set(),
			new Map(),
			recipes
		);

		// Chain A cannot craft Crate (needs 4 Wood, only have 2)
		expect(resultA.quests[0].shortfalls[0]).toMatchObject({
			item: 'Crate',
			craftableQty: 0,
			craftTree: expect.objectContaining({ item: 'Crate', craftableQty: 0, left: 1 }),
			rawShortfalls: new Map([['Wood', 2]])
		});

		// Chain B gets the 2 Wood because Chain A did not consume it
		expect(resultB.quests[0].shortfalls[0]).toMatchObject({
			item: 'Tool',
			craftableQty: 1,
			craftTree: expect.objectContaining({ item: 'Tool', craftableQty: 1, left: 0 })
		});
	});

	it('splits shared raw stock correctly across partial craft quantities in queue', () => {
		// Have 3 Wood.
		// Chain A needs 2 Crates (each Crate needs 1 Board = 2 Wood, so 4 Wood for both).
		// Chain A can only craft 1 Crate (consumes 2 Wood), leaving 1 Wood.
		// Chain B needs 1 Stick (needs 1 Wood).
		// Chain B can craft 1 Stick using the remaining 1 Wood!
		const questlineA: Questline = {
			name: 'Chain A',
			questCount: 1,
			quests: [
				{
					name: 'Chain A I',
					startDate: '',
					endDate: '',
					requirements: [{ item: 'Crate', qty: 2 }],
					seq: 1
				}
			]
		};
		const questlineB: Questline = {
			name: 'Chain B',
			questCount: 1,
			quests: [
				{
					name: 'Chain B I',
					startDate: '',
					endDate: '',
					requirements: [{ item: 'Stick', qty: 1 }],
					seq: 1
				}
			]
		};
		const recipes = new Map([
			['Crate', [{ item: 'Board', qty: 1 }]],
			['Board', [{ item: 'Wood', qty: 2 }]],
			['Stick', [{ item: 'Wood', qty: 1 }]]
		]);

		const [resultA, resultB] = diffQuestlineQueue(
			[questlineA, questlineB],
			new Map([['Wood', 3]]),
			new Set(),
			new Map(),
			recipes
		);

		expect(resultA.quests[0].shortfalls[0]).toMatchObject({
			item: 'Crate',
			needed: 2,
			craftableQty: 1,
			craftTree: expect.objectContaining({ item: 'Crate', craftableQty: 1, left: 1 }),
			rawShortfalls: new Map([['Wood', 1]])
		});

		expect(resultB.quests[0].shortfalls[0]).toMatchObject({
			item: 'Stick',
			needed: 1,
			craftableQty: 1,
			craftTree: expect.objectContaining({ item: 'Stick', craftableQty: 1, left: 0 })
		});
	});
});


describe('diffQuestlineQueue', () => {
	const scarceItemQuestline = (name: string): Questline => ({
		name,
		questCount: 1,
		quests: [
			{
				name: `${name} I`,
				startDate: '',
				endDate: '',
				requirements: [{ item: 'Iron', qty: 10 }],
				seq: 1
			}
		]
	});

	it('gives the first questline in the queue priority on a shared scarce item', () => {
		const a = scarceItemQuestline('Chain A');
		const b = scarceItemQuestline('Chain B');
		const [resultA, resultB] = diffQuestlineQueue([a, b], new Map([['Iron', 10]]));

		expect(resultA.quests[0].ok).toBe(true);
		expect(resultB.quests[0].ok).toBe(false);
		expect(resultB.quests[0].shortfalls).toEqual([
			{ item: 'Iron', needed: 10, have: 0, short: 10 }
		]);
	});

	it('moves the shortfall to the other questline when the queue order is reversed', () => {
		const a = scarceItemQuestline('Chain A');
		const b = scarceItemQuestline('Chain B');
		const [resultB, resultA] = diffQuestlineQueue([b, a], new Map([['Iron', 10]]));

		expect(resultB.quests[0].ok).toBe(true);
		expect(resultA.quests[0].ok).toBe(false);
	});
});

describe('aggregateQueueShortfalls', () => {
	it('rolls up per-questline shortfalls into one queue-wide breakdown per item, by questline and quest', () => {
		const a: Questline = {
			name: 'Chain A',
			questCount: 1,
			quests: [
				{
					name: 'Chain A I',
					startDate: '',
					endDate: '',
					requirements: [{ item: 'Iron', qty: 10 }],
					seq: 1
				}
			]
		};
		const b: Questline = {
			name: 'Chain B',
			questCount: 1,
			quests: [
				{
					name: 'Chain B I',
					startDate: '',
					endDate: '',
					requirements: [{ item: 'Iron', qty: 6 }],
					seq: 1
				}
			]
		};

		const results = diffQuestlineQueue([a, b], new Map());
		const aggregated = aggregateQueueShortfalls(results);

		expect(aggregated).toEqual([
			{
				item: 'Iron',
				needed: 16,
				have: 0,
				short: 16,
				byQuestline: [
					{
						questlineName: 'Chain A',
						short: 10,
						byQuest: [{ questName: 'Chain A I', seq: 1, short: 10 }]
					},
					{
						questlineName: 'Chain B',
						short: 6,
						byQuest: [{ questName: 'Chain B I', seq: 1, short: 6 }]
					}
				]
			}
		]);
	});

	describe('findRunsDryPoints', () => {
		const scarceItemQuestline = (name: string): Questline => ({
			name,
			questCount: 1,
			quests: [
				{
					name: `${name} I`,
					startDate: '',
					endDate: '',
					requirements: [{ item: 'Iron', qty: 10 }],
					seq: 1
				}
			]
		});

		it('finds the first quest, in queue order, where a tracked item goes short', () => {
			const a = scarceItemQuestline('Chain A');
			const b = scarceItemQuestline('Chain B');
			const results = diffQuestlineQueue([a, b], new Map([['Iron', 10]]));

			const runsDryAt = findRunsDryPoints(results, ['Iron']);

			expect(runsDryAt.get('Iron')).toEqual({
				item: 'Iron',
				questlineName: 'Chain B',
				questName: 'Chain B I'
			});
		});

		it('omits an item that never goes short across the whole queue', () => {
			const a = scarceItemQuestline('Chain A');
			const results = diffQuestlineQueue([a], new Map([['Iron', 999]]));

			expect(findRunsDryPoints(results, ['Iron']).has('Iron')).toBe(false);
		});

		it('ignores items not in the tracked set even if they go short', () => {
			const results = diffQuestlineQueue([questline], new Map([['Wood', 12]]));

			expect(findRunsDryPoints(results, ['Iron']).has('Wood')).toBe(false);
		});
	});
});
