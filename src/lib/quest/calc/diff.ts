import { questKey, type Questline } from '../types';

export interface ItemShortfall {
	item: string;
	needed: number;
	have: number;
	short: number;
	/** True when a single requirement for this item exceeds the player's known storage cap for it (from a "MAX ON HAND" inventory paste) — no amount of farming clears this until the cap is raised or the item is spent down elsewhere, unlike an ordinary shortfall. */
	capped?: boolean;
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
}

/** One quest's contribution to a chain-level aggregated item shortfall. */
export interface QuestShortfallShare {
	questName: string;
	seq: number;
	short: number;
}

/** A chain-level aggregated shortfall, broken down by which quest(s) in the chain it came from. */
export interface AggregatedItemShortfall extends ItemShortfall {
	byQuest: QuestShortfallShare[];
}

/** Folds a new `needed`/`short` hit into an existing aggregate in place, keeping `have = needed - short` internally consistent — the single accumulation rule shared by the chain-level (`walkQuestline`) and queue-level (`aggregateQueueShortfalls`) rollups, so the invariant can't drift out of sync between the two call sites. */
function accumulateShortfall(
	target: ItemShortfall,
	needed: number,
	short: number,
	capped = false
): void {
	target.needed += needed;
	target.short += short;
	target.have = target.needed - target.short;
	if (capped) target.capped = true;
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
	caps: Map<string, number>
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
		let ok = true;

		for (const req of q.requirements) {
			const have = inv.get(req.item) ?? 0;
			const short = Math.max(0, req.qty - have);
			const cap = caps.get(req.item);
			const capped = cap !== undefined && req.qty > cap ? true : undefined;
			requirements.push({ item: req.item, needed: req.qty, have, short, capped });

			if (have < req.qty) {
				ok = false;
				shortfalls.push({ item: req.item, needed: req.qty, have, short, capped });

				const existing = totalShortfallMap.get(req.item);
				if (existing) {
					accumulateShortfall(existing, req.qty, short, capped);

					// Same quest can hit the same item twice only if it lists the
					// item as a requirement more than once — fold into the same
					// share rather than pushing a duplicate row.
					const share = existing.byQuest.find((b) => b.seq === q.seq);
					if (share) share.short += short;
					else existing.byQuest.push({ questName: q.name, seq: q.seq, short });
				} else {
					totalShortfallMap.set(req.item, {
						item: req.item,
						needed: req.qty,
						have,
						short,
						capped,
						byQuest: [{ questName: q.name, seq: q.seq, short }]
					});
				}
			}

			// Decrement regardless of shortfall so later quests in the chain
			// still show accurate running numbers (floor at 0, never negative).
			inv.set(req.item, Math.max(0, have - req.qty));
		}

		quests.push({ questName: q.name, seq: q.seq, shortfalls, requirements, ok, done: false });
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
	caps: Map<string, number> = new Map()
): QuestlineDiffResult {
	return walkQuestline(questline, new Map(startingInventory), completed, caps);
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
	caps: Map<string, number> = new Map()
): QuestlineDiffResult[] {
	const inv = new Map(startingInventory);
	return questlines.map((questline) => walkQuestline(questline, inv, completed, caps));
}

/** One questline's contribution to a queue-level aggregated item shortfall, still broken down by quest. */
export interface QuestlineShortfallShare {
	questlineName: string;
	short: number;
	byQuest: QuestShortfallShare[];
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

			const existing = map.get(s.item);
			if (existing) {
				accumulateShortfall(existing, s.needed, s.short, s.capped);
				existing.byQuestline.push(share);
			} else {
				map.set(s.item, {
					item: s.item,
					needed: s.needed,
					have: s.have,
					short: s.short,
					capped: s.capped,
					byQuestline: [share]
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
