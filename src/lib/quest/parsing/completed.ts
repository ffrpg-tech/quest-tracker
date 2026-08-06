import { parseCommaNumber, parseFromAnchor, toTrimmedLines } from './pasteParsing';

// Client-side only — parses a manual select-all + copy of the FarmRPG
// "Help Needed" / Completed screen. This has no relationship to the offline
// GraphQL fetch script under /api or to the inventory-paste parser; it only
// extracts quest names from a completed-requests dump.

export class CompletedQuestParseError extends Error {}

const ANCHOR = 'Completed Requests';
const REQUEST_FROM_PREFIX = 'Request from';
const CHECK_LINE = 'check';

/**
 * A quest title normally occupies one line, but long titles wrap onto a
 * second physical line in the copied text (e.g. "Make Life Take" / "The
 * Lemons Back!"). The "Request from ..." line is a reliable anchor right
 * after the title in every entry, so fold every line before it into the name
 * instead of assuming the title is always exactly one line.
 *
 * Some in-game requesters have no name at all (e.g. "Curious Postal Note"),
 * so the anchor line can be the bare word "Request from" with nothing after
 * it — matched without a trailing space so that case isn't missed.
 *
 * A chunk with no "Request from ..." line at all isn't a completed-quest
 * entry — trailing nav/footer text (or, coincidentally, a chat message)
 * swept in alongside the real entries would otherwise get misread as a
 * bogus extra quest name.
 */
function extractQuestName(chunkLines: string[]): string {
	const nameLines: string[] = [];
	for (const line of chunkLines) {
		if (line.startsWith(REQUEST_FROM_PREFIX)) return nameLines.join(' ').trim();
		nameLines.push(line);
	}
	return '';
}

/**
 * Extracts completed quest names from a raw copy-paste of the FarmRPG
 * "Help Needed" screen. The page lists in-progress requests (Special/Active
 * Requests) before the "Completed Requests (N)" heading — anchoring on that
 * heading is what keeps not-yet-completed quests from being misread as done.
 *
 * After the anchor, each completed entry is several lines (name, requester,
 * completion date, global completion stats, a trailing "check" line) — only
 * the lines before "Request from ..." (the quest name) are used; everything
 * else is discarded.
 */
export function parseCompletedQuestNames(rawText: string): string[] {
	return parseFromAnchor(
		rawText,
		ANCHOR,
		parseCompletedBlock,
		() =>
			new CompletedQuestParseError(
				'Could not find the "Completed Requests" section in the pasted content — make sure you copied the full Help Needed / Completed screen.'
			)
	);
}

/**
 * Parses a single candidate occurrence of the anchor. Thrown errors here are
 * also the signal `parseFromAnchor` uses to reject a false anchor match
 * (e.g. a live chat message that happened to contain "Completed Requests")
 * and fall back to an earlier occurrence in the pasted text.
 */
function parseCompletedBlock(afterAnchor: string): string[] {
	const anchorLineEnd = afterAnchor.indexOf('\n');
	const anchorLine = anchorLineEnd === -1 ? afterAnchor : afterAnchor.slice(0, anchorLineEnd);
	const block = anchorLineEnd === -1 ? '' : afterAnchor.slice(anchorLineEnd + 1);

	// Entries are only reliably delimited by their trailing "check" line —
	// some paste sources (e.g. certain browser/extension combinations) don't
	// preserve the blank line between entries that the game's own rendering
	// has, so splitting on blank lines silently collapsed the whole block
	// into one unparseable chunk for those pastes. "check" is a UI element
	// present after every single entry, blank-line or not.
	const lines = toTrimmedLines(block);

	const chunks: string[][] = [];
	let current: string[] = [];
	for (const line of lines) {
		if (line.toLowerCase() === CHECK_LINE) {
			if (current.length > 0) chunks.push(current);
			current = [];
		} else {
			current.push(line);
		}
	}

	const names = chunks.map(extractQuestName).filter((name) => name.length > 0);

	if (names.length === 0) {
		throw new CompletedQuestParseError(
			'No completed quest names were found after the "Completed Requests" heading — check the paste format.'
		);
	}

	// The heading itself states an authoritative count ("Completed Requests
	// (603)") — cross-checking against it catches silent truncation (e.g. a
	// virtualized/lazy-loaded list that wasn't fully scrolled into view)
	// that would otherwise produce a plausible-looking but incomplete result
	// with no thrown error.
	const countMatch = /\(([\d,]+)\)/.exec(anchorLine);
	if (countMatch) {
		const expectedCount = parseCommaNumber(countMatch[1]);
		if (expectedCount !== names.length) {
			throw new CompletedQuestParseError(
				`Parsed ${names.length} completed quests, but the page reported ${expectedCount} — the paste may be truncated (e.g. a partially-scrolled list). Try re-copying the full page.`
			);
		}
	}

	return names;
}
