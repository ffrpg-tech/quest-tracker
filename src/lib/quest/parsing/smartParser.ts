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
	type: ImportTargetType | 'composite';
	detectedTypes?: ImportTargetType[];
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

	// 4. Inventory Dump: anchor text, "Inventory Stats", or category headers + quantity lines
	if (
		lower.includes('currently, you cannot have more than') ||
		lower.includes('inventory stats') ||
		lower.includes('chevron_down') ||
		lower.includes('max on hand')
	) {
		return { type: 'inventory', confidence: 'high' };
	}

	// 5. Player Stats: "Tower Level" or profile skill names with "Level \d+" / "Not Started"
	const skillKeywords = ['farming', 'fishing', 'crafting', 'exploring', 'cooking'];
	const matchedSkills = skillKeywords.filter((sk) => {
		const reg = new RegExp(`(?:^|\\n)\\s*${sk}\\s*(?:\\n|$)`, 'i');
		return reg.test(trimmed);
	});
	if (
		lower.includes('tower level') ||
		lower.includes('the tower') ||
		(matchedSkills.length >= 2 &&
			(/level\s+\d+/i.test(trimmed) ||
				/not started/i.test(trimmed) ||
				/now in beta/i.test(trimmed)))
	) {
		return { type: 'stats', confidence: 'high' };
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
		/Currently,\s*you\s*cannot\s*have\s*more\s*than\s*([\d,]+)\s*of\s*(?:most\s*items|any\s*single\s*thing)/i.exec(
			rawText
		);
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
 * Dispatches raw text to the appropriate parser(s).
 * In 'auto' mode, detects and extracts all valid entities present in the paste,
 * safely handling stacked SPA views (e.g. Home skills + My Inventory dump).
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

	const lower = trimmed.toLowerCase();

	if (mode === 'auto') {
		const miningLocations = [
			'spring cave',
			'highland hollow',
			'sol grotto',
			'ember caverns',
			"fenrir's den",
			'mossrock mine'
		];
		const matchedMiningLocations = miningLocations.filter((loc) => lower.includes(loc));
		const requestFromMatches = trimmed.match(/request from/gi);

		const skillKeywords = ['farming', 'fishing', 'crafting', 'exploring', 'cooking', 'mining'];
		const matchedSkills = skillKeywords.filter((sk) => {
			const reg = new RegExp(`(?:^|\\n)\\s*${sk}\\s*(?:\\n|$)`, 'i');
			return reg.test(trimmed);
		});

		let parsedInventory: SmartParseSuccess['inventory'] | undefined;
		let parsedStats: PlayerStats | undefined;
		let parsedMining: Record<string, number> | undefined;
		let parsedBank: SmartParseSuccess['bank'] | undefined;
		let parsedCompleted: string[] | undefined;

		// 1. Inventory candidate check
		if (
			lower.includes('currently, you cannot have more than') ||
			lower.includes('inventory stats') ||
			lower.includes('chevron_down') ||
			lower.includes('max on hand')
		) {
			try {
				const rawLines = parseInventoryPaste(rawText);
				if (rawLines.length > 0) {
					const maxCapacityDetected = extractMaxCapacityFromText(rawText) ?? undefined;
					const entries = options.knownItemNames
						? toInventoryEntries(rawLines, options.knownItemNames)
						: undefined;
					parsedInventory = { rawLines, entries, maxCapacityDetected };
				}
			} catch {
				// Not a valid inventory block
			}
		}

		// 2. Player Stats candidate check
		if (
			lower.includes('tower level') ||
			lower.includes('the tower') ||
			lower.includes('my skills') ||
			(matchedSkills.length >= 2 &&
				(/level\s+\d+/i.test(trimmed) ||
					/not started/i.test(trimmed) ||
					/now in beta/i.test(trimmed)))
		) {
			try {
				const stats =
					options.npcNames && options.npcNames.length > 0
						? parsePlayerStatsPaste(rawText, options.npcNames)
						: parsePlayerStatsPaste(rawText);
				const hasSkills = Object.values(stats).some((v) => typeof v === 'number' && v > 0);
				const hasNpcs = Object.keys(stats.npcLevels).length > 0;
				if (hasSkills || hasNpcs) {
					parsedStats = stats;
				}
			} catch {
				// Not a valid stats block
			}
		}

		// 3. Mining Floors candidate check
		if (
			lower.includes('mining locations') ||
			(matchedMiningLocations.length >= 2 && /floor\s+\d+/i.test(trimmed))
		) {
			try {
				const floors = parseMiningPagePaste(rawText);
				if (Object.keys(floors).length > 0) {
					parsedMining = floors;
				}
			} catch {
				// Not a valid mining block
			}
		}

		// 4. Bank candidate check
		if (
			lower.includes('bulk options') ||
			(lower.includes('deposit all') &&
				lower.includes('withdraw all') &&
				lower.includes('silver'))
		) {
			try {
				const b = parseBankPaste(rawText);
				parsedBank = b;
			} catch {
				// Not a valid bank block
			}
		}

		// 5. Completed Quests candidate check
		if (
			lower.includes('completed requests') ||
			(requestFromMatches && requestFromMatches.length >= 2)
		) {
			try {
				const q = parseCompletedQuestNames(rawText);
				if (q.length > 0) {
					parsedCompleted = q;
				}
			} catch {
				// Not a valid completed quests block
			}
		}

		const detectedTypes: ImportTargetType[] = [];
		const summaryParts: string[] = [];

		if (parsedInventory) {
			detectedTypes.push('inventory');
			const count = parsedInventory.entries
				? parsedInventory.entries.size
				: parsedInventory.rawLines.length;
			const capStr = parsedInventory.maxCapacityDetected
				? ` (max cap: ${parsedInventory.maxCapacityDetected.toLocaleString()})`
				: '';
			summaryParts.push(`${count} inventory item${count === 1 ? '' : 's'}${capStr}`);
		}

		if (parsedStats) {
			detectedTypes.push('stats');
			const npcCount = Object.keys(parsedStats.npcLevels).length;
			const npcPart = npcCount > 0 ? `, ${npcCount} NPC${npcCount === 1 ? '' : 's'}` : '';
			summaryParts.push(`7 player skills${npcPart}`);
		}

		if (parsedMining) {
			detectedTypes.push('mining');
			const count = Object.values(parsedMining).filter((v) => v > 0).length;
			summaryParts.push(`${count} mining floor${count === 1 ? '' : 's'}`);
		}

		if (parsedBank) {
			detectedTypes.push('bank');
			summaryParts.push(`Bank silver`);
		}

		if (parsedCompleted) {
			detectedTypes.push('completed');
			summaryParts.push(
				`${parsedCompleted.length} completed quest${parsedCompleted.length === 1 ? '' : 's'}`
			);
		}

		if (detectedTypes.length > 0) {
			return {
				ok: true,
				type: detectedTypes.length > 1 ? 'composite' : detectedTypes[0],
				detectedTypes,
				confidence: 'high',
				summary: `Parsed ${summaryParts.join(' and ')}.`,
				inventory: parsedInventory,
				playerStats: parsedStats,
				miningFloors: parsedMining,
				bank: parsedBank,
				completedQuestNames: parsedCompleted
			};
		}
	}

	// Single-mode parser fallback (explicit mode or fallback detection)
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
					detectedTypes: ['bank'],
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
					detectedTypes: ['mining'],
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
					detectedTypes: ['stats'],
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
					detectedTypes: ['completed'],
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
					detectedTypes: ['inventory'],
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
