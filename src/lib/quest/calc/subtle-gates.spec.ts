import { describe, expect, it } from 'vitest';
import { createCraftingPlanner, type RecipeMap } from './recipes';
import { diffQuestline, diffQuestlineQueue } from './diff';
import type { PlayerStats, Questline } from '../types';

describe('Subtle Logic Gates Audit & Test Suite', () => {
	describe('Part 1: Crafting Level & Recipe Unlock Gates in Recursive Trees', () => {
		const recipes: RecipeMap = new Map([
			['Board', [{ item: 'Wood', qty: 2 }]],
			['Wooden Barrel', [{ item: 'Board', qty: 3 }]],
			[
				'Onion Soup',
				[
					{ item: 'Onion', qty: 50 },
					{ item: 'Bone Broth', qty: 1 }
				]
			]
		]);

		it('flags sub-nodes with REQ CRAFTING LVL X and invalidates craftable/craftableQty when player crafting level is below required threshold', () => {
			// Wooden Barrel requires Crafting Lv 10
			const inventory = new Map([['Wood', 100]]);
			const playerStats: PlayerStats = {
				farming: 99,
				fishing: 99,
				crafting: 5, // Below Level 10
				exploring: 99,
				tower: 100,
				cooking: 10,
				mining: 10,
				npcLevels: {}
			};

			const planner = createCraftingPlanner(inventory, recipes, {
				playerStats
			});

			const plan = planner.plan('Wooden Barrel', 1);

			// Root node or sub-node evaluation
			expect(plan.craftTree).toMatchObject({
				item: 'Wooden Barrel',
				craftable: false,
				craftableQty: 0,
				reqCraftingLevel: 10
			});
			// Sub-node Board (Crafting Lv 1) is craftable because player has crafting 5 >= 1
			const boardNode = plan.craftTree.children.find((c) => c.item === 'Board');
			expect(boardNode).toBeDefined();
			expect(boardNode?.reqCraftingLevel).toBeUndefined();
		});

		it('does not flag sub-nodes when player crafting level meets or exceeds the required threshold', () => {
			const inventory = new Map([['Wood', 100]]);
			const playerStats: PlayerStats = {
				farming: 99,
				fishing: 99,
				crafting: 20, // Exceeds Level 10
				exploring: 99,
				tower: 100,
				cooking: 10,
				mining: 10,
				npcLevels: {}
			};

			const planner = createCraftingPlanner(inventory, recipes, {
				playerStats
			});

			const plan = planner.plan('Wooden Barrel', 1);

			expect(plan.craftTree).toMatchObject({
				item: 'Wooden Barrel',
				craftable: true,
				craftableQty: 1
			});
			expect(plan.craftTree.reqCraftingLevel).toBeUndefined();
		});

		it('flags cooking meal sub-nodes with REQ COOKING LVL and REQ NPC LVL when player stats are below thresholds', () => {
			// Onion Soup requires Cooking Lv 5 and George Friendship Lv 10
			const inventory = new Map([
				['Onion', 100],
				['Bone Broth', 5]
			]);
			const lowCookingStats: PlayerStats = {
				farming: 99,
				fishing: 99,
				crafting: 99,
				exploring: 99,
				tower: 100,
				cooking: 2, // Below Cooking Lv 5
				mining: 10,
				npcLevels: { George: 5 } // Below George Lv 10
			};

			const planner = createCraftingPlanner(inventory, recipes, {
				playerStats: lowCookingStats
			});

			const plan = planner.plan('Onion Soup', 1);

			expect(plan.craftTree).toMatchObject({
				item: 'Onion Soup',
				craftable: false,
				craftableQty: 0,
				reqCookingLevel: 5,
				reqNpc: { npc: 'George', level: 10 }
			});
		});

		it('propagates craftable invalidation up parent recursive trees so uncraftable intermediates do not cause false 0-left shortfalls', () => {
			// Crate needs 1 Wooden Barrel. Player has materials for Wooden Barrel, but lacks Crafting level.
			const multiTierRecipes: RecipeMap = new Map([
				['Board', [{ item: 'Wood', qty: 2 }]],
				['Wooden Barrel', [{ item: 'Board', qty: 3 }]],
				['Crate', [{ item: 'Wooden Barrel', qty: 1 }]]
			]);
			const inventory = new Map([['Wood', 50]]);
			const playerStats: PlayerStats = {
				farming: 99,
				fishing: 99,
				crafting: 2, // Cannot craft Wooden Barrel (requires Lv 10)
				exploring: 99,
				tower: 100,
				cooking: 10,
				mining: 10,
				npcLevels: {}
			};

			const planner = createCraftingPlanner(inventory, multiTierRecipes, {
				playerStats
			});

			const plan = planner.plan('Crate', 1);

			// Crate cannot be crafted because Wooden Barrel cannot be crafted
			expect(plan.craftableQty).toBe(0);
			expect(plan.craftTree.craftableQty).toBe(0);
			const barrelNode = plan.craftTree.children.find((c) => c.item === 'Wooden Barrel');
			expect(barrelNode).toMatchObject({
				item: 'Wooden Barrel',
				craftable: false,
				craftableQty: 0,
				reqCraftingLevel: 10
			});
		});

		it('captures craft tree snapshot with crafting level and cooking/npc gates', () => {
			const treeRecipes: RecipeMap = new Map([
				['Board', [{ item: 'Wood', qty: 2 }]],
				['Wooden Barrel', [{ item: 'Board', qty: 3 }]],
				[
					"Cat's Meow",
					[
						{ item: 'Fish Bones', qty: 25 },
						{ item: 'Bone Broth', qty: 1 }
					]
				]
			]);
			const inventory = new Map([
				['Wood', 10],
				['Fish Bones', 50],
				['Bone Broth', 2]
			]);
			const stats: PlayerStats = {
				farming: 99,
				fishing: 99,
				crafting: 5, // Below Wooden Barrel Lv 10
				exploring: 99,
				tower: 100,
				cooking: 10, // Below Cat's Meow Cooking Lv 15
				mining: 10,
				npcLevels: { Thomas: 15 } // Below Thomas Lv 30
			};

			const planner = createCraftingPlanner(inventory, treeRecipes, { playerStats: stats });
			const barrelPlan = planner.plan('Wooden Barrel', 1);
			const mealPlan = planner.plan("Cat's Meow", 1);

			expect({
				barrelTree: barrelPlan.craftTree,
				mealTree: mealPlan.craftTree
			}).toMatchSnapshot();
		});
	});

	describe('Part 2: Hard Cap vs. Soft Cap Bottlenecks', () => {
		const capQuestline: Questline = {
			name: 'Bottleneck Test Chain',
			questCount: 2,
			quests: [
				{
					name: 'Step 1',
					seq: 1,
					requirements: [
						{ item: 'Large Chest 01', qty: 120 }, // Non-mailable
						{ item: 'Wood', qty: 120 } // Mailable
					]
				},
				{
					name: 'Step 2',
					seq: 2,
					requirements: [
						{ item: 'Large Chest 01', qty: 50 },
						{ item: 'Wood', qty: 50 }
					]
				}
			]
		};

		const canMailLookup = (item: string) => {
			if (item === 'Large Chest 01' || item === 'Board') return false;
			if (item === 'Wood' || item === 'Onion Soup') return true;
			return undefined;
		};

		it('differentiates between hard cap (non-mailable) and soft cap (mailable) on single-turn-in breaches', () => {
			const result = diffQuestline(
				capQuestline,
				new Map(),
				new Set(),
				new Map(),
				new Map(),
				100, // maxCapacity = 100. Step 1 requires 120 > 100!
				{ canMailLookup }
			);

			const step1 = result.quests[0];
			const chestReq = step1.requirements.find((r) => r.item === 'Large Chest 01');
			const woodReq = step1.requirements.find((r) => r.item === 'Wood');

			expect(chestReq).toBeDefined();
			expect(chestReq?.exceedsCapacity).toBe(true);
			expect(chestReq?.capType).toBe('hard');

			expect(woodReq).toBeDefined();
			expect(woodReq?.exceedsCapacity).toBe(true);
			expect(woodReq?.capType).toBe('soft');

			// Bottlenecks array contains the differentiated capType
			expect(step1.capacityBottlenecks).toEqual([
				{
					item: 'Large Chest 01',
					cumulativeNeeded: 120,
					maxCapacity: 100,
					questName: 'Step 1',
					capType: 'hard'
				},
				{
					item: 'Wood',
					cumulativeNeeded: 120,
					maxCapacity: 100,
					questName: 'Step 1',
					capType: 'soft'
				}
			]);
		});

		it('distinguishes single-turn-in walls from cumulative queue rollups', () => {
			const cumulativeOnlyQuestline: Questline = {
				name: 'Cumulative Chain',
				questCount: 3,
				quests: [
					{ name: 'C1', seq: 1, requirements: [{ item: 'Board', qty: 40 }] }, // 40 <= 100
					{ name: 'C2', seq: 2, requirements: [{ item: 'Board', qty: 40 }] }, // 80 <= 100
					{ name: 'C3', seq: 3, requirements: [{ item: 'Board', qty: 40 }] } // 120 > 100 (breaches cumulative)
				]
			};

			const result = diffQuestline(
				cumulativeOnlyQuestline,
				new Map(),
				new Set(),
				new Map(),
				new Map(),
				100,
				{ canMailLookup }
			);

			// Individual quests are <= 100, so none has isSingleQuestBreach
			expect(result.quests[0].requirements[0].isSingleQuestBreach).toBe(false);
			expect(result.quests[1].requirements[0].isSingleQuestBreach).toBe(false);
			expect(result.quests[2].requirements[0].isSingleQuestBreach).toBe(false);

			// But C3 crosses cumulative capacity
			expect(result.quests[2].requirements[0].exceedsCapacity).toBe(true);
			expect(result.quests[2].requirements[0].isThresholdBreaker).toBe(true);
			expect(result.quests[2].requirements[0].capType).toBe('hard');
			expect(result.quests[2].requirements[0].isCumulativeOnly).toBe(true);
		});

		it('propagates hard and soft cap types to queue-level aggregated shortfalls', () => {
			const queueResults = diffQuestlineQueue(
				[capQuestline],
				new Map(),
				new Set(),
				new Map(),
				new Map(),
				100,
				{ canMailLookup }
			);

			const totalShortfalls = queueResults[0].totalShortfalls;
			const chestTotal = totalShortfalls.find((s) => s.item === 'Large Chest 01');
			const woodTotal = totalShortfalls.find((s) => s.item === 'Wood');

			expect(chestTotal?.capType).toBe('hard');
			expect(woodTotal?.capType).toBe('soft');
		});

		it('captures diff result snapshot with hard and soft cap bottlenecks', () => {
			const result = diffQuestline(
				capQuestline,
				new Map([['Wood', 10]]),
				new Set(),
				new Map(),
				new Map(),
				100,
				{ canMailLookup }
			);

			expect(result).toMatchSnapshot();
		});
	});
});
