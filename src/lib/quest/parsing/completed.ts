import { parseCommaNumber, parseFromAnchor } from './pasteParsing';

// Client-side only — parses a manual select-all + copy of the FarmRPG
// "Help Needed" / Completed screen. This has no relationship to the offline
// GraphQL fetch script under /api or to the inventory-paste parser; it only
// extracts quest names from a completed-requests dump.

export class CompletedQuestParseError extends Error {}

const ANCHOR = 'Completed Requests';
const REQUEST_FROM_PREFIX = 'Request from';

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
 * entry — the page has no explicit end marker for this section, so trailing
 * nav/footer text (or, coincidentally, a chat message) after the last real
 * entry would otherwise get swept in as a blank-line-separated "chunk" and
 * misread as a bogus extra quest name.
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
 * After the anchor, each completed entry is a blank-line-separated chunk of
 * several lines (name, requester, completion date, global completion stats,
 * a trailing "check" line) — only the lines before "Request from ..." (the
 * quest name) are used; everything else in the chunk is discarded.
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

	const chunks = block
		.split(/\r?\n\s*\r?\n/)
		.map((c) => c.trim())
		.filter((c) => c.length > 0);

	const names = chunks
		.map((chunk) => extractQuestName(chunk.split(/\r?\n/)))
		.filter((name) => name.length > 0);

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
