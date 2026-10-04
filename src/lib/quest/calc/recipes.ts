import type { ItemQty } from '../types';

export type RecipeMap = Map<string, ItemQty[]>;

export interface CraftTreeNode {
	item: string;
	have: number;
	needed: number;
	left: number;
	craftable: boolean;
	craftableQty: number;
	unresolved: boolean;
	children: CraftTreeNode[];
}

export interface CraftingPlan {
	craftableQty: number;
	rawRequirements: Map<string, number>;
	rawShortfalls: Map<string, number>;
	unresolved: boolean;
	craftTree: CraftTreeNode;
}

export interface CraftingPlanner {
	plan(item: string, quantity: number): CraftingPlan;
	consume(item: string, quantity: number): void;
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

function canCraft(
	item: string,
	qty: number,
	stock: Map<string, number>,
	recipes: RecipeMap,
	stack = new Set<string>()
): boolean {
	if (qty <= 0) return true;
	if (stack.has(item)) return false;

	const have = stock.get(item) ?? 0;
	const fromStock = Math.min(qty, have);
	stock.set(item, have - fromStock);
	const remaining = qty - fromStock;
	if (remaining === 0) return true;

	const ingredients = recipes.get(item);
	if (!ingredients || ingredients.length === 0) {
		return false;
	}

	stack.add(item);
	for (const ingredient of ingredients) {
		const needed = ingredient.qty * remaining;
		if (!canCraft(ingredient.item, needed, stock, recipes, stack)) {
			stack.delete(item);
			return false;
		}
	}
	stack.delete(item);
	return true;
}

function findMaxCraftableQty(
	item: string,
	maxQty: number,
	resources: Map<string, number>,
	recipes: RecipeMap
): number {
	if (maxQty <= 0) return 0;

	let low = 1;
	let high = maxQty;
	let best = 0;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const stock = new Map(resources);
		if (canCraft(item, mid, stock, recipes)) {
			best = mid;
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}

	return best;
}

function buildCraftTree(
	item: string,
	needed: number,
	resources: Map<string, number>,
	recipes: RecipeMap,
	stack = new Set<string>()
): CraftTreeNode {
	const have = resources.get(item) ?? 0;
	const ingredients = recipes.get(item);
	const unresolved = stack.has(item);
	if (!ingredients || ingredients.length === 0 || unresolved) {
		return {
			item,
			have,
			needed,
			left: Math.max(0, needed - have),
			craftable: false,
			craftableQty: 0,
			unresolved,
			children: []
		};
	}

	const initialResources = new Map(resources);
	stack.add(item);
	const children: CraftTreeNode[] = [];
	const missingOutputs = Math.max(0, needed - have);
	for (const ingredient of ingredients) {
		const child = buildCraftTree(
			ingredient.item,
			ingredient.qty * missingOutputs,
			resources,
			recipes,
			stack
		);
		children.push(child);
		consumeTreeResources(child, resources);
	}
	stack.delete(item);

	const craftableQty = findMaxCraftableQty(item, missingOutputs, initialResources, recipes);
	return {
		item,
		have,
		needed,
		left: Math.max(0, missingOutputs - craftableQty),
		craftable: true,
		craftableQty,
		unresolved: children.some((child) => child.unresolved),
		children
	};
}

function consumeTreeResources(node: CraftTreeNode, resources: Map<string, number>): void {
	const available = resources.get(node.item) ?? 0;
	const used = Math.min(node.needed, available);
	resources.set(node.item, available - used);
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

function collectRawShortfalls(
	node: CraftTreeNode,
	result = new Map<string, number>()
): Map<string, number> {
	if (node.children.length === 0) {
		if (node.left > 0) {
			result.set(node.item, (result.get(node.item) ?? 0) + node.left);
		}
		return result;
	}
	for (const child of node.children) {
		collectRawShortfalls(child, result);
	}
	return result;
}

export function createCraftingPlanner(
	startingInventory: Map<string, number>,
	recipes: RecipeMap
): CraftingPlanner {
	const resources = new Map(startingInventory);

	return {
		plan(item, quantity) {
			const treeResources = new Map(resources);
			const craftTree = buildCraftTree(item, quantity, treeResources, recipes);
			const have = resources.get(item) ?? 0;
			const craftableQty = Math.min(quantity, have + craftTree.craftableQty);

			const usedOnHand = Math.min(quantity, have);
			if (usedOnHand > 0) {
				resources.set(item, have - usedOnHand);
			}
			if (craftTree.craftableQty > 0) {
				canCraft(item, craftTree.craftableQty, resources, recipes);
			}

			return {
				craftableQty,
				rawRequirements: new Map(),
				rawShortfalls: collectRawShortfalls(craftTree),
				unresolved: craftTree.unresolved,
				craftTree
			};
		},
		consume(item, quantity) {
			if (quantity <= 0) return;
			const available = resources.get(item) ?? 0;
			resources.set(item, Math.max(0, available - quantity));
		}
	};
}
