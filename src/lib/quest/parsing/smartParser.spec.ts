import { describe, it, expect } from 'vitest';
import { detectInputType, detectAndParseInput, extractMaxCapacityFromText } from './smartParser';

const INVENTORY_SAMPLE = `
Currently, you cannot have more than 1,000 of most items.
Meals chevron_down
Acorn Pie
A tasty pie made of acorns.
5
Items chevron_down
Amethyst
A shiny purple gem.
908
Inventory Stats
Your inventory contains 2 unique items.
`;

const STATS_SAMPLE = `
Farming
Level 99
Fishing
Level 80
Crafting
Level 90
Exploring
Level 70
Cooking
Level 50
Mining
Now in Beta
Tower Level
15
Rosalie
Level 50
Holger
Level 25
`;

const MINING_SAMPLE = `
Mining Locations
Spring Cave
Floor 100
Highland Hollow
Floor 50
Sol Grotto
Floor 20
`;

const BANK_SAMPLE = `
BULK OPTIONS
Deposit All
613,871,898 Silver
Withdraw All
824,000,000 Silver
`;

const COMPLETED_SAMPLE = `
Completed Requests (2)

Help with Acorns
Request from Buddy
Completed on 2026-07-15 05:10:55
check

Apple Picking
Request from Rosalie
Completed on 2026-07-15 05:10:55
check
`;

describe('detectInputType', () => {
	it('detects bank paste with high confidence', () => {
		const res = detectInputType(BANK_SAMPLE);
		expect(res.type).toBe('bank');
		expect(res.confidence).toBe('high');
	});

	it('detects mining floors paste with high confidence', () => {
		const res = detectInputType(MINING_SAMPLE);
		expect(res.type).toBe('mining');
		expect(res.confidence).toBe('high');
	});

	it('detects player stats paste with high confidence', () => {
		const res = detectInputType(STATS_SAMPLE);
		expect(res.type).toBe('stats');
		expect(res.confidence).toBe('high');
	});

	it('detects completed quests paste with high confidence', () => {
		const res = detectInputType(COMPLETED_SAMPLE);
		expect(res.type).toBe('completed');
		expect(res.confidence).toBe('high');
	});

	it('detects inventory dump paste with high confidence', () => {
		const res = detectInputType(INVENTORY_SAMPLE);
		expect(res.type).toBe('inventory');
		expect(res.confidence).toBe('high');
	});

	it('returns unknown for empty or meaningless text', () => {
		const res = detectInputType('   \n  ');
		expect(res.type).toBe('unknown');
	});
});

describe('extractMaxCapacityFromText', () => {
	it('extracts capacity number from standard anchor line', () => {
		expect(extractMaxCapacityFromText(INVENTORY_SAMPLE)).toBe(1000);
		expect(
			extractMaxCapacityFromText('Currently, you cannot have more than 2,500 of most items.')
		).toBe(2500);
	});

	it('returns null if anchor line is not present or non-matching', () => {
		expect(extractMaxCapacityFromText(STATS_SAMPLE)).toBeNull();
	});
});

describe('detectAndParseInput', () => {
	it('auto-detects and parses inventory with capacity detection', () => {
		const res = detectAndParseInput(INVENTORY_SAMPLE, 'auto');
		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.type).toBe('inventory');
			expect(res.inventory?.rawLines.length).toBe(2);
			expect(res.inventory?.maxCapacityDetected).toBe(1000);
		}
	});

	it('auto-detects and parses player stats', () => {
		const res = detectAndParseInput(STATS_SAMPLE, 'auto');
		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.type).toBe('stats');
			expect(res.playerStats?.farming).toBe(99);
			expect(res.playerStats?.tower).toBe(15);
			expect(res.playerStats?.npcLevels.Rosalie).toBe(50);
		}
	});

	it('auto-detects and parses mining floors', () => {
		const res = detectAndParseInput(MINING_SAMPLE, 'auto');
		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.type).toBe('mining');
			expect(res.miningFloors?.springCave).toBe(100);
			expect(res.miningFloors?.highlandHollow).toBe(50);
		}
	});

	it('auto-detects and parses bank silver', () => {
		const res = detectAndParseInput(BANK_SAMPLE, 'auto');
		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.type).toBe('bank');
			expect(res.bank?.walletSilver).toBe(613871898);
			expect(res.bank?.bankSilver).toBe(824000000);
		}
	});

	it('auto-detects and parses completed quests', () => {
		const res = detectAndParseInput(COMPLETED_SAMPLE, 'auto');
		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.type).toBe('completed');
			expect(res.completedQuestNames?.length).toBeGreaterThan(0);
		}
	});

	it('supports fallback override mode', () => {
		// When mode is explicitly specified as 'mining' even if input is ambiguous
		const res = detectAndParseInput(MINING_SAMPLE, 'mining');
		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.type).toBe('mining');
		}
	});

	it('returns ok: false on empty text', () => {
		const res = detectAndParseInput('   ', 'auto');
		expect(res.ok).toBe(false);
	});
});
