import { getItemCanMail } from '../storage/itemsStore.svelte';

export interface RequestListInputItem {
	item: string;
	short: number;
	craftableQty?: number;
}

export interface RequestListItem {
	item: string;
	qty: number;
}

export interface RequestListOptions {
	/** Farm RPG chat message character limit. Defaults to 250. */
	maxLength?: number;
	/** Whether to subtract craftable quantity from the shortfall. Defaults to false. */
	deductCraftable?: boolean;
	/** Custom mailability checker. Defaults to getItemCanMail. */
	canMailLookup?: (item: string) => boolean | undefined;
}

export interface RequestListChunk {
	text: string;
	length: number;
	items: RequestListItem[];
}

export interface RequestListResult {
	chunks: RequestListChunk[];
	allText: string;
	mailableItems: RequestListItem[];
	excludedUnmailable: RequestListItem[];
}

export const MAX_FARM_RPG_CHAT_LENGTH = 250;
export const CHAT_PREFIX = 'LF ';

/**
 * Builds an in-game chat request list formatted strictly for Farm RPG chat limits:
 * - Filters strictly for mailable items (automatically excluding "CAN'T MAIL" items).
 * - Formats items using the in-game icon bracket syntax: ((Item Name)) xCount.
 * - Compact format: "LF ((Item 1)) xCount, ((Item 2)) xCount, ..."
 * - Chunks lines greedily so each line fits within the 250-character chat limit.
 */
export function generateRequestList(
	rawItems: RequestListInputItem[],
	options: RequestListOptions = {}
): RequestListResult {
	const maxLength = options.maxLength ?? MAX_FARM_RPG_CHAT_LENGTH;
	const deductCraftable = options.deductCraftable ?? false;
	const checkCanMail = options.canMailLookup ?? getItemCanMail;

	// Aggregate quantities across duplicates (e.g. from multiple quests)
	const aggregated = new Map<string, { item: string; short: number; craftableQty?: number }>();
	for (const s of rawItems) {
		const existing = aggregated.get(s.item);
		if (existing) {
			existing.short += s.short;
			if (s.craftableQty !== undefined) {
				existing.craftableQty = (existing.craftableQty ?? 0) + s.craftableQty;
			}
		} else {
			aggregated.set(s.item, {
				item: s.item,
				short: s.short,
				craftableQty: s.craftableQty
			});
		}
	}

	const mailableItems: RequestListItem[] = [];
	const excludedUnmailable: RequestListItem[] = [];

	for (const entry of aggregated.values()) {
		const qty = deductCraftable
			? Math.max(0, entry.short - (entry.craftableQty ?? 0))
			: entry.short;

		if (qty <= 0) continue;

		const canMail = checkCanMail(entry.item);
		if (canMail === true) {
			mailableItems.push({ item: entry.item, qty });
		} else {
			excludedUnmailable.push({ item: entry.item, qty });
		}
	}

	// Sort mailable items by quantity descending, then alphabetically by name
	mailableItems.sort((a, b) => b.qty - a.qty || a.item.localeCompare(b.item));
	excludedUnmailable.sort((a, b) => b.qty - a.qty || a.item.localeCompare(b.item));

	if (mailableItems.length === 0) {
		return {
			chunks: [],
			allText: '',
			mailableItems,
			excludedUnmailable
		};
	}

	const chunks: RequestListChunk[] = [];
	let currentItems: RequestListItem[] = [];
	let currentText = CHAT_PREFIX;

	for (const it of mailableItems) {
		const itemStr = `((${it.item})) x${it.qty}`;
		const separator = currentItems.length === 0 ? '' : ', ';

		if (
			currentItems.length > 0 &&
			currentText.length + separator.length + itemStr.length > maxLength
		) {
			chunks.push({
				text: currentText,
				length: currentText.length,
				items: currentItems
			});
			currentItems = [it];
			currentText = `${CHAT_PREFIX}${itemStr}`;
		} else {
			currentItems.push(it);
			currentText += `${separator}${itemStr}`;
		}
	}

	if (currentItems.length > 0) {
		chunks.push({
			text: currentText,
			length: currentText.length,
			items: currentItems
		});
	}

	const allText = chunks.map((c) => c.text).join('\n');

	return {
		chunks,
		allText,
		mailableItems,
		excludedUnmailable
	};
}
