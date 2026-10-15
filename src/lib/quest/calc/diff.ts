import { questKey, type PlayerStats, type Questline } from '../types';
import { createCraftingPlanner, type CraftTreeNode, type RecipeMap } from './recipes';
import { getItemCanMail } from '../storage/itemsStore.svelte';
import type { RecipeGateMap } from './recipeLevels';

export interface CapacityBottleneck {
	item: string;
	cumulativeNeeded: number;
	maxCapacity: number;
	questName: string;
	capType?: 'hard' | 'soft';
}

export interface ItemShortfall {
	item: string;
	needed: number;
	have: number;
	short: number;
	/** True when a single requirement for this item exceeds the player's known storage cap for it (from a "MAX ON HAND" inventory paste) — no amount of farming clears this until the cap is raised or the item is spent down elsewhere, unlike an ordinary shortfall. */
	capped?: boolean;
	craftableQty?: number;
	rawShortfalls?: Map<string, number>;
	craftTree?: CraftTreeNode;
	/** Cumulative quantity of this item needed across the batch/queue up to this quest */
	cumulativeNeeded?: number;
	/** The max capacity cap applied (configured maxCapacity or item cap) */
	storageCap?: number;
	/** True if cumulative requirement exceeds storageCap */
	exceedsCapacity?: boolean;
	/** True specifically on the first quest where the cumulative requirement crosses storageCap */
	isThresholdBreaker?: boolean;
	/** Name of the quest where cumulative requirement first crossed storageCap */
	thresholdBreakerQuest?: string;
	/** 'hard' for non-mailable items (absolute blocker); 'soft' for mailable items (can overflow) */
	capType?: 'hard' | 'soft';
	/** True if a single quest requirement strictly exceeds maxCapacity */
	isSingleQuestBreach?: boolean;
	/** True if cumulative requirement exceeds maxCapacity but single quest requirements do not */
	isCumulativeOnly?: boolean;
}

export interface QuestDiffResult {
	questName: string;
	seq: number;
	shortfalls: ItemShortfall[];
	/** Every requirement for this quest, met or not (unlike `shortfalls`, which only holds the unmet subset) — lets the UI offer a "show all items" view instead of only ever showing what's missing. Empty for a `done` quest, same as `shortfalls`. */
	requirements: ItemShortfall[];
	ok: boolean;
	/** True when the player has already marked this quest done — its requirements are neither checked against nor deducted from the simulated inventory, since that consumption already happened before this inventory snapshot was taken. */
	done: boolean;
	/** Bottlenecks where cumulative requirement breaches max inventory capacity on this quest */
	capacityBottlenecks?: CapacityBottleneck[];
}

/** One quest's contribution to a chain-level aggregated item shortfall. */
export interface QuestShortfallShare {
	questName: string;
	seq: number;
	short: number;
	craftableQty?: number;
	rawShortfalls?: Map<string, number>;
	craftTree?: CraftTreeNode;
	isThresholdBreaker?: boolean;
	capType?: 'hard' | 'soft';
}

/** A chain-level aggregated shortfall, broken down by which quest(s) in the chain it came from. */
export interface AggregatedItemShortfall extends ItemShortfall {
	byQuest: QuestShortfallShare[];
}

export interface DiffOptions {
	canMailLookup?: (item: string) => boolean | undefined;
	playerStats?: PlayerStats | null;
	recipeGates?: RecipeGateMap;
}

/** Folds a new `needed`/`short` hit into an existing aggregate in place, keeping `have = needed - short` internally consistent — the single accumulation rule shared by the chain-level (`walkQuestline`) and queue-level (`aggregateQueueShortfalls`) rollups, so the invariant can't drift out of sync between the two call sites. */
function accumulateShortfall(
	target: ItemShortfall,
	needed: number,
	short: number,
	capped = false,
	craftableQty?: number,
	rawShortfalls?: Map<string, number>,
	exceedsCapacity?: boolean,
	storageCap?: number,
	cumulativeNeeded?: number,
	thresholdBreakerQuest?: string,
	capType?: 'hard' | 'soft',
	isSingleQuestBreach?: boolean,
	isCumulativeOnly?: boolean
): void {
	target.needed += needed;
	target.short += short;
	target.have = target.needed - target.short;
	if (capped) target.capped = true;
	if (exceedsCapacity) target.exceedsCapacity = true;
	if (storageCap !== undefined) target.storageCap = storageCap;
	if (cumulativeNeeded !== undefined) target.cumulativeNeeded = cumulativeNeeded;
	if (thresholdBreakerQuest !== undefined && !target.thresholdBreakerQuest) {
		target.thresholdBreakerQuest = thresholdBreakerQuest;
	}
	if (capType !== undefined) target.capType = capType;
	if (isSingleQuestBreach !== undefined) {
		target.isSingleQuestBreach =
			target.isSingleQuestBreach !== undefined
				? target.isSingleQuestBreach || isSingleQuestBreach
				: isSingleQuestBreach;
	}
	if (isCumulativeOnly !== undefined) {
		target.isCumulativeOnly = target.isCumulativeOnly ?? isCumulativeOnly;
	}
	if (craftableQty !== undefined) {
		target.craftableQty = (target.craftableQty ?? 0) + craftableQty;
	}
	if (rawShortfalls) {
		if (!target.rawShortfalls) target.rawShortfalls = new Map();
		for (const [item, quantity] of rawShortfalls) {
			target.rawShortfalls.set(item, (target.rawShortfalls.get(item) ?? 0) + quantity);
		}
	}
}

export interface QuestlineDiffResult {
	questlineName: string;
	quests: QuestDiffResult[];
	/** Index into `quests` of the first quest the player can't complete with current inventory, or null if the whole chain is clear. */
	wallPointIndex: number | null;
	/** Aggregate shortfall across the whole chain, item -> total still missing (assuming quests are attempted in order regardless of earlier shortfalls). */
	totalShortfalls: AggregatedItemShortfall[];
}

/**
 * Walks a questline's quests in order against `inv`, mutating it in place as
 * requirements are consumed. Shared by `diffQuestline` (single questline,
 * private clone) and `diffQuestlineQueue` (multiple questlines threaded
 * through the same shared inventory).
 */
function walkQuestline(
	questline: Questline,
	inv: Map<string, number>,
	completed: Set<string>,
	caps: Map<string, number>,
	recipes: RecipeMap = new Map(),
	craftingPlanner = createCraftingPlanner(inv, recipes),
	maxCapacity: number | null = null,
	cumulativeRequiredMap: Map<string, number> = new Map(),
	breachedCapsMap: Map<string, string> = new Map(),
	options: DiffOptions = {}
): QuestlineDiffResult {
	const quests: QuestDiffResult[] = [];
	let wallPointIndex: number | null = null;
	const totalShortfallMap = new Map<string, AggregatedItemShortfall>();

	for (let i = 0; i < questline.quests.length; i++) {
		const q = questline.quests[i];

		if (completed.has(questKey(questline.name, q.name))) {
			quests.push({
				questName: q.name,
				seq: q.seq,
				shortfalls: [],
				requirements: [],
				ok: true,
				done: true
			});
			continue;
		}

		const shortfalls: ItemShortfall[] = [];
		const requirements: ItemShortfall[] = [];
		const questBottlenecks: CapacityBottleneck[] = [];
		let ok = true;

		for (const req of q.requirements) {
			const have = inv.get(req.item) ?? 0;
			const short = Math.max(0, req.qty - have);
			const isSilver = req.item.toLowerCase() === 'silver';
			const effectiveCap = maxCapacity && !isSilver ? maxCapacity : undefined;

			// Track cumulative required count across queue/questline (independent of current bag contents)
			const prevCumulative = cumulativeRequiredMap.get(req.item) ?? 0;
			const currentCumulative = prevCumulative + req.qty;
			cumulativeRequiredMap.set(req.item, currentCumulative);

			let exceedsCapacity = false;
			let isThresholdBreaker = false;
			const isSingleQuestBreach =
				effectiveCap !== undefined && !isSilver ? req.qty > effectiveCap : undefined;

			let capType: 'hard' | 'soft' | undefined;
			let isCumulativeOnly: boolean | undefined;

			if (effectiveCap !== undefined && !isSilver) {
				if (currentCumulative > effectiveCap) {
					exceedsCapacity = true;
					const checkCanMail = options.canMailLookup ?? getItemCanMail;
					const canMail = checkCanMail(req.item);
					if (canMail !== undefined) {
						capType = canMail === false ? 'hard' : 'soft';
					}
					isCumulativeOnly = !isSingleQuestBreach;

					if (!breachedCapsMap.has(req.item)) {
						breachedCapsMap.set(req.item, q.name);
						isThresholdBreaker = true;
						questBottlenecks.push({
							item: req.item,
							cumulativeNeeded: currentCumulative,
							maxCapacity: effectiveCap,
							questName: q.name,
							...(capType && { capType })
						});
					}
				}
			}

			const cap = caps.get(req.item);
			const capped = cap !== undefined && req.qty > cap ? true : undefined;
			let craftableQty: number | undefined;
			let rawShortfalls: Map<string, number> | undefined;
			let craftTree: CraftTreeNode | undefined;
			craftingPlanner.consume(req.item, Math.min(req.qty, have));
			if (short > 0) {
				const ingredients = recipes.get(req.item);
				if (ingredients && ingredients.length > 0) {
					const plan = craftingPlanner.plan(req.item, short);
					craftableQty = plan.craftTree.craftableQty;
					if (plan.rawShortfalls.size > 0) rawShortfalls = plan.rawShortfalls;
					craftTree = plan.craftTree;
				}
			}
			const requirement: ItemShortfall = {
				item: req.item,
				needed: req.qty,
				have,
				short
			};
			if (maxCapacity !== null) {
				requirement.cumulativeNeeded = currentCumulative;
			}
			if (exceedsCapacity) {
				requirement.exceedsCapacity = true;
				requirement.storageCap = effectiveCap;
				requirement.thresholdBreakerQuest = breachedCapsMap.get(req.item);
				if (capType !== undefined) requirement.capType = capType;
				if (isCumulativeOnly !== undefined) requirement.isCumulativeOnly = isCumulativeOnly;
			}
			if (isSingleQuestBreach !== undefined) {
				requirement.isSingleQuestBreach = isSingleQuestBreach;
			}
			if (isThresholdBreaker) {
				requirement.isThresholdBreaker = true;
			}
			if (capped !== undefined) requirement.capped = capped;
			if (craftableQty !== undefined) requirement.craftableQty = craftableQty;
			if (rawShortfalls) requirement.rawShortfalls = rawShortfalls;
			if (craftTree) requirement.craftTree = craftTree;
			requirements.push(requirement);

			if (have < req.qty) {
				ok = false;
				shortfalls.push({ ...requirement });

				const existing = totalShortfallMap.get(req.item);
				if (existing) {
					accumulateShortfall(
						existing,
						req.qty,
						short,
						capped,
						craftableQty,
						rawShortfalls,
						exceedsCapacity || undefined,
						effectiveCap,
						maxCapacity !== null ? currentCumulative : undefined,
						breachedCapsMap.get(req.item),
						capType,
						isSingleQuestBreach,
						isCumulativeOnly
					);

					// Same quest can hit the same item twice only if it lists the
					// item as a requirement more than once — fold into the same
					// share rather than pushing a duplicate row.
					const share = existing.byQuest.find((b) => b.seq === q.seq);
					if (share) {
						share.short += short;
						if (rawShortfalls) {
							if (!share.rawShortfalls) share.rawShortfalls = new Map();
							for (const [item, quantity] of rawShortfalls) {
								share.rawShortfalls.set(item, (share.rawShortfalls.get(item) ?? 0) + quantity);
							}
						}
					} else {
						existing.byQuest.push({
							questName: q.name,
							seq: q.seq,
							short,
							craftableQty,
							...(rawShortfalls && { rawShortfalls }),
							...(craftTree && { craftTree }),
							...(isThresholdBreaker && { isThresholdBreaker }),
							...(capType && { capType })
						});
					}
				} else {
					const aggregate: AggregatedItemShortfall = {
						item: req.item,
						needed: req.qty,
						have,
						short,
						byQuest: [
							{
								questName: q.name,
								seq: q.seq,
								short,
								...(craftableQty !== undefined && { craftableQty }),
								...(rawShortfalls && { rawShortfalls }),
								...(craftTree && { craftTree }),
								...(isThresholdBreaker && { isThresholdBreaker }),
								...(capType && { capType })
							}
						]
					};
					if (maxCapacity !== null) {
						aggregate.cumulativeNeeded = currentCumulative;
					}
					if (exceedsCapacity) {
						aggregate.exceedsCapacity = true;
						aggregate.storageCap = effectiveCap;
						if (capType !== undefined) aggregate.capType = capType;
						if (isCumulativeOnly !== undefined) aggregate.isCumulativeOnly = isCumulativeOnly;
					}
					if (isSingleQuestBreach !== undefined) {
						aggregate.isSingleQuestBreach = isSingleQuestBreach;
					}
					if (isThresholdBreaker) {
						aggregate.isThresholdBreaker = true;
					}
					if (capped !== undefined) aggregate.capped = capped;
					if (craftableQty !== undefined) {
						aggregate.craftableQty = craftableQty;
						aggregate.byQuest[0].craftableQty = craftableQty;
					}
					if (rawShortfalls) {
						aggregate.rawShortfalls = rawShortfalls;
						aggregate.byQuest[0].rawShortfalls = rawShortfalls;
					}
					if (craftTree) aggregate.byQuest[0].craftTree = craftTree;
					totalShortfallMap.set(req.item, aggregate);
				}
			}
		}

		quests.push({
			questName: q.name,
			seq: q.seq,
			shortfalls,
			requirements,
			ok,
			done: false,
			...(questBottlenecks.length > 0 && { capacityBottlenecks: questBottlenecks })
		});
		if (!ok && wallPointIndex === null) wallPointIndex = i;
	}

	return {
		questlineName: questline.name,
		quests,
		wallPointIndex,
		totalShortfalls: Array.from(totalShortfallMap.values()).sort((a, b) => b.short - a.short)
	};
}

/**
 * Walks a questline's quests in order, decrementing a cloned copy of the
 * player's inventory as each quest's requirements are consumed. Reports,
 * per quest, whether the player currently has enough on hand, and the first
 * quest (the "wall point") where they don't.
 */
export function diffQuestline(
	questline: Questline,
	startingInventory: Map<string, number>,
	completed: Set<string> = new Set(),
	caps: Map<string, number> = new Map(),
	recipes: RecipeMap = new Map(),
	maxCapacity: number | null = null,
	options: DiffOptions = {}
): QuestlineDiffResult {
	const inv = new Map(startingInventory);
	return walkQuestline(
		questline,
		inv,
		completed,
		caps,
		recipes,
		createCraftingPlanner(inv, recipes, {
			playerStats: options.playerStats,
			recipeGates: options.recipeGates
		}),
		maxCapacity,
		new Map(),
		new Map(),
		options
	);
}

/**
 * Diffs multiple questlines against one shared inventory, threading the same
 * mutated inventory between them in array order. Whichever questline runs
 * first gets first claim on scarce shared items, so results are
 * ordering-dependent by design.
 */
export function diffQuestlineQueue(
	questlines: Questline[],
	startingInventory: Map<string, number>,
	completed: Set<string> = new Set(),
	caps: Map<string, number> = new Map(),
	recipes: RecipeMap = new Map(),
	maxCapacity: number | null = null,
	options: DiffOptions = {}
): QuestlineDiffResult[] {
	const inv = new Map(startingInventory);
	const craftingPlanner = createCraftingPlanner(inv, recipes, {
		playerStats: options.playerStats,
		recipeGates: options.recipeGates
	});
	const cumulativeRequiredMap = new Map<string, number>();
	const breachedCapsMap = new Map<string, string>();
	return questlines.map((questline) =>
		walkQuestline(
			questline,
			inv,
			completed,
			caps,
			recipes,
			craftingPlanner,
			maxCapacity,
			cumulativeRequiredMap,
			breachedCapsMap,
			options
		)
	);
}

/** One questline's contribution to a queue-level aggregated item shortfall, still broken down by quest. */
export interface QuestlineShortfallShare {
	questlineName: string;
	short: number;
	byQuest: QuestShortfallShare[];
	craftableQty?: number;
	rawShortfalls?: Map<string, number>;
	craftTree?: CraftTreeNode;
}

/** A queue-level aggregated shortfall, broken down by which questline(s) — and, within each, which quest(s) — it came from. */
export interface QueueItemShortfall extends ItemShortfall {
	byQuestline: QuestlineShortfallShare[];
}

/**
 * Rolls up per-questline `totalShortfalls` (already produced by
 * `diffQuestlineQueue`) into one queue-wide breakdown per item, so a
 * multi-questline summary can show "you're short 40 Wood total: 25 from
 * Chain A (quest II), 15 from Chain B (quest I)" without re-walking anything.
 */
export function aggregateQueueShortfalls(results: QuestlineDiffResult[]): QueueItemShortfall[] {
	const map = new Map<string, QueueItemShortfall>();

	for (const result of results) {
		for (const s of result.totalShortfalls) {
			const share: QuestlineShortfallShare = {
				questlineName: result.questlineName,
				short: s.short,
				// Copy rather than alias — this reads from result.totalShortfalls,
				// which diffResults/shortfallSummary also hold a reference to; the
				// UI already iterates byQuest in a keyed {#each}, one edit away
				// from an in-place sort that would otherwise corrupt the source.
				byQuest: [...s.byQuest]
			};
			if (s.craftableQty !== undefined) share.craftableQty = s.craftableQty;
			if (s.rawShortfalls) share.rawShortfalls = new Map(s.rawShortfalls);
			if (s.craftTree) share.craftTree = s.craftTree;

			const existing = map.get(s.item);
			if (existing) {
				accumulateShortfall(
					existing,
					s.needed,
					s.short,
					s.capped,
					s.craftableQty,
					s.rawShortfalls,
					s.exceedsCapacity,
					s.storageCap,
					s.cumulativeNeeded,
					s.thresholdBreakerQuest,
					s.capType,
					s.isSingleQuestBreach,
					s.isCumulativeOnly
				);
				existing.byQuestline.push(share);
			} else {
				map.set(s.item, {
					item: s.item,
					needed: s.needed,
					have: s.have,
					short: s.short,
					capped: s.capped,
					...(s.exceedsCapacity !== undefined && { exceedsCapacity: s.exceedsCapacity }),
					...(s.storageCap !== undefined && { storageCap: s.storageCap }),
					...(s.cumulativeNeeded !== undefined && { cumulativeNeeded: s.cumulativeNeeded }),
					...(s.isThresholdBreaker !== undefined && { isThresholdBreaker: s.isThresholdBreaker }),
					...(s.thresholdBreakerQuest !== undefined && {
						thresholdBreakerQuest: s.thresholdBreakerQuest
					}),
					...(s.capType !== undefined && { capType: s.capType }),
					...(s.isSingleQuestBreach !== undefined && {
						isSingleQuestBreach: s.isSingleQuestBreach
					}),
					...(s.isCumulativeOnly !== undefined && { isCumulativeOnly: s.isCumulativeOnly }),
					byQuestline: [share],
					...(s.craftableQty !== undefined && { craftableQty: s.craftableQty }),
					...(s.rawShortfalls && { rawShortfalls: new Map(s.rawShortfalls) })
				});
			}
		}
	}

	return Array.from(map.values()).sort((a, b) => b.short - a.short);
}

/** Where a given item's shortfall first appears in queue order — the exact quest where a stockpile that started out covering everything finally stops being enough. */
export interface ItemRunsDryAt {
	item: string;
	questlineName: string;
	questName: string;
}

/**
 * For each item in `items` (typically the set currently maxed in the
 * player's pasted inventory), finds the first quest — walking `results` in
 * queue order, same order the shared inventory was actually consumed in —
 * where that item goes short. Only meaningful for an item whose stockpile
 * started out covering everything; an item that's already short from the
 * first quest that needs it doesn't need this, since every row already
 * shows the shortfall.
 */
export function findRunsDryPoints(
	results: QuestlineDiffResult[],
	items: Iterable<string>
): Map<string, ItemRunsDryAt> {
	const targets = new Set(items);
	const found = new Map<string, ItemRunsDryAt>();

	for (const result of results) {
		for (const q of result.quests) {
			for (const s of q.shortfalls) {
				if (targets.has(s.item) && !found.has(s.item)) {
					found.set(s.item, {
						item: s.item,
						questlineName: result.questlineName,
						questName: q.questName
					});
				}
			}
		}
	}

	return found;
}
