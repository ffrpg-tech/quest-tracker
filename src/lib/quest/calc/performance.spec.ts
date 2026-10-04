import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { diffQuestlineQueue } from './diff';
import { createCraftingPlanner, type RecipeMap } from './recipes';
import type { Questline } from '../types';

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
});
