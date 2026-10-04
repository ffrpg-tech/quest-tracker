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

interface Acquisition {
	ok: boolean;
	rawRequirements: Map<string, number>;
	rawShortfalls: Map<string, number>;
	unresolved: boolean;
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
	const craftableQty = Math.min(
		missingOutputs,
		...ingredients.map((ingredient, index) =>
			Math.floor((children[index]?.have ?? 0) / ingredient.qty)
		)
	);
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
	if (node.children.length === 0) {
		const available = resources.get(node.item) ?? 0;
		resources.set(node.item, Math.max(0, available - node.left));
		return;
	}
	for (const child of node.children) consumeTreeResources(child, resources);
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
			const acquisition = createAcquisition(ingredient.item, resources, recipes, memo, stack);
			if (acquisition.ok) addQuantities(rawRequirements, acquisition.rawRequirements);
			else {
				addQuantities(rawShortfalls, acquisition.rawShortfalls);
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

export function createCraftingPlanner(
	startingInventory: Map<string, number>,
	recipes: RecipeMap
): CraftingPlanner {
	const resources = new Map(startingInventory);
	const memo = new Map<string, Map<string, number> | null>();

	return {
		plan(item, quantity) {
			const treeResources = new Map(resources);
			const craftTree = buildCraftTree(item, quantity, treeResources, recipes);
			const rawRequirements = new Map<string, number>();
			const rawShortfalls = new Map<string, number>();
			let craftableQty = 0;
			let unresolved = false;
			let diagnosticResources = new Map(resources);

			for (let i = 0; i < quantity; i++) {
				const attemptResources = new Map(diagnosticResources);
				const acquisition = createAcquisition(item, attemptResources, recipes, memo, new Set());
				if (!acquisition.ok) {
					addQuantities(rawShortfalls, acquisition.rawShortfalls);
					unresolved ||= acquisition.unresolved;
					diagnosticResources = attemptResources;
					continue;
				}

				resources.clear();
				for (const [resource, available] of attemptResources) resources.set(resource, available);
				diagnosticResources = attemptResources;
				craftableQty++;
				addQuantities(rawRequirements, acquisition.rawRequirements);
			}

			return { craftableQty, rawRequirements, rawShortfalls, unresolved, craftTree };
		},
		consume(item, quantity) {
			if (quantity <= 0) return;
			const available = resources.get(item) ?? 0;
			resources.set(item, Math.max(0, available - quantity));
		}
	};
}
