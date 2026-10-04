import type { ItemQty } from '../types';

export type RecipeMap = Map<string, ItemQty[]>;

export interface CraftingPlan {
	craftableQty: number;
	rawRequirements: Map<string, number>;
	unresolved: boolean;
}

export interface CraftingPlanner {
	plan(item: string, quantity: number): CraftingPlan;
	consume(item: string, quantity: number): void;
}

interface Acquisition {
	ok: boolean;
	rawRequirements: Map<string, number>;
}

function addQuantities(target: Map<string, number>, source: Map<string, number>): void {
	for (const [item, quantity] of source) {
		target.set(item, (target.get(item) ?? 0) + quantity);
	}
}

function multiplyQuantities(source: Map<string, number>, multiplier: number): Map<string, number> {
	const result = new Map<string, number>();
	for (const [item, quantity] of source) {
		result.set(item, quantity * multiplier);
	}
	return result;
}

/**
 * Expands a recipe into its raw leaves. A missing or empty recipe is a leaf
 * itself; a cycle is unresolved rather than treated as craftable.
 */
export function expandRecipe(
	item: string,
	recipes: RecipeMap,
	memo = new Map<string, Map<string, number> | null>(),
	stack = new Set<string>()
): Map<string, number> | null {
	const cached = memo.get(item);
	if (cached !== undefined) return cached && new Map(cached);
	if (stack.has(item)) return null;

	const ingredients = recipes.get(item);
	if (!ingredients || ingredients.length === 0) {
		const leaf = new Map([[item, 1]]);
		memo.set(item, leaf);
		return new Map(leaf);
	}

	stack.add(item);
	const leaves = new Map<string, number>();
	for (const ingredient of ingredients) {
		const expanded = expandRecipe(ingredient.item, recipes, memo, stack);
		if (!expanded) {
			stack.delete(item);
			memo.set(item, null);
			return null;
		}
		addQuantities(leaves, multiplyQuantities(expanded, ingredient.qty));
	}
	stack.delete(item);
	memo.set(item, leaves);
	return new Map(leaves);
}

function createAcquisition(
	item: string,
	resources: Map<string, number>,
	recipes: RecipeMap,
	memo: Map<string, Map<string, number> | null>,
	stack: Set<string>
): Acquisition {
	if (stack.has(item)) return { ok: false, rawRequirements: new Map() };

	const available = resources.get(item) ?? 0;
	if (available > 0) {
		resources.set(item, available - 1);
		return { ok: true, rawRequirements: new Map([[item, 1]]) };
	}

	const ingredients = recipes.get(item);
	if (!ingredients || ingredients.length === 0) {
		return { ok: false, rawRequirements: new Map() };
	}
	if (!expandRecipe(item, recipes, memo, stack)) {
		return { ok: false, rawRequirements: new Map() };
	}

	stack.add(item);
	const rawRequirements = new Map<string, number>();
	for (const ingredient of ingredients) {
		for (let i = 0; i < ingredient.qty; i++) {
			const acquisition = createAcquisition(ingredient.item, resources, recipes, memo, stack);
			if (!acquisition.ok) {
				stack.delete(item);
				return { ok: false, rawRequirements: new Map() };
			}
			addQuantities(rawRequirements, acquisition.rawRequirements);
		}
	}
	stack.delete(item);
	return { ok: true, rawRequirements };
}

export function createCraftingPlanner(
	startingInventory: Map<string, number>,
	recipes: RecipeMap
): CraftingPlanner {
	const resources = new Map(startingInventory);
	const memo = new Map<string, Map<string, number> | null>();

	return {
		plan(item, quantity) {
			const rawRequirements = new Map<string, number>();
			let craftableQty = 0;
			let unresolved = false;

			for (let i = 0; i < quantity; i++) {
				const acquisition = createAcquisition(item, resources, recipes, memo, new Set());
				if (!acquisition.ok) {
					unresolved = (recipes.get(item)?.length ?? 0) > 0;
					break;
				}
				craftableQty++;
				addQuantities(rawRequirements, acquisition.rawRequirements);
			}

			return { craftableQty, rawRequirements, unresolved };
		},
		consume(item, quantity) {
			if (quantity <= 0) return;
			const available = resources.get(item) ?? 0;
			resources.set(item, Math.max(0, available - quantity));
		}
	};
}
