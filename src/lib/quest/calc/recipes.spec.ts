import { describe, expect, it } from 'vitest';
import { createCraftingPlanner, expandRecipe, type RecipeMap } from './recipes';

// --- Test-only reference oracle: the original per-unit crafting planner ---
function oracleAcquisition(
	item: string,
	resources: Map<string, number>,
	recipes: RecipeMap,
	memo: Map<string, Map<string, number> | null>,
	stack: Set<string>
): { ok: boolean; rawRequirements: Map<string, number>; rawShortfalls: Map<string, number>; unresolved: boolean } {
	if (stack.has(item)) {
		return { ok: false, rawRequirements: new Map(), rawShortfalls: new Map(), unresolved: true };
	}

	const available = resources.get(item) ?? 0;
	if (available > 0) {
		resources.set(item, available - 1);
		return {
			ok: true,
			rawRequirements: new Map([[item, 1]]),
			rawShortfalls: new Map(),
			unresolved: false
		};
	}

	const ingredients = recipes.get(item);
	if (!ingredients || ingredients.length === 0) {
		return {
			ok: false,
			rawRequirements: new Map(),
			rawShortfalls: new Map([[item, 1]]),
			unresolved: false
		};
	}
	if (!expandRecipe(item, recipes, memo, stack)) {
		return { ok: false, rawRequirements: new Map(), rawShortfalls: new Map(), unresolved: true };
	}

	stack.add(item);
	const rawRequirements = new Map<string, number>();
	const rawShortfalls = new Map<string, number>();
	let unresolved = false;
	for (const ingredient of ingredients) {
		for (let i = 0; i < ingredient.qty; i++) {
			const acquisition = oracleAcquisition(ingredient.item, resources, recipes, memo, stack);
			if (acquisition.ok) {
				for (const [k, v] of acquisition.rawRequirements) {
					rawRequirements.set(k, (rawRequirements.get(k) ?? 0) + v);
				}
			} else {
				for (const [k, v] of acquisition.rawShortfalls) {
					rawShortfalls.set(k, (rawShortfalls.get(k) ?? 0) + v);
				}
				unresolved ||= acquisition.unresolved;
			}
		}
	}
	stack.delete(item);
	if (rawShortfalls.size > 0 || unresolved) {
		return { ok: false, rawRequirements: new Map(), rawShortfalls, unresolved };
	}
	return { ok: true, rawRequirements, rawShortfalls: new Map(), unresolved: false };
}

export function createOracleCraftingPlanner(
	startingInventory: Map<string, number>,
	recipes: RecipeMap
) {
	const resources = new Map(startingInventory);
	const memo = new Map<string, Map<string, number> | null>();

	return {
		plan(item: string, quantity: number) {
			const rawRequirements = new Map<string, number>();
			const rawShortfalls = new Map<string, number>();
			let craftableQty = 0;
			let unresolved = false;
			let diagnosticResources = new Map(resources);

			for (let i = 0; i < quantity; i++) {
				const attemptResources = new Map(diagnosticResources);
				const acquisition = oracleAcquisition(item, attemptResources, recipes, memo, new Set());
				if (!acquisition.ok) {
					for (const [k, v] of acquisition.rawShortfalls) {
						rawShortfalls.set(k, (rawShortfalls.get(k) ?? 0) + v);
					}
					unresolved ||= acquisition.unresolved;
					diagnosticResources = attemptResources;
					continue;
				}

				resources.clear();
				for (const [resource, available] of attemptResources) resources.set(resource, available);
				diagnosticResources = attemptResources;
				craftableQty++;
				for (const [k, v] of acquisition.rawRequirements) {
					rawRequirements.set(k, (rawRequirements.get(k) ?? 0) + v);
				}
			}

			return { craftableQty, rawRequirements, rawShortfalls, unresolved };
		}
	};
}

describe('expandRecipe', () => {
	it('expands nested recipes and memoizes the graph', () => {
		const recipes: RecipeMap = new Map([
			['Board', [{ item: 'Wood', qty: 2 }]],
			['Crate', [{ item: 'Board', qty: 3 }]]
		]);

		expect(expandRecipe('Crate', recipes)).toEqual(new Map([['Wood', 6]]));
	});

	it('returns null for cycles and treats missing recipes as leaves', () => {
		const recipes: RecipeMap = new Map([
			['A', [{ item: 'B', qty: 1 }]],
			['B', [{ item: 'A', qty: 1 }]]
		]);

		expect(expandRecipe('A', recipes)).toBeNull();
		expect(expandRecipe('Wood', recipes)).toEqual(new Map([['Wood', 1]]));
	});
});

describe('createCraftingPlanner', () => {
	it('uses on-hand intermediates before recursively crafting them', () => {
		const planner = createCraftingPlanner(
			new Map([
				['Board', 1],
				['Wood', 4]
			]),
			new Map([['Board', [{ item: 'Wood', qty: 2 }]]])
		);

		const plan = planner.plan('Board', 2);
		expect(plan).toMatchObject({
			craftableQty: 2,
			unresolved: false
		});
		expect(plan.craftTree).toMatchObject({
			item: 'Board',
			have: 1,
			needed: 2,
			left: 0,
			craftable: true,
			children: [{ item: 'Wood', have: 4, needed: 2, left: 0, craftable: false, children: [] }]
		});
	});

	it('shares raw materials across requested craftables', () => {
		const planner = createCraftingPlanner(
			new Map([['Wood', 2]]),
			new Map([
				['Board', [{ item: 'Wood', qty: 1 }]],
				['Handle', [{ item: 'Wood', qty: 2 }]]
			])
		);

		expect(planner.plan('Board', 1).craftableQty).toBe(1);
		expect(planner.plan('Handle', 1).craftableQty).toBe(0);
	});

	it('reports raw leaves still missing after using on-hand intermediates first', () => {
		const planner = createCraftingPlanner(
			new Map([
				['Board', 1],
				['Wood', 1]
			]),
			new Map([
				['Board', [{ item: 'Wood', qty: 2 }]],
				['Crate', [{ item: 'Board', qty: 3 }]]
			])
		);

		expect(planner.plan('Crate', 1)).toMatchObject({
			craftableQty: 0,
			rawShortfalls: new Map([['Wood', 3]]),
			unresolved: false
		});
	});

	it('characterizes nested craftable quantity reporting', () => {
		const planner = createCraftingPlanner(
			new Map([['Wood', 2]]),
			new Map([
				['Board', [{ item: 'Wood', qty: 2 }]],
				['Crate', [{ item: 'Board', qty: 1 }]]
			])
		);

		const plan = planner.plan('Crate', 1);
		expect(plan.craftableQty).toBe(1);
		expect(plan.craftTree).toMatchObject({
			item: 'Crate',
			craftableQty: 0,
			children: [{ item: 'Board', craftableQty: 1 }]
		});
	});

	it('characterizes shared raw materials across sibling ingredients', () => {
		const planner = createCraftingPlanner(
			new Map([['Wood', 2]]),
			new Map([
				['Board', [{ item: 'Wood', qty: 2 }]],
				['Handle', [{ item: 'Wood', qty: 2 }]],
				['Bundle', [
					{ item: 'Board', qty: 1 },
					{ item: 'Handle', qty: 1 }
				]]
			])
		);

		const plan = planner.plan('Bundle', 1);
		expect(plan.craftableQty).toBe(0);
		expect(plan.craftTree).toMatchObject({
			item: 'Bundle',
			craftableQty: 1,
			children: [
				{ item: 'Board', craftableQty: 1 },
				{ item: 'Handle', craftableQty: 1 }
			]
		});
	});

	it('requires the root tree quantity to match the planner quantity', () => {
		const planner = createCraftingPlanner(
			new Map([['Wood', 2]]),
			new Map([
				['Board', [{ item: 'Wood', qty: 2 }]],
				['Crate', [{ item: 'Board', qty: 1 }]]
			])
		);

		const plan = planner.plan('Crate', 1);
		expect(plan.craftTree.craftableQty).toBe(plan.craftableQty);
	});

	it('produces one output per recipe and leaves empty recipes unresolved', () => {
		const planner = createCraftingPlanner(
			new Map([['Wood', 3]]),
			new Map([
				['Board', [{ item: 'Wood', qty: 2 }]],
				['Empty', []]
			])
		);

		expect(planner.plan('Board', 2).craftableQty).toBe(1);
		expect(planner.plan('Empty', 1)).toMatchObject({ craftableQty: 0, unresolved: false });
	});
});
