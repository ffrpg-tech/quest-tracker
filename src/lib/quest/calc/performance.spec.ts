import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { diffQuestlineQueue } from './diff';
import { createCraftingPlanner, type RecipeMap } from './recipes';
import type { PlayerStats, Questline } from '../types';

const questlines = Object.values(
	JSON.parse(readFileSync(resolve('static/questlines.json'), 'utf8')) as Record<string, Questline>
);
const recipes = new Map(
	Object.entries(JSON.parse(readFileSync(resolve('static/recipes.json'), 'utf8')) as Record<string, unknown>)
) as RecipeMap;
const emptyInventory = new Map<string, number>();

function measure(callback: () => void, iterations: number): number {
	const start = performance.now();
	for (let i = 0; i < iterations; i++) callback();
	return (performance.now() - start) / iterations;
}

describe('performance characterization', () => {
	it('measures queue diff and estimates planner cost', () => {
		const iterations = 1;
		const queueSize = Number(process.env.BENCHMARK_QUEUE_SIZE ?? questlines.length);
		const queue = questlines.slice(0, queueSize);

		if (process.env.BENCHMARK_WITH_PLANNER !== '1') {
			const withoutPlannerMs = measure(
				() => diffQuestlineQueue(queue, emptyInventory, new Set(), new Map(), new Map()),
				iterations
			);
			console.error({
				questlines: queue.length,
				totalQuestlines: questlines.length,
				withoutPlannerMs
			});
			expect(withoutPlannerMs).toBeGreaterThanOrEqual(0);
			return;
		}

		const withPlannerMs = measure(
			() => diffQuestlineQueue(queue, emptyInventory, new Set(), new Map(), recipes),
			iterations
		);
		const withoutPlannerMs = measure(
			() => diffQuestlineQueue(queue, emptyInventory, new Set(), new Map(), new Map()),
			iterations
		);

		console.error({
			questlines: queue.length,
			totalQuestlines: questlines.length,
			quests: queue.reduce((count, questline) => count + questline.quests.length, 0),
			withPlannerMs,
			withoutPlannerMs,
			estimatedPlannerMs: withPlannerMs - withoutPlannerMs
		});

		expect(withPlannerMs).toBeGreaterThanOrEqual(0);
		expect(withoutPlannerMs).toBeGreaterThanOrEqual(0);
	});

	it.skipIf(process.env.BENCHMARK_WITH_PLANNER !== '1')(
		'measures planner work independently from queue walking',
		() => {
		const planner = createCraftingPlanner(emptyInventory, recipes);
		const craftableRequirements = questlines.flatMap((questline) =>
			questline.quests.flatMap((quest) =>
				quest.requirements.filter((requirement) => recipes.has(requirement.item))
			)
		);
		const iterations = 1;
		const plannerMs = measure(() => {
			for (const requirement of craftableRequirements) {
				planner.plan(requirement.item, requirement.qty);
			}
		}, iterations);

		console.error({
			craftableRequirements: craftableRequirements.length,
			plannerMs
		});

		expect(plannerMs).toBeGreaterThanOrEqual(0);
		}
	);

	it('measures realistic queues (1, 5, 20 questlines) with empty and realistic inventory', () => {
		const realisticInventory = new Map<string, number>([
			['Wood', 500],
			['Stone', 500],
			['Iron', 300],
			['Board', 200],
			['Nails', 200],
			['Straw', 400],
			['Cotton', 300],
			['Apple', 200],
			['Orange', 200],
			['Lemon', 200],
			['Wheat', 300],
			['Copper Ore', 200],
			['Iron Ore', 200],
			['Leather', 100]
		]);

		const iterations = 5;
		const results: Record<string, { emptyInvMs: number; realisticInvMs: number; quests: number }> = {};

		for (const size of [1, 5, 20]) {
			const queue = questlines.slice(0, size);
			const quests = queue.reduce((sum, q) => sum + q.quests.length, 0);

			const emptyInvMs = measure(
				() => diffQuestlineQueue(queue, emptyInventory, new Set(), new Map(), recipes),
				iterations
			);
			const realisticInvMs = measure(
				() => diffQuestlineQueue(queue, realisticInventory, new Set(), new Map(), recipes),
				iterations
			);

			results[`${size} questlines`] = { emptyInvMs, realisticInvMs, quests };
		}

		console.error('Realistic queue benchmark results:', results);
		expect(Object.keys(results).length).toBe(3);
	});

	it('measures full catalogue eligibility rebuild', async () => {
		const questlineMap = new Map(questlines.map((q) => [q.name, q]));
		const stats: PlayerStats = {
			farming: 99,
			fishing: 99,
			crafting: 99,
			exploring: 99,
			tower: 100,
			cooking: 50,
			mining: 50,
			npcLevels: { Rosalie: 50, Borgen: 30 }
		};

		const { buildQuestlineTitleIndex, buildNpcLevelIndex, evaluateQuestlineEligibility } =
			await import('./eligibility');

		const titleIndex = buildQuestlineTitleIndex(questlineMap);
		const npcIndex = buildNpcLevelIndex(stats);
		const indexes = { questlinesByTitle: titleIndex, npcLevelsByName: npcIndex };

		const iterations = 5;
		const rebuildMs = measure(() => {
			for (const q of questlines) {
				evaluateQuestlineEligibility(q, stats, null, new Set(), questlineMap, new Date(), indexes);
			}
		}, iterations);

		console.error({ totalQuestlines: questlines.length, fullEligibilityRebuildMs: rebuildMs });
		expect(rebuildMs).toBeGreaterThanOrEqual(0);
	});
});
