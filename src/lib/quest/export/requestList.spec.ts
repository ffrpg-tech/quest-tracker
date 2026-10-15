import { describe, expect, it } from 'vitest';
import { generateRequestList, MAX_FARM_RPG_CHAT_LENGTH, CHAT_PREFIX } from './requestList';

describe('requestList generator', () => {
	const mockMailableMap: Record<string, boolean> = {
		'Large Net': true,
		Aquamarine: true,
		'Arnold Palmer': true,
		Apple: true,
		Coal: true,
		Iron: false,
		'Glass Bottle': false,
		'Large Chest 01': false,
		Board: false
	};

	const canMailLookup = (name: string) => mockMailableMap[name];

	it('strictly filters out non-mailable and unknown items', () => {
		const raw = [
			{ item: 'Large Net', short: 140 },
			{ item: 'Iron', short: 400 },
			{ item: 'Glass Bottle', short: 60 },
			{ item: 'Aquamarine', short: 25 },
			{ item: 'Silver', short: 50000 } // unknown / not in map
		];

		const res = generateRequestList(raw, { canMailLookup });

		expect(res.mailableItems).toEqual([
			{ item: 'Large Net', qty: 140 },
			{ item: 'Aquamarine', qty: 25 }
		]);

		expect(res.excludedUnmailable).toEqual([
			{ item: 'Silver', qty: 50000 },
			{ item: 'Iron', qty: 400 },
			{ item: 'Glass Bottle', qty: 60 }
		]);
	});

	it('formats compact in-game chat messages prefixed with LF ((Item)) xCount', () => {
		const raw = [
			{ item: 'Large Net', short: 140 },
			{ item: 'Aquamarine', short: 25 }
		];

		const res = generateRequestList(raw, { canMailLookup });

		expect(res.chunks).toHaveLength(1);
		expect(res.chunks[0].text).toBe('LF ((Large Net)) x140, ((Aquamarine)) x25');
		expect(res.chunks[0].length).toBe(41);
		expect(res.allText).toBe('LF ((Large Net)) x140, ((Aquamarine)) x25');
	});

	it('greedily chunks messages when exceeding chat character limit', () => {
		// Use a smaller limit for predictable chunk verification
		const raw = [
			{ item: 'Large Net', short: 100 },
			{ item: 'Aquamarine', short: 80 },
			{ item: 'Arnold Palmer', short: 60 },
			{ item: 'Apple', short: 40 },
			{ item: 'Coal', short: 20 }
		];

		// 'LF ((Large Net)) x100, ((Aquamarine)) x80' is 42 chars
		const res = generateRequestList(raw, { canMailLookup, maxLength: 50 });

		expect(res.chunks.length).toBeGreaterThan(1);
		for (const chunk of res.chunks) {
			expect(chunk.length).toBeLessThanOrEqual(50);
			expect(chunk.text.startsWith(CHAT_PREFIX)).toBe(true);
		}
	});

	it('strictly guarantees all chunks are <= 250 characters for realistic item lists', () => {
		const raw = Array.from({ length: 30 }, (_, i) => ({
			item: `Mailable Item ${i + 1}`,
			short: (i + 1) * 10
		}));

		const customLookup = () => true;
		const res = generateRequestList(raw, { canMailLookup: customLookup });

		expect(res.chunks.length).toBeGreaterThan(1);
		for (const chunk of res.chunks) {
			expect(chunk.length).toBeLessThanOrEqual(MAX_FARM_RPG_CHAT_LENGTH);
			expect(chunk.text.startsWith(CHAT_PREFIX)).toBe(true);
		}
	});

	it('handles deductCraftable option properly', () => {
		const raw = [
			{ item: 'Large Net', short: 100, craftableQty: 30 },
			{ item: 'Aquamarine', short: 50, craftableQty: 50 }, // net 0
			{ item: 'Apple', short: 20, craftableQty: 0 }
		];

		// Without deduction
		const resGross = generateRequestList(raw, { canMailLookup, deductCraftable: false });
		expect(resGross.mailableItems).toEqual([
			{ item: 'Large Net', qty: 100 },
			{ item: 'Aquamarine', qty: 50 },
			{ item: 'Apple', qty: 20 }
		]);

		// With deduction
		const resNet = generateRequestList(raw, { canMailLookup, deductCraftable: true });
		expect(resNet.mailableItems).toEqual([
			{ item: 'Large Net', qty: 70 },
			{ item: 'Apple', qty: 20 }
		]);
	});

	it('aggregates shortfalls across duplicate items', () => {
		const raw = [
			{ item: 'Large Net', short: 50 },
			{ item: 'Aquamarine', short: 20 },
			{ item: 'Large Net', short: 70 }
		];

		const res = generateRequestList(raw, { canMailLookup });
		expect(res.mailableItems).toEqual([
			{ item: 'Large Net', qty: 120 },
			{ item: 'Aquamarine', qty: 20 }
		]);
	});

	it('returns empty result when no mailable items are needed', () => {
		const raw = [
			{ item: 'Iron', short: 400 },
			{ item: 'Glass Bottle', short: 60 }
		];

		const res = generateRequestList(raw, { canMailLookup });
		expect(res.chunks).toEqual([]);
		expect(res.allText).toBe('');
		expect(res.mailableItems).toEqual([]);
		expect(res.excludedUnmailable).toHaveLength(2);
	});
});
