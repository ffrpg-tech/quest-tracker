import type { InventoryEntry } from '../types';
import { indexOfCaseInsensitive, parseCommaNumber, parseFromAnchor, toTrimmedLines } from './pasteParsing';

// Client-side only — parses a manual select-all + copy of the player's raw
// FarmRPG inventory PAGE text (browser or Steam client's Edit > Select All >
// Copy). This has no relationship to the offline GraphQL fetch script under
// /api: that script produces the quest/questline data this app ships with,
// this parser turns a player's own pasted text into their current inventory.
// Keep them decoupled — this file must never import from or reference /api.

export interface ParsedInventoryLine {
	itemName: string;
	quantity: number;
	category?: string;
	maxed?: boolean;
}

export class InventoryParseError extends Error {}

const ANCHOR = 'Currently, you cannot have more than';
const END_MARKER = 'Inventory Stats';
const CATEGORY_SUFFIX = ' chevron_down';
// Only "MAX ON HAND" signals the storage-cap condition this app cares about.
// "Mastered"/"Grand Mastered" are a separate crafting-mastery indicator with
// no bearing on whether the item is at cap — they're just discarded like any
// other description line, not folded into `maxed`.
const STATUS_FLAGS = ['MAX ON HAND'];
// A single-use "active boost" item (e.g. a cap-increasing gem) renders as a
// promo banner rather than a normal inventory row — no bare item-name line at
// all, just a "Use a/an <name>" prompt, an effect line, and a "<name> will be
// consumed!" warning before the trailing quantity. The game's own "unique
// items" footer count doesn't include this banner, so treating chunkLines[0]
// as a literal item name here (as for a normal row) both produces a bogus
// unmatched item and inflates the parsed count past the footer's stated
// total. Detected by content (a real item's first line is always a bare
// name, never a sentence) rather than by position, so it doesn't matter
// where in the paste this banner appears.
const USE_PROMPT = /^Use (?:a|an) .+$/i;

/**
 * Parses raw copy-pasted inventory page text into structured item lines.
 *
 * Mobile app pastes are explicitly out of scope — best-effort platform
 * detection isn't attempted; malformed/truncated input (including a mobile
 * paste that doesn't match the expected page structure) fails loudly via
 * `InventoryParseError` rather than silently producing a partial/empty
 * result, since a silent guess here would be worse than an obvious error.
 */
export function parseInventoryPaste(rawText: string): ParsedInventoryLine[] {
	return parseFromAnchor(
		rawText,
		ANCHOR,
		parseInventoryBlock,
		() =>
			new InventoryParseError(
				'Could not find the inventory marker text in the pasted content — make sure you copied the full inventory page.'
			)
	);
}

/**
 * Parses a single candidate occurrence of the anchor. Thrown errors here are
 * also the signal `parseFromAnchor` uses to reject a false anchor match
 * (e.g. a live chat message that happened to contain the anchor phrase) and
 * fall back to an earlier occurrence in the pasted text.
 */
function parseInventoryBlock(afterAnchor: string): ParsedInventoryLine[] {
	// Discard everything up to and including the anchor's own line.
	const anchorLineEnd = afterAnchor.indexOf('\n');
	const afterAnchorLine = anchorLineEnd === -1 ? '' : afterAnchor.slice(anchorLineEnd + 1);

	const endIdx = indexOfCaseInsensitive(afterAnchorLine, END_MARKER);
	if (endIdx === -1) {
		throw new InventoryParseError(
			'Could not find the end of the inventory block ("Inventory Stats") — the paste may be truncated.'
		);
	}
	const block = afterAnchorLine.slice(0, endIdx);
	const afterEnd = afterAnchorLine.slice(endIdx);

	const lines = toTrimmedLines(block);

	const results: ParsedInventoryLine[] = [];
	let currentCategory: string | undefined;
	let chunkLines: string[] = [];

	for (const line of lines) {
		if (line.endsWith(CATEGORY_SUFFIX)) {
			currentCategory = line.slice(0, -CATEGORY_SUFFIX.length).trim();
			chunkLines = [];
			continue;
		}

		// Quantities are rendered with thousands separators once they cross
		// 999 (e.g. "1,002"), so the anchor check has to tolerate commas —
		// matching only bare digits silently missed every high-quantity item.
		if (/^\d{1,3}(,\d{3})*$/.test(line)) {
			if (chunkLines.length === 0) {
				throw new InventoryParseError(
					`Found a quantity line ("${line}") with no preceding item name — the paste may be truncated or malformed.`
				);
			}
			// A "Sort Options" preamble line can fold into the same chunk as a
			// promo banner when no category header separates them (there's no
			// other reset point before the first category), so the banner check
			// has to scan the whole chunk rather than assume it's chunkLines[0].
			if (chunkLines.some((l) => USE_PROMPT.test(l))) {
				chunkLines = [];
				continue;
			}
			const itemName = chunkLines[0];
			const maxed = chunkLines.some((l) =>
				STATUS_FLAGS.some((flag) => flag.toLowerCase() === l.toLowerCase())
			);
			results.push({
				itemName,
				quantity: parseCommaNumber(line),
				category: currentCategory,
				maxed
			});
			chunkLines = [];
			continue;
		}

		// Description lines and status-flag lines both accumulate here; only
		// chunkLines[0] (the name) and the STATUS_FLAGS membership check above
		// are ever read back out — everything else is discarded on purpose.
		chunkLines.push(line);
	}

	if (results.length === 0) {
		throw new InventoryParseError(
			'No inventory items were found between the markers — check the paste format.'
		);
	}

	// The page's own "Inventory Stats" footer states an authoritative item
	// count right after the end marker — cross-checking against it catches
	// silent truncation (a collapsed category, a virtualized/lazy-loaded list
	// that wasn't fully scrolled into view, or a mis-parsed line elsewhere)
	// that would otherwise produce a plausible-looking but incomplete result
	// with no thrown error. Optional: an older/different page structure
	// without this line shouldn't block parsing.
	const statsMatch = /contains\s+([\d,]+)\s+unique items/i.exec(afterEnd);
	if (statsMatch) {
		const expectedCount = parseCommaNumber(statsMatch[1]);
		if (expectedCount !== results.length) {
			throw new InventoryParseError(
				`Parsed ${results.length} items, but the page reported ${expectedCount} unique items — the paste may be truncated (e.g. a collapsed category or a partially-scrolled list). Try re-copying the full page.`
			);
		}
	}

	return results;
}

/**
 * Bridges parser output into the existing `InventoryEntry`/`mergeInventory`
 * flow. Lines for items that aren't required by any quest (not in
 * `knownItemNames`) are dropped here rather than in `parseInventoryPaste` —
 * that parser's "Inventory Stats" count cross-check must run against the
 * player's true full paste, not a pre-filtered subset. `knownItemNames` is
 * passed in rather than imported so this stays a pure, synchronously
 * testable function — the caller owns loading the (fetched, async) item
 * catalog.
 */
export function toInventoryEntries(
	parsed: ParsedInventoryLine[],
	knownItemNames: Set<string>
): Map<string, InventoryEntry> {
	const result = new Map<string, InventoryEntry>();
	for (const line of parsed) {
		if (!knownItemNames.has(line.itemName)) continue;
		result.set(line.itemName, {
			item: line.itemName,
			qty: line.quantity,
			maxed: line.maxed ?? false
		});
	}
	return result;
}

export function inventoryToMap(entries: InventoryEntry[]): Map<string, number> {
	const map = new Map<string, number>();
	for (const e of entries) map.set(e.item, e.qty);
	return map;
}

/**
 * Merges a batch of updates into an inventory array: entries with a matching
 * `item` name are replaced, everything else is kept, and the result is
 * re-sorted alphabetically. For a targeted update that shouldn't touch
 * anything else in the inventory (e.g. the Bank tab folding wallet/bank
 * Silver into a single synthetic entry) — NOT for a full inventory-page
 * paste, which must use `replaceInventory` instead so items that dropped to
 * zero (and so no longer appear in the paste at all) don't keep their stale
 * last-known quantity forever.
 */
export function mergeInventory(
	current: InventoryEntry[],
	updates: Map<string, InventoryEntry>
): InventoryEntry[] {
	const merged = new Map(current.map((e) => [e.item, e]));
	for (const [name, entry] of updates) merged.set(name, entry);
	return Array.from(merged.values()).sort((a, b) => a.item.localeCompare(b.item));
}

/**
 * Replaces the entire inventory with a freshly parsed inventory-page paste.
 * A pasted inventory page is a complete snapshot of everything the player
 * owns — FarmRPG simply omits items the player has zero of, so an item
 * missing from `parsed` means its true quantity is now 0, not "unknown, keep
 * the old number." `mergeInventory` would wrongly leave such items at their
 * last pasted quantity indefinitely.
 *
 * Previously-tracked items missing from `parsed` are kept in the result at
 * qty 0 (maxed cleared) rather than dropped, so the player can still see
 * "I used to have this, now I have none" in the inventory table instead of
 * the row silently vanishing. Items that were never tracked before and still
 * aren't in `parsed` obviously don't appear.
 */
export function replaceInventory(
	current: InventoryEntry[],
	parsed: Map<string, InventoryEntry>
): InventoryEntry[] {
	const result = new Map(
		current.map((e) => [e.item, { item: e.item, qty: 0, maxed: false }])
	);
	for (const [name, entry] of parsed) result.set(name, entry);
	return Array.from(result.values()).sort((a, b) => a.item.localeCompare(b.item));
}
