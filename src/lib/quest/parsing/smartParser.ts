import type { InventoryEntry, PlayerStats } from '../types';
import {
	parseInventoryPaste,
	toInventoryEntries,
	InventoryParseError,
	type ParsedInventoryLine
} from './inventory';
import { parsePlayerStatsPaste, StatsParseError } from './stats';
import { parseMiningPagePaste, MiningParseError } from './mining';
import { parseBankPaste, BankParseError } from './bank';
import { parseCompletedQuestNames, CompletedQuestParseError } from './completed';
import { parseCommaNumber } from './pasteParsing';

export type ImportTargetType = 'inventory' | 'stats' | 'mining' | 'bank' | 'completed';
export type ImportMode = 'auto' | ImportTargetType;

export interface SmartParseSuccess {
	ok: true;
	type: ImportTargetType;
	confidence: 'high' | 'medium' | 'low';
	summary: string;
	inventory?: {
		rawLines: ParsedInventoryLine[];
		entries?: Map<string, InventoryEntry>;
		maxCapacityDetected?: number;
	};
	playerStats?: PlayerStats;
	miningFloors?: Record<string, number>;
	bank?: {
		walletSilver: number;
		bankSilver: number;
	};
	completedQuestNames?: string[];
}

export interface SmartParseFailure {
	ok: false;
	detectedType: ImportTargetType | 'unknown';
	error: string;
}

export type SmartParseResult = SmartParseSuccess | SmartParseFailure;

/**
 * Heuristically inspects raw text to detect which game screen it was copied from.
 */
export function detectInputType(rawText: string): {
	type: ImportTargetType | 'unknown';
	confidence: 'high' | 'medium' | 'low';
} {
	const trimmed = rawText.trim();
	if (!trimmed) {
		return { type: 'unknown', confidence: 'low' };
	}

	const lower = trimmed.toLowerCase();

	// 1. Bank check: distinct bulk options or deposit/withdraw all keywords
	if (
		lower.includes('bulk options') ||
		(lower.includes('deposit all') && lower.includes('withdraw all'))
	) {
		return { type: 'bank', confidence: 'high' };
	}

	// 2. Mining Floors: explicit header or presence of mining location names + "floor"
	if (lower.includes('mining locations')) {
		return { type: 'mining', confidence: 'high' };
	}
	const miningLocations = [
		'spring cave',
		'highland hollow',
		'sol grotto',
		'ember caverns',
		"fenrir's den",
		'mossrock mine'
	];
	const matchedLocations = miningLocations.filter((loc) => lower.includes(loc));
	if (matchedLocations.length >= 2 && /floor\s+\d+/i.test(trimmed)) {
		return { type: 'mining', confidence: 'high' };
	}

	// 3. Completed Quests: "Completed Requests" anchor or repeated "Request from"
	if (lower.includes('completed requests')) {
		return { type: 'completed', confidence: 'high' };
	}
	const requestFromMatches = trimmed.match(/request from/gi);
	if (requestFromMatches && requestFromMatches.length >= 2) {
		return { type: 'completed', confidence: 'high' };
	}

	// 4. Player Stats: "Tower Level" or profile skill names with "Level \d+" / "Not Started"
	const skillKeywords = ['farming', 'fishing', 'crafting', 'exploring', 'cooking'];
	const matchedSkills = skillKeywords.filter((sk) => {
		const reg = new RegExp(`(?:^|\\n)\\s*${sk}\\s*(?:\\n|$)`, 'i');
		return reg.test(trimmed);
	});
	if (
		lower.includes('tower level') ||
		(matchedSkills.length >= 2 &&
			(/level\s+\d+/i.test(trimmed) ||
				/not started/i.test(trimmed) ||
				/now in beta/i.test(trimmed)))
	) {
		return { type: 'stats', confidence: 'high' };
	}

	// 5. Inventory Dump: anchor text, "Inventory Stats", or category headers + quantity lines
	if (
		lower.includes('currently, you cannot have more than') ||
		lower.includes('inventory stats') ||
		lower.includes('chevron_down') ||
		lower.includes('max on hand')
	) {
		return { type: 'inventory', confidence: 'high' };
	}

	// Secondary heuristics
	if (matchedSkills.length >= 1 && /level\s+\d+/i.test(trimmed)) {
		return { type: 'stats', confidence: 'medium' };
	}
	if (matchedLocations.length >= 1) {
		return { type: 'mining', confidence: 'medium' };
	}
	if (requestFromMatches && requestFromMatches.length === 1) {
		return { type: 'completed', confidence: 'medium' };
	}

	// Check if text looks like inventory rows (word followed by a number line)
	const lines = trimmed
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean);
	const numberLines = lines.filter((l) => /^\d{1,3}(,\d{3})*$/.test(l));
	if (lines.length >= 4 && numberLines.length >= lines.length / 4) {
		return { type: 'inventory', confidence: 'medium' };
	}

	return { type: 'unknown', confidence: 'low' };
}

/**
 * Extracts max capacity from inventory text if the anchor line contains it.
 * E.g., "Currently, you cannot have more than 1,000 of most items."
 */
export function extractMaxCapacityFromText(rawText: string): number | null {
	const match =
		/Currently,\s*you\s*cannot\s*have\s*more\s*than\s*([\d,]+)\s*of\s*most\s*items/i.exec(rawText);
	if (match) {
		const cap = parseCommaNumber(match[1]);
		if (Number.isFinite(cap) && cap > 0) {
			return cap;
		}
	}
	return null;
}

export interface ParseOptions {
	knownItemNames?: Set<string>;
	npcNames?: string[];
}

/**
 * Dispatches raw text to the appropriate parser, either by auto-detecting the schema
 * or by using the user-specified override mode.
 */
export function detectAndParseInput(
	rawText: string,
	mode: ImportMode = 'auto',
	options: ParseOptions = {}
): SmartParseResult {
	const trimmed = rawText.trim();
	if (!trimmed) {
		return {
			ok: false,
			detectedType: 'unknown',
			error: 'Nothing to parse — paste content first.'
		};
	}

	const detection = detectInputType(rawText);
	const targetType: ImportTargetType =
		mode === 'auto' ? (detection.type === 'unknown' ? 'inventory' : detection.type) : mode;

	const confidence = mode === 'auto' ? detection.confidence : 'high';

	try {
		switch (targetType) {
			case 'bank': {
				const bank = parseBankPaste(rawText);
				return {
					ok: true,
					type: 'bank',
					confidence,
					summary: `Parsed Bank: ${bank.walletSilver.toLocaleString()} wallet silver, ${bank.bankSilver.toLocaleString()} bank silver.`,
					bank
				};
			}

			case 'mining': {
				const miningFloors = parseMiningPagePaste(rawText);
				const nonZeroCount = Object.values(miningFloors).filter((v) => v > 0).length;
				return {
					ok: true,
					type: 'mining',
					confidence,
					summary: `Parsed Mining Floors (${nonZeroCount} unlocked location${nonZeroCount === 1 ? '' : 's'}).`,
					miningFloors
				};
			}

			case 'stats': {
				const playerStats =
					options.npcNames && options.npcNames.length > 0
						? parsePlayerStatsPaste(rawText, options.npcNames)
						: parsePlayerStatsPaste(rawText);
				const npcCount = Object.keys(playerStats.npcLevels).length;
				return {
					ok: true,
					type: 'stats',
					confidence,
					summary: `Parsed Player Stats (7 skills, ${npcCount} NPC friendship${npcCount === 1 ? '' : 's'}).`,
					playerStats
				};
			}

			case 'completed': {
				const completedQuestNames = parseCompletedQuestNames(rawText);
				return {
					ok: true,
					type: 'completed',
					confidence,
					summary: `Parsed Completed Quests (${completedQuestNames.length} quest name${completedQuestNames.length === 1 ? '' : 's'}).`,
					completedQuestNames
				};
			}

			case 'inventory':
			default: {
				const rawLines = parseInventoryPaste(rawText);
				const maxCapacityDetected = extractMaxCapacityFromText(rawText) ?? undefined;
				const entries = options.knownItemNames
					? toInventoryEntries(rawLines, options.knownItemNames)
					: undefined;
				const count = entries ? entries.size : rawLines.length;
				const capInfo = maxCapacityDetected
					? ` • Max capacity: ${maxCapacityDetected.toLocaleString()}`
					: '';
				return {
					ok: true,
					type: 'inventory',
					confidence,
					summary: `Parsed ${count} inventory item${count === 1 ? '' : 's'}${capInfo}.`,
					inventory: {
						rawLines,
						entries,
						maxCapacityDetected
					}
				};
			}
		}
	} catch (err) {
		let message = 'Unexpected error parsing paste.';
		if (
			err instanceof InventoryParseError ||
			err instanceof StatsParseError ||
			err instanceof MiningParseError ||
			err instanceof BankParseError ||
			err instanceof CompletedQuestParseError ||
			err instanceof Error
		) {
			message = err.message;
		}

		return {
			ok: false,
			detectedType: targetType,
			error: message
		};
	}
}
