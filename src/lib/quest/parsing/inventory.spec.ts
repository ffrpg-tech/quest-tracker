import { describe, it, expect } from 'vitest';
import { InventoryParseError, parseInventoryPaste, toInventoryEntries, replaceInventory } from './inventory';

const ANCHOR_LINE = 'Currently, you cannot have more than 999 of most items.';

function wrap(block: string): string {
	return `Some chat log cruft\nMore nav menu junk\n${ANCHOR_LINE}\n${block}\nInventory Stats\nFooter junk`;
}

describe('parseInventoryPaste', () => {
	it('parses multiple categories and items with descriptions', () => {
		const text = wrap(
			[
				'Meals chevron_down',
				'Acorn Pie',
				'A tasty pie made of acorns.',
				'5',
				'Items chevron_down',
				'Amethyst',
				'A shiny purple gem.',
				'Found while mining.',
				'908'
			].join('\n')
		);

		const parsed = parseInventoryPaste(text);
		expect(parsed).toEqual([
			{ itemName: 'Acorn Pie', quantity: 5, category: 'Meals', maxed: false },
			{ itemName: 'Amethyst', quantity: 908, category: 'Items', maxed: false }
		]);
	});

	it('detects stacked status flags before the quantity line', () => {
		const text = wrap(
			['Items chevron_down', 'Iron', 'A sturdy metal.', 'MAX ON HAND', '966'].join('\n')
		);

		const parsed = parseInventoryPaste(text);
		expect(parsed).toEqual([{ itemName: 'Iron', quantity: 966, category: 'Items', maxed: true }]);
	});

	it('does not treat Mastered/Grand Mastered as a storage-cap flag', () => {
		// Mastered/Grand Mastered indicate crafting mastery, a separate game
		// mechanic from being at the storage cap — only "MAX ON HAND" should
		// ever set `maxed`.
		const text = wrap(
			[
				'Tools chevron_down',
				'Hoe',
				'Grand Mastered',
				'10',
				'Tools chevron_down',
				'Axe',
				'Mastered',
				'3'
			].join('\n')
		);

		const parsed = parseInventoryPaste(text);
		expect(parsed).toEqual([
			{ itemName: 'Hoe', quantity: 10, category: 'Tools', maxed: false },
			{ itemName: 'Axe', quantity: 3, category: 'Tools', maxed: false }
		]);
	});

	it('still detects MAX ON HAND stacked alongside a Grand Mastered line', () => {
		const text = wrap(
			['Tools chevron_down', 'Board', 'Grand Mastered', 'MAX ON HAND', '1,002'].join('\n')
		);

		const parsed = parseInventoryPaste(text);
		expect(parsed).toEqual([{ itemName: 'Board', quantity: 1002, category: 'Tools', maxed: true }]);
	});

	it('leaves category undefined for an item before any category header', () => {
		const text = wrap(['Wood', '42'].join('\n'));

		const parsed = parseInventoryPaste(text);
		expect(parsed).toEqual([{ itemName: 'Wood', quantity: 42, category: undefined, maxed: false }]);
	});

	it('discards a "Use a/an <item>" active-boost banner instead of parsing it as an item', () => {
		// Real paste shape for an unused single-use consumable (e.g. a
		// Heart-shaped Gem): no bare item-name line at all, just a "Use a/an"
		// prompt, an effect line, and a "will be consumed!" warning before the
		// trailing quantity. In an actual paste, "Sort Options" is always
		// immediately followed by the first category's "chevron_down" header
		// (confirmed against a real paste excerpt), so the banner lands right
		// after that header as if it were the category's first item, not
		// folded into unrelated preamble text. The game's own footer count
		// excludes this banner, so it must be discarded rather than mis-parsed
		// as a bogus item (which previously inflated the parsed count past the
		// footer's stated total and broke the cross-check).
		const text = wrap(
			[
				'Sort Options:',
				'Item Name, Quantity (ASC), Quantity (DESC)',
				'Meals chevron_down',
				'',
				'Use a Heart-shaped Gem',
				'Increases Inventory Cap by +50',
				'Heart-shaped Gem will be consumed!',
				'1',
				'',
				'Bone Broth',
				'Useful to cook other things',
				'10,033'
			].join('\n')
		).replace('Inventory Stats\nFooter junk', 'Inventory Stats\nYour inventory contains 1 unique items.');

		const parsed = parseInventoryPaste(text);
		expect(parsed).toEqual([
			{ itemName: 'Bone Broth', quantity: 10033, category: 'Meals', maxed: false }
		]);
	});

	it('throws when the anchor text is missing', () => {
		expect(() => parseInventoryPaste('nothing relevant here')).toThrow(InventoryParseError);
	});

	it('throws when the end marker is missing', () => {
		const text = `${ANCHOR_LINE}\nItems chevron_down\nWood\n42`;
		expect(() => parseInventoryPaste(text)).toThrow(InventoryParseError);
	});

	it('throws on a quantity line with no preceding item name', () => {
		const text = wrap(['Items chevron_down', '42'].join('\n'));
		expect(() => parseInventoryPaste(text)).toThrow(InventoryParseError);
	});

	it('throws when no items are found between the markers', () => {
		const text = wrap('Items chevron_down');
		expect(() => parseInventoryPaste(text)).toThrow(InventoryParseError);
	});

	it('parses a real-world paste with comma-formatted quantities and an uppercase end marker', () => {
		// Trimmed excerpt of an actual FarmRPG inventory-page copy/paste: chat
		// log cruft before the anchor, "Sort Options" cruft right after it,
		// thousands-separated quantities once an item crosses 999 (previously
		// silently unmatched by a bare-digit-only regex), and the real page's
		// "INVENTORY STATS" footer, which renders in a different case than the
		// "Currently, you cannot have more than" anchor line. The footer's
		// stated count is adjusted to 4 (rather than the real page's actual
		// total) since this excerpt only keeps 4 of the real items — see the
		// count-cross-check tests below for the untrimmed invariant.
		const text = `HELP
GLOBAL
Say something...
05:24:34 AM

SomePlayer

who want free tomatos
05:24:33 AM

Currently, you cannot have more than 1,002 of any single thing. You can increase this at the Farm Supply.

Sort Options:
Item Name, Quantity (ASC), Quantity (DESC)
Meals chevron_down

Acorn Pie
Trackers discovered to their dismay how
much certain wildlife loved this
treat from southern T'rah
5
Items chevron_down

3-leaf Clover
A delicious snack if you have hooves for feet
MAX ON HAND
1,002

Board
The foundation of any good farm
MAX ON HAND
Grand Mastered
1,002
Fish & Bait chevron_down

Barracuda
Not a good pet
Grand Mastered
235
INVENTORY STATS
Your inventory contains 4 unique items and 155,705 items in total.

Navigation
  Home`;

		const parsed = parseInventoryPaste(text);
		expect(parsed).toEqual([
			{ itemName: 'Acorn Pie', quantity: 5, category: 'Meals', maxed: false },
			{ itemName: '3-leaf Clover', quantity: 1002, category: 'Items', maxed: true },
			{ itemName: 'Board', quantity: 1002, category: 'Items', maxed: true },
			{ itemName: 'Barracuda', quantity: 235, category: 'Fish & Bait', maxed: false }
		]);
	});

	it('flags an item as maxed even when the game renders "MAX ON HAND" in a different case', () => {
		const text = wrap(['Items chevron_down', 'Iron', 'A sturdy metal.', 'max on hand', '966'].join('\n'));

		const parsed = parseInventoryPaste(text);
		expect(parsed).toEqual([{ itemName: 'Iron', quantity: 966, category: 'Items', maxed: true }]);
	});

	it('throws when the parsed item count does not match the "Inventory Stats" footer count', () => {
		// Simulates a virtualized/lazy-loaded list, a collapsed category, or
		// any other silent-truncation failure mode — the page's own footer
		// count is authoritative and a mismatch should fail loudly rather than
		// return a plausible-looking but incomplete result.
		const text = wrap(
			['Items chevron_down', 'Wood', '42'].join('\n')
		).replace('Inventory Stats\nFooter junk', 'Inventory Stats\nYour inventory contains 515 unique items.');

		expect(() => parseInventoryPaste(text)).toThrow(InventoryParseError);
	});

	it('resolves to the real anchor even when a live chat message contains anchor-like text first', () => {
		// FarmRPG's chat is public and always rendered above the page content
		// in a full-page paste — a player could plausibly type something
		// matching the anchor phrase before the real inventory block appears.
		const text = `HELP
GLOBAL
SomePlayer

lol did you know currently, you cannot have more than 999 of most items? wild
05:24:34 AM

${ANCHOR_LINE}
Items chevron_down

Wood
42
Inventory Stats
Your inventory contains 1 unique items.`;

		const parsed = parseInventoryPaste(text);
		expect(parsed).toEqual([{ itemName: 'Wood', quantity: 42, category: 'Items', maxed: false }]);
	});

	it('falls back to an earlier valid anchor when the last occurrence is a false chat match', () => {
		// Not every chat collision lands before the real content — this proves
		// the fix doesn't just assume "chat is always first". Here the *real*
		// anchor comes first, and a later chat message (after the real block)
		// happens to contain anchor-like text with no valid inventory structure
		// following it. Picking the last occurrence blindly would fail to find
		// an end marker and throw, even though a perfectly good paste exists
		// earlier in the same text.
		const text = `${ANCHOR_LINE}
Items chevron_down

Wood
42
Inventory Stats
Your inventory contains 1 unique items.

SomePlayer
haha currently, you cannot have more than 5 friends lol
05:24:34 AM`;

		const parsed = parseInventoryPaste(text);
		expect(parsed).toEqual([{ itemName: 'Wood', quantity: 42, category: 'Items', maxed: false }]);
	});
});

describe('toInventoryEntries', () => {
	const knownItemNames = new Set(['Wood', 'Iron']);

	it('maps parsed lines to InventoryEntry, defaulting maxed to false', () => {
		const map = toInventoryEntries(
			[
				{ itemName: 'Wood', quantity: 42, category: 'Items' },
				{ itemName: 'Iron', quantity: 5, category: 'Items', maxed: true }
			],
			knownItemNames
		);

		expect(map.get('Wood')).toEqual({ item: 'Wood', qty: 42, maxed: false });
		expect(map.get('Iron')).toEqual({ item: 'Iron', qty: 5, maxed: true });
	});

	it('drops lines for items not in knownItemNames', () => {
		const map = toInventoryEntries(
			[
				{ itemName: 'Wood', quantity: 42, category: 'Items' },
				{ itemName: 'Mystery Widget', quantity: 1, category: 'Items' }
			],
			knownItemNames
		);

		expect(map.has('Wood')).toBe(true);
		expect(map.has('Mystery Widget')).toBe(false);
	});
});

describe('replaceInventory', () => {
	it('zeroes out previously-tracked items absent from the new paste instead of keeping their stale qty', () => {
		// Regression: FarmRPG's inventory page omits items the player has zero
		// of, so a re-paste that no longer mentions "Purple Dye" means its true
		// qty is now 0 — not "unknown, keep the old 113." The row stays visible
		// at 0 rather than disappearing, so the player can see it dropped out.
		const current = [{ item: 'Purple Dye', qty: 113, maxed: false }];
		const parsed = new Map([['Wood', { item: 'Wood', qty: 42, maxed: false }]]);

		const result = replaceInventory(current, parsed);

		expect(result).toEqual([
			{ item: 'Purple Dye', qty: 0, maxed: false },
			{ item: 'Wood', qty: 42, maxed: false }
		]);
	});

	it('clears a stale maxed flag on an item that zeroed out', () => {
		const current = [{ item: 'Purple Dye', qty: 113, maxed: true }];

		const result = replaceInventory(current, new Map());

		expect(result).toEqual([{ item: 'Purple Dye', qty: 0, maxed: false }]);
	});

	it('adds newly-appearing items and sorts the result alphabetically', () => {
		const current = [{ item: 'Zinc', qty: 1, maxed: false }];
		const parsed = new Map([
			['Wood', { item: 'Wood', qty: 42, maxed: false }],
			['Iron', { item: 'Iron', qty: 5, maxed: false }]
		]);

		const result = replaceInventory(current, parsed);

		expect(result.map((e) => e.item)).toEqual(['Iron', 'Wood', 'Zinc']);
	});
});
