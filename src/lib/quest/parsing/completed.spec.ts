import { describe, it, expect } from 'vitest';
import { CompletedQuestParseError, parseCompletedQuestNames } from './completed';

describe('parseCompletedQuestNames', () => {
	it('extracts quest names from blank-line-separated completed entries', () => {
		const text = `Completed Requests (3)

A Towering Investment X
Request from Cecil -  Main Quest
Completed on 2026-07-15 05:10:55
30,203 players (2.62%) have completed
check

Thomas's Summer Shark Research II
Request from Thomas
Completed on 2026-07-14 22:03:26
6,565 players (0.57%) have completed
check

The Collector - Shinefish
Request from Cecil
Completed on 2026-07-08 07:59:40
42,708 players (3.7%) have completed
check`;

		expect(parseCompletedQuestNames(text)).toEqual([
			'A Towering Investment X',
			"Thomas's Summer Shark Research II",
			'The Collector - Shinefish'
		]);
	});

	it('parses entries with no blank line between them and per-line leading whitespace', () => {
		// Real-world case: some browser/extension combinations copy the page's
		// list markup without the blank line between entries the game's own
		// rendering has, and with every line but the first indented — "check"
		// is the only delimiter that reliably survives that shape.
		const text = `Completed Requests (2)

    A Towering Investment X
    Request from Cecil -  Main Quest
    Completed on 2026-07-15 05:10:55
    30,203 players (2.62%) have completed
    check
    Thomas's Summer Shark Research II
    Request from Thomas
    Completed on 2026-07-14 22:03:26
    6,565 players (0.57%) have completed
    check`;

		expect(parseCompletedQuestNames(text)).toEqual([
			'A Towering Investment X',
			"Thomas's Summer Shark Research II"
		]);
	});

	// The two tests above cover the extremes of what a browser's DOM-to-text
	// copy can vary on: blank line between entries (yes/no) and per-line
	// indentation (none/present). These two round out the matrix — every
	// paste shape we know a browser can produce reduces to one of these four
	// combinations, and all four must parse identically.
	it('parses entries that are both blank-line-separated and indented', () => {
		const text = `Completed Requests (2)

    A Towering Investment X
    Request from Cecil -  Main Quest
    Completed on 2026-07-15 05:10:55
    30,203 players (2.62%) have completed
    check

    Thomas's Summer Shark Research II
    Request from Thomas
    Completed on 2026-07-14 22:03:26
    6,565 players (0.57%) have completed
    check`;

		expect(parseCompletedQuestNames(text)).toEqual([
			'A Towering Investment X',
			"Thomas's Summer Shark Research II"
		]);
	});

	it('parses entries with no blank line between them and no indentation', () => {
		const text = `Completed Requests (2)

A Towering Investment X
Request from Cecil -  Main Quest
Completed on 2026-07-15 05:10:55
30,203 players (2.62%) have completed
check
Thomas's Summer Shark Research II
Request from Thomas
Completed on 2026-07-14 22:03:26
6,565 players (0.57%) have completed
check`;

		expect(parseCompletedQuestNames(text)).toEqual([
			'A Towering Investment X',
			"Thomas's Summer Shark Research II"
		]);
	});

	it('ignores quest-like names that appear before the "Completed Requests" anchor (e.g. Active/Special Requests)', () => {
		const text = `Active Requests (1)

A Towering Investment XI
Request from Cecil -  Main Quest
28.59%

Completed Requests (1)

A Towering Investment X
Request from Cecil -  Main Quest
Completed on 2026-07-15 05:10:55
30,203 players (2.62%) have completed
check`;

		expect(parseCompletedQuestNames(text)).toEqual(['A Towering Investment X']);
	});

	it('rejoins a title that wraps across two physical lines, using "Request from" as the boundary', () => {
		// Real-world case: "Make Life Take The Lemons Back!" wraps across two
		// physical lines in the copied text. Every line before "Request from"
		// belongs to the name.
		const text = `Completed Requests (1)

Make Life Take
The Lemons Back!
Request from Star Meerif
Completed on 2026-06-14 01:25:16
77,708 players (6.73%) have completed
check`;

		expect(parseCompletedQuestNames(text)).toEqual(['Make Life Take The Lemons Back!']);
	});

	it('rejoins a wrapped title that itself contains a comma before "Request from"', () => {
		const text = `Completed Requests (1)

You Spin Me Right Round,
Buddy, Right Round
Request from Buddy
Completed on 2026-06-13 01:02:07
70,419 players (6.1%) have completed
check`;

		expect(parseCompletedQuestNames(text)).toEqual(['You Spin Me Right Round, Buddy, Right Round']);
	});

	it('parses an entry whose requester has no name (bare "Request from" line)', () => {
		// Real-world case: "Curious Postal Note" quests are requested by no one
		// in particular — the line is literally "Request from" with nothing
		// after it, not "Request from <name>".
		const text = `Completed Requests (2)

Curious Postal Note II
Request from
Completed on 2025-10-22 01:34:44
34,742 players (3%) have completed
check

Curious Postal Note I
Request from
Completed on 2025-10-22 01:34:38
35,311 players (3.04%) have completed
check`;

		expect(parseCompletedQuestNames(text)).toEqual(['Curious Postal Note II', 'Curious Postal Note I']);
	});

	it('throws when the "Completed Requests" anchor is missing', () => {
		expect(() => parseCompletedQuestNames('nothing relevant here')).toThrow(CompletedQuestParseError);
	});

	it('throws when no entries follow the anchor', () => {
		expect(() => parseCompletedQuestNames('Completed Requests (0)\n\n')).toThrow(
			CompletedQuestParseError
		);
	});

	it('ignores a "Personal Requests" section appearing before the anchor', () => {
		// Real-world page shape: Personal Requests (PHR-funded, single-player
		// requests) get their own "Request from ..." chunk structure and sit
		// just above "Completed Requests" — the anchor-based slice must still
		// skip past it like it does for Active/Special Requests.
		const text = `Personal Requests (1)

Helping Hand
Request from Cecil
60.58%

Completed Requests (1)

A Towering Investment X
Request from Cecil -  Main Quest
Completed on 2026-07-15 05:10:55
30,203 players (2.62%) have completed
check`;

		expect(parseCompletedQuestNames(text)).toEqual(['A Towering Investment X']);
	});

	it('preserves a curly apostrophe in a quest title (no straight-quote normalization)', () => {
		// static/questlines.json stores quest names with the same typographic
		// apostrophe (U+2019) the game itself renders — normalizing to a
		// straight quote here would silently break matching against it.
		const text = `Completed Requests (1)

The Rocket’s Red Glare VII
Request from Beatrix
Completed on 2026-07-16 18:53:49
34,932 players (3.02%) have completed
check`;

		expect(parseCompletedQuestNames(text)).toEqual(['The Rocket’s Red Glare VII']);
	});

	it('throws when the parsed quest count does not match the anchor\'s stated count', () => {
		const text = `Completed Requests (2)

A Towering Investment X
Request from Cecil -  Main Quest
Completed on 2026-07-15 05:10:55
30,203 players (2.62%) have completed
check`;

		expect(() => parseCompletedQuestNames(text)).toThrow(CompletedQuestParseError);
	});

	it('resolves to the real anchor even when a live chat message contains anchor-like text first', () => {
		const text = `SomePlayer
have you checked your completed requests today?
05:24:34 AM

Completed Requests (1)

A Towering Investment X
Request from Cecil -  Main Quest
Completed on 2026-07-15 05:10:55
30,203 players (2.62%) have completed
check`;

		expect(parseCompletedQuestNames(text)).toEqual(['A Towering Investment X']);
	});

	it('falls back to an earlier valid anchor when the last occurrence is a false chat match', () => {
		// The real anchor comes first here, and a later chat message (after the
		// real block) happens to contain anchor-like text with no valid entries
		// following it. Picking the last occurrence blindly would fail (no
		// completed-quest chunks after it) and throw, even though a good paste
		// exists earlier in the same text.
		const text = `Completed Requests (1)

A Towering Investment X
Request from Cecil -  Main Quest
Completed on 2026-07-15 05:10:55
30,203 players (2.62%) have completed
check

SomePlayer said something about completed requests`;

		expect(parseCompletedQuestNames(text)).toEqual(['A Towering Investment X']);
	});
});
