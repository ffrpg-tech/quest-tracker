import { describe, it, expect } from 'vitest';
import {
	buildPredReverseIndex,
	evaluateQuestEligibility,
	evaluateQuestlineEligibility,
	isUnavailable
} from './eligibility';
import type { PlayerStats, Quest, Questline } from '../types';

const baseStats: PlayerStats = {
	farming: 10,
	fishing: 10,
	crafting: 10,
	exploring: 10,
	tower: 10,
	cooking: 10,
	npcLevels: { Rosalie: 5 }
};

const noRequirementQuest: Quest = {
	name: 'No Requirements',
	startDate: '',
	endDate: '',
	requirements: [],
	seq: 0
};

describe('evaluateQuestEligibility', () => {
	it('is eligible when a quest has no requirements', () => {
		const result = evaluateQuestEligibility(noRequirementQuest, baseStats);
		expect(result.eligible).toBe(true);
		expect(result.gaps).toEqual([]);
	});

	it.each(['farming', 'fishing', 'crafting', 'exploring', 'tower', 'cooking'] as const)(
		'reports a skill gap when %s level is short',
		(skill) => {
			const quest: Quest = {
				name: 'Skill Gated',
				startDate: '',
				endDate: '',
				requirements: [],
				seq: 0,
				requiredLevels: { [skill]: 15 }
			};
			const result = evaluateQuestEligibility(quest, baseStats);
			expect(result.eligible).toBe(false);
			expect(result.gaps).toEqual([
				{ kind: 'skill', label: expect.any(String), required: 15, have: 10 }
			]);
		}
	);

	it('reports an NPC gap when friendship level is short', () => {
		const quest: Quest = {
			name: 'NPC Gated',
			startDate: '',
			endDate: '',
			requirements: [],
			seq: 0,
			requiredNpc: { npc: 'Rosalie', level: 20 }
		};
		const result = evaluateQuestEligibility(quest, baseStats);
		expect(result.eligible).toBe(false);
		expect(result.gaps).toEqual([{ kind: 'npc', label: 'Rosalie', required: 20, have: 5 }]);
	});

	it('is case/trim-insensitive when matching NPC names against stats', () => {
		const quest: Quest = {
			name: 'NPC Gated',
			startDate: '',
			endDate: '',
			requirements: [],
			seq: 0,
			requiredNpc: { npc: '  ROSALIE  ', level: 5 }
		};
		const result = evaluateQuestEligibility(quest, baseStats);
		expect(result.eligible).toBe(true);
	});

	it('treats an NPC with no recorded friendship level as level 0', () => {
		const quest: Quest = {
			name: 'Unknown NPC',
			startDate: '',
			endDate: '',
			requirements: [],
			seq: 0,
			requiredNpc: { npc: 'Borgen', level: 1 }
		};
		const result = evaluateQuestEligibility(quest, baseStats);
		expect(result.gaps).toEqual([{ kind: 'npc', label: 'Borgen', required: 1, have: 0 }]);
	});

	it('reports multiple gaps at once', () => {
		const quest: Quest = {
			name: 'Multi Gated',
			startDate: '',
			endDate: '',
			requirements: [],
			seq: 0,
			requiredLevels: { farming: 15, cooking: 20 },
			requiredNpc: { npc: 'Rosalie', level: 20 }
		};
		const result = evaluateQuestEligibility(quest, baseStats);
		expect(result.gaps).toHaveLength(3);
		expect(result.eligible).toBe(false);
	});

	describe('seasonal availability', () => {
		const now = new Date('2026-07-20T00:00:00Z');

		it('is not a gap when neither startDate nor endDate is set', () => {
			const result = evaluateQuestEligibility(noRequirementQuest, baseStats, now);
			expect(result.eligible).toBe(true);
		});

		it('is eligible when now falls inside the [startDate, endDate] window', () => {
			const quest: Quest = {
				...noRequirementQuest,
				startDate: '2026-07-01T00:00:00Z',
				endDate: '2026-07-31T00:00:00Z'
			};
			const result = evaluateQuestEligibility(quest, baseStats, now);
			expect(result.eligible).toBe(true);
		});

		it('reports a not-yet-started season gap (LOCKED, not expired) when now is before startDate', () => {
			const quest: Quest = {
				...noRequirementQuest,
				startDate: '2026-08-01T00:00:00Z',
				endDate: '2026-08-31T00:00:00Z'
			};
			const result = evaluateQuestEligibility(quest, baseStats, now);
			expect(result.eligible).toBe(false);
			expect(result.gaps).toEqual([
				{
					kind: 'season',
					label: 'Seasonal',
					detail: expect.stringContaining('Only available'),
					expired: false
				}
			]);
			expect(isUnavailable(result.gaps)).toBe(false);
		});

		it('reports an expired season gap (UNAVAILABLE) when now is after endDate', () => {
			const quest: Quest = {
				...noRequirementQuest,
				startDate: '2026-06-01T00:00:00Z',
				endDate: '2026-06-30T00:00:00Z'
			};
			const result = evaluateQuestEligibility(quest, baseStats, now);
			expect(result.eligible).toBe(false);
			expect(result.gaps[0]).toMatchObject({ kind: 'season', expired: true });
			expect(isUnavailable(result.gaps)).toBe(true);
		});

		it('is expired/unavailable for an endDate-only window that already passed', () => {
			const quest: Quest = {
				...noRequirementQuest,
				startDate: '',
				endDate: '2026-06-30T00:00:00Z'
			};
			const result = evaluateQuestEligibility(quest, baseStats, now);
			expect(result.eligible).toBe(false);
			expect(result.gaps[0].expired).toBe(true);
			expect(isUnavailable(result.gaps)).toBe(true);
		});

		it('is locked but not expired for a startDate-only window not yet reached (no defined end)', () => {
			const quest: Quest = {
				...noRequirementQuest,
				startDate: '2026-08-01T00:00:00Z',
				endDate: ''
			};
			const result = evaluateQuestEligibility(quest, baseStats, now);
			expect(result.eligible).toBe(false);
			expect(result.gaps[0].expired).toBe(false);
			expect(isUnavailable(result.gaps)).toBe(false);
		});
	});
});

describe('evaluateQuestlineEligibility', () => {
	const questline: Questline = {
		name: 'Test Chain',
		questCount: 2,
		quests: [
			{
				name: 'Test Chain I',
				startDate: '',
				endDate: '',
				requirements: [],
				seq: 0,
				requiredLevels: { farming: 15 }
			},
			{
				name: 'Test Chain II',
				startDate: '',
				endDate: '',
				requirements: [],
				seq: 1
			}
		]
	};

	it('marks completed quests done without evaluating gaps', () => {
		const completed = new Set(['Test Chain::Test Chain I']);
		const result = evaluateQuestlineEligibility(questline, baseStats, completed);
		expect(result.quests[0]).toEqual({
			questName: 'Test Chain I',
			seq: 0,
			done: true,
			eligible: true,
			gaps: []
		});
	});

	it('is not allEligible when any non-done quest has a gap', () => {
		const result = evaluateQuestlineEligibility(questline, baseStats);
		expect(result.quests[0].eligible).toBe(false);
		expect(result.allEligible).toBe(false);
	});

	it('cannot start now when the very next non-done quest has a gap', () => {
		const result = evaluateQuestlineEligibility(questline, baseStats);
		expect(result.canStartNow).toBe(false);
	});

	it('can start now when the next non-done quest is fine, even if a later quest has a gap', () => {
		// Same shape as `questline`, but reordered so the gapped quest is second —
		// the player can still act on quest I right now even though II is walled.
		const reordered: Questline = {
			name: 'Test Chain',
			questCount: 2,
			quests: [questline.quests[1], questline.quests[0]]
		};
		const result = evaluateQuestlineEligibility(reordered, baseStats);
		expect(result.allEligible).toBe(false);
		expect(result.canStartNow).toBe(true);
	});

	it('can start now when every quest is already done', () => {
		const completed = new Set(['Test Chain::Test Chain I', 'Test Chain::Test Chain II']);
		const result = evaluateQuestlineEligibility(questline, baseStats, completed);
		expect(result.canStartNow).toBe(true);
	});

	describe('prerequisites (pred)', () => {
		const upstream: Questline = {
			name: 'Upstream Chain',
			questCount: 2,
			quests: [
				{ name: 'Upstream I', startDate: '', endDate: '', requirements: [], seq: 0 },
				{ name: 'Upstream II', startDate: '', endDate: '', requirements: [], seq: 1 }
			]
		};

		const gatedQuestline: Questline = {
			name: 'Gated Chain',
			questCount: 1,
			quests: [
				{
					name: 'Gated I',
					startDate: '',
					endDate: '',
					requirements: [],
					seq: 0,
					pred: { questlines: [{ questline: { title: 'Upstream Chain' }, order: 1 }] }
				}
			]
		};

		const allQuestlines = new Map([
			['Upstream Chain', upstream],
			['Gated Chain', gatedQuestline]
		]);

		it('reports a pred gap when the referenced predecessor quest is not completed', () => {
			const result = evaluateQuestlineEligibility(
				gatedQuestline,
				baseStats,
				new Set(),
				allQuestlines
			);
			expect(result.quests[0].eligible).toBe(false);
			expect(result.quests[0].gaps).toEqual([
				{ kind: 'pred', label: 'Upstream Chain', detail: 'Complete "Upstream II" first' }
			]);
		});

		it('clears the pred gap once the referenced predecessor quest is completed', () => {
			const completed = new Set(['Upstream Chain::Upstream II']);
			const result = evaluateQuestlineEligibility(
				gatedQuestline,
				baseStats,
				completed,
				allQuestlines
			);
			expect(result.quests[0].eligible).toBe(true);
			expect(result.quests[0].gaps).toEqual([]);
		});

		it('requires every listed prerequisite (AND semantics), not just one', () => {
			const multiGated: Questline = {
				name: 'Multi Gated Chain',
				questCount: 1,
				quests: [
					{
						name: 'Multi Gated I',
						startDate: '',
						endDate: '',
						requirements: [],
						seq: 0,
						pred: {
							questlines: [
								{ questline: { title: 'Upstream Chain' }, order: 0 },
								{ questline: { title: 'Upstream Chain' }, order: 1 }
							]
						}
					}
				]
			};
			// Only the order-0 predecessor is done; order-1 is still outstanding.
			const completed = new Set(['Upstream Chain::Upstream I']);
			const result = evaluateQuestlineEligibility(multiGated, baseStats, completed, allQuestlines);
			expect(result.quests[0].eligible).toBe(false);
			expect(result.quests[0].gaps).toEqual([
				{ kind: 'pred', label: 'Upstream Chain', detail: 'Complete "Upstream II" first' }
			]);
		});

		it('fails open (no gap) when pred references an unknown questline title', () => {
			const dangling: Questline = {
				name: 'Dangling Chain',
				questCount: 1,
				quests: [
					{
						name: 'Dangling I',
						startDate: '',
						endDate: '',
						requirements: [],
						seq: 0,
						pred: { questlines: [{ questline: { title: 'Nonexistent Chain' }, order: 0 }] }
					}
				]
			};
			const result = evaluateQuestlineEligibility(dangling, baseStats, new Set(), allQuestlines);
			expect(result.quests[0].eligible).toBe(true);
			expect(result.quests[0].gaps).toEqual([]);
		});

		it('fails open (no gap) when pred references an order with no matching quest seq', () => {
			const dangling: Questline = {
				name: 'Dangling Chain',
				questCount: 1,
				quests: [
					{
						name: 'Dangling I',
						startDate: '',
						endDate: '',
						requirements: [],
						seq: 0,
						pred: { questlines: [{ questline: { title: 'Upstream Chain' }, order: 99 }] }
					}
				]
			};
			const result = evaluateQuestlineEligibility(dangling, baseStats, new Set(), allQuestlines);
			expect(result.quests[0].eligible).toBe(true);
			expect(result.quests[0].gaps).toEqual([]);
		});
	});
});

describe('buildPredReverseIndex', () => {
	const mkQuestline = (name: string, quests: Partial<Quest>[]): Questline => ({
		name,
		questCount: quests.length,
		quests: quests.map((q, i) => ({
			name: `${name} ${i}`,
			startDate: '',
			endDate: '',
			requirements: [],
			seq: i,
			...q
		}))
	});

	it('maps a referenced questline to the questlines that pred-reference it', () => {
		const upstream = mkQuestline('Upstream', [{}, {}]);
		const downstream = mkQuestline('Downstream', [
			{ pred: { questlines: [{ questline: { title: 'Upstream' }, order: 1 }] } }
		]);
		const options = [upstream, downstream];
		const byName = new Map(options.map((g) => [g.name, g]));

		const index = buildPredReverseIndex(options, byName);

		expect(index.get('Upstream')).toEqual(new Set(['Downstream']));
		// Nothing references Downstream.
		expect(index.has('Downstream')).toBe(false);
	});

	it('collects every dependent and dedupes multiple refs from the same questline', () => {
		const upstream = mkQuestline('Upstream', [{}, {}]);
		const a = mkQuestline('A', [
			{ pred: { questlines: [{ questline: { title: 'Upstream' }, order: 0 }] } },
			{ pred: { questlines: [{ questline: { title: 'Upstream' }, order: 1 }] } }
		]);
		const b = mkQuestline('B', [
			{ pred: { questlines: [{ questline: { title: 'Upstream' }, order: 1 }] } }
		]);
		const options = [upstream, a, b];
		const byName = new Map(options.map((g) => [g.name, g]));

		expect(buildPredReverseIndex(options, byName).get('Upstream')).toEqual(new Set(['A', 'B']));
	});

	it('skips refs to unknown questline titles (predGaps fails open on them anyway)', () => {
		const orphan = mkQuestline('Orphan', [
			{ pred: { questlines: [{ questline: { title: 'Nonexistent' }, order: 0 }] } }
		]);
		const options = [orphan];
		const byName = new Map(options.map((g) => [g.name, g]));

		expect(buildPredReverseIndex(options, byName).size).toBe(0);
	});
});
