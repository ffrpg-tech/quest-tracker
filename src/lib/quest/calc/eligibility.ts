import {
	questKey,
	type PlayerStats,
	type Quest,
	type Questline,
	type SkillLevelRequirement
} from '../types';

export interface EligibilityGap {
	kind: 'skill' | 'npc' | 'season' | 'pred' | 'miningFloor';
	label: string;
	/** Set for 'miningFloor' gaps (e.g. 'fenrirsDen', 'springCave'). */
	area?: string;
	/** Only meaningful for 'skill'/'npc' — a 'season' gap is a date window, not a level. */
	required?: number;
	have?: number;
	/** Human-readable explanation — set for 'season' gaps (e.g. "Only available Jul 19 – Aug 19, 2026")
	 * and 'pred' gaps (e.g. 'Complete "Light the Fuse" first'). */
	detail?: string;
	/** Only set (and only ever true) for a 'season' gap whose `endDate` has already passed —
	 * distinct from "not yet started": a future season is a plain, temporary LOCKED (it will
	 * open on its own), but an already-ended one is UNAVAILABLE — there's no known guarantee
	 * it ever comes back, unlike a skill/NPC gap the player can always close by leveling up. */
	expired?: boolean;
}

/** True when any gap is a permanently-uncertain block (an expired seasonal window) rather
 * than one the player can eventually close themselves — drives the LOCKED vs UNAVAILABLE
 * distinction in the UI. Centralized here so the rule can't drift between the picker's
 * badge and the Results per-quest status. */
export function isUnavailable(gaps: EligibilityGap[]): boolean {
	return gaps.some((g) => g.kind === 'season' && g.expired);
}

export interface QuestEligibility {
	questName: string;
	seq: number;
	done: boolean;
	eligible: boolean;
	gaps: EligibilityGap[];
}

export interface QuestlineEligibility {
	questlineName: string;
	quests: QuestEligibility[];
	/** True when every non-done quest in the chain is eligible. Not the same as
	 * `canStartNow` — a chain can have a gap deep in the middle while every quest
	 * up to that point (including the very next one) is fully startable now. */
	allEligible: boolean;
	/** True when the very next non-done quest (or there is none left) has no gap —
	 * this is what "can I make progress on this chain right now" actually means,
	 * as opposed to `allEligible`, which also flags chains with a wall many quests
	 * away that don't block anything today. Drives the picker's Eligible/Locked
	 * filter and badge. */
	canStartNow: boolean;
}

const SKILL_LABELS: Record<keyof SkillLevelRequirement, string> = {
	farming: 'Farming',
	fishing: 'Fishing',
	crafting: 'Crafting',
	exploring: 'Exploring',
	tower: 'Tower',
	cooking: 'Cooking',
	mining: 'Mining'
};

const MINING_AREA_LABELS: Record<string, string> = {
	springCave: 'Spring Cave',
	highlandHollow: 'Highland Hollow',
	solGrotto: 'Sol Grotto',
	emberCaverns: 'Ember Caverns',
	fenrirsDen: "Fenrir's Den",
	mossrockMine: 'Mossrock Mine'
};

/** Case/trim-insensitive only — a safety net for casing drift (e.g. `ROOMBA` vs `Roomba`)
 * between a pasted profile and `Quest.requiredNpc.name`. It does not resolve truncated
 * names (`Star` vs `Star Meerif`); that resolution happens once, at parse time, in
 * stats.ts, which stores `npcLevels` under already-canonical names. */
function normalizeNpcName(name: string): string {
	return name.trim().toLowerCase();
}

const norm = (s: string): string =>
	s
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim();

export type EligibilityIndexes = {
	questlinesByTitle: Map<string, Questline>;
	npcLevelsByName: Map<string, number>;
};

export function buildQuestlineTitleIndex(
	allQuestlines: Map<string, Questline>
): Map<string, Questline> {
	return new Map([...allQuestlines].map(([name, questline]) => [norm(name), questline]));
}

export function buildNpcLevelIndex(stats: PlayerStats | null): Map<string, number> {
	return new Map(
		stats
			? Object.entries(stats.npcLevels).map(([name, level]) => [normalizeNpcName(name), level])
			: []
	);
}

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});
}

function formatRecurringDate(d: Date): string {
	return d.toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	});
}

/** `Quest.startDate`/`endDate` are '' for non-seasonal quests (see fetch-questlines.mjs) —
 * only treated as a gate when at least one is a real date. `now` is injectable so this
 * stays deterministic in tests instead of depending on the wall clock.
 * For `isRecurring` quests, the seasonal window repeats annually without requiring year bumps. */
function seasonGap(
	quest: Quest,
	now: Date,
	isRecurring = quest.recurring ?? false
): EligibilityGap | null {
	if (!quest.startDate && !quest.endDate) return null;

	if (isRecurring && quest.startDate && quest.endDate) {
		const s = new Date(quest.startDate);
		const e = new Date(quest.endDate);
		const durationMs = e.getTime() - s.getTime();
		const currentYear = now.getUTCFullYear();

		// Candidates for current year and adjacent years (handles year rollover like Dec -> Jan)
		const candidates = [currentYear - 1, currentYear, currentYear + 1].map((y) => {
			const startCandidate = new Date(s);
			startCandidate.setUTCFullYear(y);
			const endCandidate = new Date(startCandidate.getTime() + durationMs);
			return { start: startCandidate, end: endCandidate };
		});

		const inWindow = candidates.some((c) => now >= c.start && now <= c.end);
		if (inWindow) return null;

		const range = `${formatRecurringDate(s)} – ${formatRecurringDate(e)}`;
		return { kind: 'season', label: 'Seasonal', detail: `Only available ${range}`, expired: true };
	}

	const start = quest.startDate ? new Date(quest.startDate) : null;
	const end = quest.endDate ? new Date(quest.endDate) : null;
	const inWindow = (!start || now >= start) && (!end || now <= end);
	if (inWindow) return null;

	const range =
		quest.startDate && quest.endDate
			? `${formatDate(quest.startDate)} – ${formatDate(quest.endDate)}`
			: quest.startDate
				? `starting ${formatDate(quest.startDate)}`
				: `until ${formatDate(quest.endDate!)}`;

	const expired = !!end && now > end;

	return { kind: 'season', label: 'Seasonal', detail: `Only available ${range}`, expired };
}

/** Resolves `quest.pred` (AND semantics — every listed questline/order pair must be reached
 * in `completed`) against the full known questline set. Fails open on any unresolvable ref
 * (unknown questline title, or an `order` with no matching quest `seq` in it) rather than
 * blocking the player on stale/dangling upstream data — that ref is treated as satisfied and
 * simply produces no gap. */
function predGaps(
	quest: Quest,
	allQuestlines: Map<string, Questline>,
	completed: Set<string>,
	questlinesByTitle = buildQuestlineTitleIndex(allQuestlines)
): EligibilityGap[] {
	const refs = quest.pred?.questlines ?? [];
	const gaps: EligibilityGap[] = [];

	for (const ref of refs) {
		const normalizedTargetTitle = norm(ref.questline.title);
		const target = questlinesByTitle.get(normalizedTargetTitle);
		if (!target) continue;

		const targetQuest = target.quests.find((q) => q.seq === ref.order);
		if (!targetQuest) continue;

		if (!completed.has(questKey(target.name, targetQuest.name))) {
			gaps.push({
				kind: 'pred',
				label: target.name,
				detail: `Complete "${targetQuest.name}" first`
			});
		}
	}

	return gaps;
}

/** `stats` is nullable: skill/NPC gaps require knowing the player's actual levels, so
 * they're skipped entirely (not reported as met, not reported as a gap — just unknown)
 * until stats have been pasted, matching the "unknown isn't locked" rule the picker/results
 * badges rely on. The seasonal gap is date-only and has nothing to do with player stats, so
 * it's always evaluated regardless — this is what lets an expired-season quest show as
 * UNAVAILABLE even before any stats paste. */
export function evaluateQuestEligibility(
	quest: Quest,
	stats: PlayerStats | null,
	floors: Record<string, number> | null = stats ? (stats.miningFloors ?? {}) : null,
	now: Date = new Date(),
	npcLevelsByName = buildNpcLevelIndex(stats),
	isRecurring = quest.recurring ?? false
): QuestEligibility {
	const gaps: EligibilityGap[] = [];

	if (stats) {
		if (quest.requiredLevels) {
			for (const [skill, required] of Object.entries(quest.requiredLevels) as [
				keyof SkillLevelRequirement,
				number | undefined
			][]) {
				if (required === undefined) continue;
				const have = stats[skill];
				if (have < required) {
					gaps.push({ kind: 'skill', label: SKILL_LABELS[skill], required, have });
				}
			}
		}

		if (quest.requiredNpc) {
			const normalizedTarget = normalizeNpcName(quest.requiredNpc.npc);
			const have = npcLevelsByName.get(normalizedTarget) ?? 0;
			if (have < quest.requiredNpc.level) {
				gaps.push({
					kind: 'npc',
					label: quest.requiredNpc.npc,
					required: quest.requiredNpc.level,
					have
				});
			}
		}
	}

	if (floors && quest.requiredMiningFloor) {
		for (const [rawArea, reqFloor] of Object.entries(quest.requiredMiningFloor)) {
			const areaKey = rawArea.trim();
			const playerFloor = floors[areaKey] ?? 0;

			if (playerFloor < reqFloor) {
				const areaName = MINING_AREA_LABELS[areaKey] ?? areaKey;
				gaps.push({
					kind: 'miningFloor',
					area: areaKey,
					label: areaName,
					required: reqFloor,
					have: playerFloor,
					detail: `Reach Floor ${reqFloor} first`
				});
			}
		}
	}

	const season = seasonGap(quest, now, isRecurring);
	if (season) gaps.push(season);

	return {
		questName: quest.name,
		seq: quest.seq,
		done: false,
		eligible: gaps.length === 0,
		gaps
	};
}

/**
 * Reverse `pred` dependency index: questline name -> names of questlines that
 * have at least one quest whose `pred` references it. Completing or uncompleting
 * a quest only ever changes eligibility for its own questline and for these
 * dependents (whose `pred` gap can open or close), so a per-toggle recompute can
 * be scoped to that set instead of re-evaluating the whole catalogue — a full
 * rebuild on every checkbox toggle was showing up as ~1.5s main-thread Long
 * Tasks (2000+ pred lookups + Date construction per pass).
 *
 * Refs resolve by questline *title*; the index is keyed by the resolved
 * questline's `name` (via `allQuestlines`), matching how `predGaps` looks its
 * targets up. An unresolvable title is skipped — `predGaps` fails open on it, so
 * it can never produce a gap and nothing depends on it.
 */
export function buildPredReverseIndex(
	questlineOptions: Questline[],
	allQuestlines: Map<string, Questline>
): Map<string, Set<string>> {
	const index = new Map<string, Set<string>>();
	const questlinesByTitle = buildQuestlineTitleIndex(allQuestlines);

	for (const g of questlineOptions) {
		for (const q of g.quests) {
			for (const ref of q.pred?.questlines ?? []) {
				const normalizedTargetTitle = norm(ref.questline.title);
				const target = questlinesByTitle.get(normalizedTargetTitle);
				if (!target) continue;
				let dependents = index.get(target.name);
				if (!dependents) index.set(target.name, (dependents = new Set()));
				dependents.add(g.name);
			}
		}
	}

	return index;
}

export function evaluateQuestlineEligibility(
	questline: Questline,
	stats: PlayerStats | null,
	floors: Record<string, number> | null = stats ? (stats.miningFloors ?? {}) : null,
	completed: Set<string> = new Set(),
	allQuestlines: Map<string, Questline> = new Map(),
	now: Date = new Date(),
	indexes: EligibilityIndexes = {
		questlinesByTitle: buildQuestlineTitleIndex(allQuestlines),
		npcLevelsByName: buildNpcLevelIndex(stats)
	}
): QuestlineEligibility {
	const isRecurring = questline.recurring ?? false;
	const quests = questline.quests.map((q) => {
		if (completed.has(questKey(questline.name, q.name))) {
			return { questName: q.name, seq: q.seq, done: true, eligible: true, gaps: [] };
		}

		const base = evaluateQuestEligibility(
			q,
			stats,
			floors,
			now,
			indexes.npcLevelsByName,
			q.recurring ?? isRecurring
		);
		const pred = predGaps(q, allQuestlines, completed, indexes.questlinesByTitle);
		if (pred.length === 0) return base;

		return { ...base, eligible: false, gaps: [...base.gaps, ...pred] };
	});

	const nextQuest = quests.find((q) => !q.done);

	return {
		questlineName: questline.name,
		quests,
		allEligible: quests.every((q) => q.eligible),
		canStartNow: !nextQuest || nextQuest.eligible
	};
}
