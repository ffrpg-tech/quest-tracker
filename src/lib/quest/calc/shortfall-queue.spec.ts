/**
 * shortfall-queue.spec.ts
 *
 * Verification tests for queue-level shortfall logic against reference model.
 *
 * Real recipes from static/recipes.json:
 *   Board        → Wood ×5
 *   Wooden Plank → Board ×4 + Nails ×4
 *   Wooden Barrel → Board ×10 + Iron ×4 + Nails ×10
 *   Wooden Table  → Board ×8 + Nails ×12 + Wooden Plank ×1
 *
 * Reference model:
 *   ONE shared stock pool. Quests processed in queue order. Each requirement
 *   uses on-hand stock of that item first; the remainder is crafted by
 *   recursively expanding the recipe, drawing ingredients from the SAME pool.
 *   Items with no recipe are raw; any remainder of a raw is a shortfall.
 *   Crafts yield exactly 1 and consume ingredients permanently. Surplus
 *   intermediates cannot be converted back into ingredients.
 */

import { describe, expect, it } from 'vitest';
import { diffQuestlineQueue, aggregateQueueShortfalls } from './diff';
import type { Questline } from '../types';
import type { RecipeMap } from './recipes';

// ---------------------------------------------------------------------------
// Shared fixtures & helpers
// ---------------------------------------------------------------------------

/**
 * Real recipe values from static/recipes.json:
 *   Board        → Wood ×5
 *   Wooden Plank → Board ×4 + Nails ×4
 *   Wooden Barrel → Board ×10 + Iron ×4 + Nails ×10
 *   Wooden Table  → Board ×8 + Nails ×12 + Wooden Plank ×1
 */
const RECIPES: RecipeMap = new Map([
	['Board', [{ item: 'Wood', qty: 5 }]],
	[
		'Wooden Plank',
		[
			{ item: 'Board', qty: 4 },
			{ item: 'Nails', qty: 4 }
		]
	],
	[
		'Wooden Barrel',
		[
			{ item: 'Board', qty: 10 },
			{ item: 'Iron', qty: 4 },
			{ item: 'Nails', qty: 10 }
		]
	],
	[
		'Wooden Table',
		[
			{ item: 'Board', qty: 8 },
			{ item: 'Nails', qty: 12 },
			{ item: 'Wooden Plank', qty: 1 }
		]
	]
]);

/** Minimal quest factory — seq is 1-based position. */
function quest(
	name: string,
	seq: number,
	reqs: Array<{ item: string; qty: number }>
): Questline['quests'][number] {
	return { name, seq, requirements: reqs, startDate: '', endDate: '' };
}

/** Single-quest questline factory. */
function ql(name: string, ...quests: Questline['quests']): Questline {
	return { name, questCount: quests.length, quests };
}

/** Helper to sum total raw item shortfall across queue diff results */
function getTotalRawShortfall(
	results: ReturnType<typeof diffQuestlineQueue>,
	rawItem: string
): number {
	let total = 0;
	for (const qlRes of results) {
		for (const qRes of qlRes.quests) {
			for (const s of qRes.shortfalls) {
				if (s.item === rawItem) {
					total += s.short;
				}
				if (s.rawShortfalls && s.rawShortfalls.has(rawItem)) {
					total += s.rawShortfalls.get(rawItem)!;
				}
			}
		}
	}
	return total;
}

// ---------------------------------------------------------------------------
// T1 — large multi-questline queue; first three questlines complete; C1 is the wall
// ---------------------------------------------------------------------------
describe('T1 — large multi-questline queue; first three questlines complete; C1 is the wall', () => {
	/**
	 * Inventory:
	 *   Wooden Table  : 100
	 *   Wooden Barrel : 100
	 *   Wooden Plank  : 2000
	 *   Board         : 2000
	 *   Nails         : 999_999   (abundant)
	 *   Iron          : 999_999   (abundant)
	 *   Wood          : 0         (scarce raw)
	 */
	const INV = new Map([
		['Wooden Table', 100],
		['Wooden Barrel', 100],
		['Wooden Plank', 2000],
		['Board', 2000],
		['Nails', 999_999],
		['Iron', 999_999],
		['Wood', 0]
	]);

	const chainA = ql(
		'Chain A',
		quest('A1', 1, [{ item: 'Wooden Table', qty: 100 }]),
		quest('A2', 2, [{ item: 'Wooden Barrel', qty: 100 }])
	);
	const chainB = ql('Chain B', quest('B1', 1, [{ item: 'Board', qty: 300 }]));
	const chainC = ql(
		'Chain C',
		quest('C1', 1, [
			{ item: 'Wooden Plank', qty: 1000 },
			{ item: 'Wooden Table', qty: 200 },
			{ item: 'Board', qty: 200 },
			{ item: 'Wooden Barrel', qty: 1000 }
		])
	);

	it('T1-a: A1, A2, B1 are ok=true; C1 is the first failing quest', () => {
		const [resA, resB, resC] = diffQuestlineQueue(
			[chainA, chainB, chainC],
			INV,
			new Set(),
			new Map(),
			RECIPES
		);

		expect(resA.quests[0].ok).toBe(true); // A1: Table 100 on hand
		expect(resA.quests[1].ok).toBe(true); // A2: Barrel 100 on hand
		expect(resB.quests[0].ok).toBe(true); // B1: Board 300 on hand (2000 avail)
		expect(resC.quests[0].ok).toBe(false); // C1: fails
		expect(resC.wallPointIndex).toBe(0);
	});

	it('T1-b: C1 Wooden Table requirement (×200) is fully craftable (no raw shortfall)', () => {
		const [, , resC] = diffQuestlineQueue(
			[chainA, chainB, chainC],
			INV,
			new Set(),
			new Map(),
			RECIPES
		);
		const tableShortfall = resC.quests[0].shortfalls.find((s) => s.item === 'Wooden Table');
		expect(tableShortfall).toBeDefined();
		expect(tableShortfall!.short).toBe(200);
		expect(tableShortfall!.craftableQty).toBe(200);
		expect(tableShortfall!.rawShortfalls?.size ?? 0).toBe(0);
	});

	it('T1-c: C1 Wooden Barrel requirement (×1000) has raw shortfall of Wood (Board pool exhausted)', () => {
		const [, , resC] = diffQuestlineQueue(
			[chainA, chainB, chainC],
			INV,
			new Set(),
			new Map(),
			RECIPES
		);
		const barrelShortfall = resC.quests[0].shortfalls.find((s) => s.item === 'Wooden Barrel');
		expect(barrelShortfall).toBeDefined();
		expect(barrelShortfall!.short).toBe(1000);
		expect(barrelShortfall!.craftableQty).toBe(0);
		expect(barrelShortfall!.rawShortfalls?.get('Wood')).toBe(50_000);
	});

	it('T1-d: C1 Board requirement (×200) shows short 100 Board and raw Wood 500; C1 total raw Wood = 50,500', () => {
		const [, , resC] = diffQuestlineQueue(
			[chainA, chainB, chainC],
			INV,
			new Set(),
			new Map(),
			RECIPES
		);

		// Reference model:
		// Board start: 2000. B1 consumed 300 -> 1700 left.
		// In C1: Tables x200 take 1600 Board -> 100 left.
		// Next requirement in C1 is Board x200:
		// On hand is 100, needed is 200 -> short 100 Board.
		// Board = 5 Wood -> raw shortfall Wood = 500.
		const boardShortfall = resC.quests[0].shortfalls.find((s) => s.item === 'Board');
		expect(boardShortfall).toBeDefined();
		expect(boardShortfall!.short).toBe(100);
		expect(boardShortfall!.rawShortfalls?.get('Wood')).toBe(500);

		// Total raw Wood for C1 = 500 (from Board x200) + 50,000 (from Barrel x1000) = 50,500
		const totalC1RawWood = getTotalRawShortfall([resC], 'Wood');
		expect(totalC1RawWood).toBe(50_500);
	});
});

// ---------------------------------------------------------------------------
// T2 — inv {Wood 40}; Q1{Board 1} Q2{Wood 40}
// Reference model: Q1 crafts 1 Board using 5 Wood, leaving 35 Wood.
//                  Q2 needs 40 Wood, has 35, short 5 Wood.
// ---------------------------------------------------------------------------
describe('T2 — inv {Wood 40}; Q1{Board 1} Q2{Wood 40}', () => {
	const INV = new Map([['Wood', 40]]);
	const BOARD_RECIPE: RecipeMap = new Map([['Board', [{ item: 'Wood', qty: 5 }]]]);

	const q1 = ql('Q1', quest('Q1', 1, [{ item: 'Board', qty: 1 }]));
	const q2 = ql('Q2', quest('Q2', 1, [{ item: 'Wood', qty: 40 }]));

	it('T2: expect Q2 short Wood 5', () => {
		const [, res2] = diffQuestlineQueue([q1, q2], INV, new Set(), new Map(), BOARD_RECIPE);

		const woodShortfall = res2.quests[0].shortfalls.find((s) => s.item === 'Wood');
		expect(woodShortfall).toBeDefined();
		expect(woodShortfall!.short).toBe(5);
	});
});

// ---------------------------------------------------------------------------
// T2b — inv {Wood 40}; Q1{Wood 40} Q2{Board 1}
// Reference model: Q1 takes 40 Wood, leaving 0 Wood.
//                  Q2 needs 1 Board (5 Wood), short 1 Board, raw Wood short 5.
// ---------------------------------------------------------------------------
describe('T2b — inv {Wood 40}; Q1{Wood 40} Q2{Board 1}', () => {
	const INV = new Map([['Wood', 40]]);
	const BOARD_RECIPE: RecipeMap = new Map([['Board', [{ item: 'Wood', qty: 5 }]]]);

	const q1 = ql('Q1', quest('Q1', 1, [{ item: 'Wood', qty: 40 }]));
	const q2 = ql('Q2', quest('Q2', 1, [{ item: 'Board', qty: 1 }]));

	it('T2b: expect Q2 short Wood 5', () => {
		const [, res2] = diffQuestlineQueue([q1, q2], INV, new Set(), new Map(), BOARD_RECIPE);

		const boardShortfall = res2.quests[0].shortfalls.find((s) => s.item === 'Board');
		expect(boardShortfall).toBeDefined();
		expect(boardShortfall!.short).toBe(1);
		expect(boardShortfall!.rawShortfalls?.get('Wood')).toBe(5);
	});
});

// ---------------------------------------------------------------------------
// T2c — total raw Wood shortfall must be equal across T2 and T2b
// ---------------------------------------------------------------------------
describe('T2c — total raw Wood shortfall must be equal across T2 and T2b', () => {
	const BOARD_RECIPE: RecipeMap = new Map([['Board', [{ item: 'Wood', qty: 5 }]]]);

	it('T2c: total raw Wood shortfall must be equal across T2 and T2b', () => {
		const invT2 = new Map([['Wood', 40]]);
		const q1_T2 = ql('Q1', quest('Q1', 1, [{ item: 'Board', qty: 1 }]));
		const q2_T2 = ql('Q2', quest('Q2', 1, [{ item: 'Wood', qty: 40 }]));
		const resT2 = diffQuestlineQueue([q1_T2, q2_T2], invT2, new Set(), new Map(), BOARD_RECIPE);

		const invT2b = new Map([['Wood', 40]]);
		const q1_T2b = ql('Q1', quest('Q1', 1, [{ item: 'Wood', qty: 40 }]));
		const q2_T2b = ql('Q2', quest('Q2', 1, [{ item: 'Board', qty: 1 }]));
		const resT2b = diffQuestlineQueue(
			[q1_T2b, q2_T2b],
			invT2b,
			new Set(),
			new Map(),
			BOARD_RECIPE
		);

		const totalWoodT2 = getTotalRawShortfall(resT2, 'Wood');
		const totalWoodT2b = getTotalRawShortfall(resT2b, 'Wood');

		expect(totalWoodT2).toBe(5);
		expect(totalWoodT2b).toBe(5);
		expect(totalWoodT2).toBe(totalWoodT2b);
	});
});

// ---------------------------------------------------------------------------
// T3 — inv {Board 10, Nails 99999}; Q1{Wooden Plank 2, Board 3}
// Reference model: Plank x2 takes 8 Board. 2 Board remain on hand.
//                  Board 3 takes 2 on hand, 1 short -> 5 Wood raw shortfall.
// ---------------------------------------------------------------------------
describe('T3 — inv {Board 10, Nails 99999}; Q1{Wooden Plank 2, Board 3}', () => {
	it('T3: expect Wood short 5 (plank x2 = 8 Board, direct 3, only 10 on hand)', () => {
		const inv = new Map([
			['Board', 10],
			['Nails', 99_999]
		]);
		const q1 = ql(
			'Q1',
			quest('Q1', 1, [
				{ item: 'Wooden Plank', qty: 2 },
				{ item: 'Board', qty: 3 }
			])
		);

		const [res] = diffQuestlineQueue([q1], inv, new Set(), new Map(), RECIPES);

		const boardShortfall = res.quests[0].shortfalls.find((s) => s.item === 'Board');
		expect(boardShortfall).toBeDefined();
		expect(boardShortfall!.short).toBe(1);
		expect(boardShortfall!.rawShortfalls?.get('Wood')).toBe(5);

		const totalRawWood = getTotalRawShortfall([res], 'Wood');
		expect(totalRawWood).toBe(5);
	});
});

// ---------------------------------------------------------------------------
// T4 — surplus intermediate cannot be back-converted into raw ingredients
// ---------------------------------------------------------------------------
describe('T4 — surplus intermediate (Wooden Plank) cannot become Board or Wood', () => {
	const BOARD_RECIPE: RecipeMap = new Map([['Board', [{ item: 'Wood', qty: 5 }]]]);

	it('T4: short Board=10 yields rawShortfall Wood=50 regardless of Plank on hand', () => {
		const inv = new Map([['Wooden Plank', 100]]);
		const q1ql = ql('Q1', quest('Q1', 1, [{ item: 'Board', qty: 10 }]));

		const [res] = diffQuestlineQueue([q1ql], inv, new Set(), new Map(), BOARD_RECIPE);

		expect(res.quests[0].ok).toBe(false);
		expect(res.quests[0].shortfalls[0]).toMatchObject({
			item: 'Board',
			needed: 10,
			have: 0,
			short: 10,
			craftableQty: 0
		});
		expect(res.quests[0].shortfalls[0].rawShortfalls).toEqual(new Map([['Wood', 50]]));
	});
});

// ---------------------------------------------------------------------------
// T5 — depth-2 recursive expansion; Wood shared across two quests
// ---------------------------------------------------------------------------
describe('T5 — depth-2 craft expansion; Q1 consumes all Wood via resources; Q2 left short', () => {
	const TWO_LEVEL_RECIPE: RecipeMap = new Map([
		['Board', [{ item: 'Wood', qty: 5 }]],
		['Plank', [{ item: 'Board', qty: 4 }]] // custom: no Nails, isolates Wood sharing
	]);

	const INV = new Map([['Wood', 100]]);
	const q1ql = ql('Q1', quest('Q1', 1, [{ item: 'Plank', qty: 5 }]));
	const q2ql = ql('Q2', quest('Q2', 1, [{ item: 'Board', qty: 1 }]));

	it('T5: Q1: Plank short=5 but craftableQty=5 (depth-2: Plank→Board→Wood); Q2: Board short=1, rawShortfall Wood=5', () => {
		const [res1, res2] = diffQuestlineQueue(
			[q1ql, q2ql],
			INV,
			new Set(),
			new Map(),
			TWO_LEVEL_RECIPE
		);

		// Q1: fully craftable but counted as shortfall (have=0 < req=5)
		expect(res1.quests[0].ok).toBe(false);
		expect(res1.quests[0].shortfalls[0]).toMatchObject({
			item: 'Plank',
			needed: 5,
			have: 0,
			short: 5,
			craftableQty: 5
		});
		expect(res1.quests[0].shortfalls[0].rawShortfalls?.size ?? 0).toBe(0);

		// Q2: Wood exhausted by Q1 craft → Board uncraftable
		expect(res2.quests[0].ok).toBe(false);
		expect(res2.quests[0].shortfalls[0]).toMatchObject({
			item: 'Board',
			needed: 1,
			have: 0,
			short: 1,
			craftableQty: 0
		});
		expect(res2.quests[0].shortfalls[0].rawShortfalls).toEqual(new Map([['Wood', 5]]));
	});
});

// ---------------------------------------------------------------------------
// T6 — inv {Wood 9}; Q1{Board 2} Q2{Wood 3}
// Reference model: Q1 needs 2 Board (= 10 Wood). Has 9 Wood.
//   1 Board crafted (uses 5 Wood), 4 leftover Wood drained toward second board.
//   Q1 short 1 Wood (for second board).
//   Remaining Wood stock = 0.
//   Q2 needs 3 Wood, has 0, short 3 Wood.
//   Total raw Wood short = 1 + 3 = 4.
// ---------------------------------------------------------------------------
describe('T6 — inv {Wood 9}; Q1{Board 2} Q2{Wood 3}', () => {
	const BOARD_RECIPE: RecipeMap = new Map([['Board', [{ item: 'Wood', qty: 5 }]]]);

	it('T6: expect Q1 short Wood 1; Q2 short Wood 3; total raw Wood short 4', () => {
		const inv = new Map([['Wood', 9]]);
		const q1 = ql('Q1', quest('Q1', 1, [{ item: 'Board', qty: 2 }]));
		const q2 = ql('Q2', quest('Q2', 1, [{ item: 'Wood', qty: 3 }]));

		const [res1, res2] = diffQuestlineQueue([q1, q2], inv, new Set(), new Map(), BOARD_RECIPE);

		// Q1: Board requirement short 2, craftableQty 1, raw shortfall Wood 1 (10 needed - 9 have = 1 short)
		const boardShortfall = res1.quests[0].shortfalls.find((s) => s.item === 'Board');
		expect(boardShortfall).toBeDefined();
		expect(boardShortfall!.rawShortfalls?.get('Wood')).toBe(1);

		// Q2: Wood requirement needs 3, but all 9 Wood was consumed/drained in Q1 -> short 3 Wood
		const woodShortfall = res2.quests[0].shortfalls.find((s) => s.item === 'Wood');
		expect(woodShortfall).toBeDefined();
		expect(woodShortfall!.short).toBe(3);

		// Total raw Wood shortfall = 1 (from Q1) + 3 (from Q2) = 4
		const totalRawWood = getTotalRawShortfall([res1, res2], 'Wood');
		expect(totalRawWood).toBe(4);
	});
});

// ---------------------------------------------------------------------------
// T6b — inv {Wood 9}; Q1{Wood 3} Q2{Board 2}
// Reference model: Q1 needs 3 Wood. Consumes 3 Wood -> 6 Wood left.
//   Q2 needs 2 Board (= 10 Wood). Has 6 Wood.
//   1 Board crafted (uses 5 Wood), 1 leftover Wood drained toward second board.
//   Short for second board: 4 Wood.
//   Total raw Wood short = 4 (same total as T6).
// ---------------------------------------------------------------------------
describe('T6b — inv {Wood 9}; Q1{Wood 3} Q2{Board 2}', () => {
	const BOARD_RECIPE: RecipeMap = new Map([['Board', [{ item: 'Wood', qty: 5 }]]]);

	it('T6b: expect Q1 ok; Q2 raw Wood short 4 (same total as T6)', () => {
		const inv = new Map([['Wood', 9]]);
		const q1 = ql('Q1', quest('Q1', 1, [{ item: 'Wood', qty: 3 }]));
		const q2 = ql('Q2', quest('Q2', 1, [{ item: 'Board', qty: 2 }]));

		const [res1, res2] = diffQuestlineQueue([q1, q2], inv, new Set(), new Map(), BOARD_RECIPE);

		// Q1: ok (has 9 Wood, needs 3)
		expect(res1.quests[0].ok).toBe(true);
		expect(res1.quests[0].shortfalls).toHaveLength(0);

		// Q2: Board requirement has raw Wood short 4 (10 needed - 6 have = 4 short)
		const boardShortfall = res2.quests[0].shortfalls.find((s) => s.item === 'Board');
		expect(boardShortfall).toBeDefined();
		expect(boardShortfall!.rawShortfalls?.get('Wood')).toBe(4);

		// Total raw Wood shortfall = 4 (same total as T6)
		const totalRawWood = getTotalRawShortfall([res1, res2], 'Wood');
		expect(totalRawWood).toBe(4);
	});
});

// ---------------------------------------------------------------------------
// T7 — inv {Board 3, Wood 100}; Q1{Board 10} Q2{Wood 70}
// Reference model: Q1 uses 3 on-hand Board + crafts 7 (needs 35 Wood).
//   Remaining Wood: 100 - 35 = 65.
//   Q2 needs 70 Wood, has 65 -> short 5 Wood.
// ---------------------------------------------------------------------------
describe('T7 — inv {Board 3, Wood 100}; Q1{Board 10} Q2{Wood 70}', () => {
	const BOARD_RECIPE: RecipeMap = new Map([['Board', [{ item: 'Wood', qty: 5 }]]]);

	it('T7: expect Q1 uses 3 on-hand + crafts 7 (35 Wood); Q2 short Wood 5', () => {
		const inv = new Map([
			['Board', 3],
			['Wood', 100]
		]);
		const q1 = ql('Q1', quest('Q1', 1, [{ item: 'Board', qty: 10 }]));
		const q2 = ql('Q2', quest('Q2', 1, [{ item: 'Wood', qty: 70 }]));

		const [res1, res2] = diffQuestlineQueue([q1, q2], inv, new Set(), new Map(), BOARD_RECIPE);

		// Q1: Board needed: 10, have: 3, short: 7, craftableQty: 7
		const q1Board = res1.quests[0].shortfalls.find((s) => s.item === 'Board');
		expect(q1Board).toBeDefined();
		expect(q1Board!.have).toBe(3);
		expect(q1Board!.needed).toBe(10);
		expect(q1Board!.short).toBe(7);
		expect(q1Board!.craftableQty).toBe(7);

		// Q2: Wood needed: 70, have: 65, short: 5
		const q2Wood = res2.quests[0].shortfalls.find((s) => s.item === 'Wood');
		expect(q2Wood).toBeDefined();
		expect(q2Wood!.short).toBe(5);
		expect(q2Wood!.have).toBe(65);
	});
});


