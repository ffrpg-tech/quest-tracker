/**
 * Acronym-based questline search and relevance ranking utility for FarmRPG Quest Tracker.
 * Supports exact community backronyms (e.g. ATI, SASSY, STARMAP, DI, CUBE, HOTM),
 * stop-word omission, query punctuation normalization, and tiered relevance ranking.
 */

const STOP_WORDS = new Set(['for', 'and', 'of', 'the', 'in', 'to', 'a', 'an', '&']);

/** In-memory cache mapping questline title -> array of candidate acronyms. */
const acronymCache = new Map<string, string[]>();

function escapeRegExp(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extracts candidate acronyms from a questline title.
 * Generates both the full acronym (first letter of every word token)
 * and a stop-word filtered acronym (omitting minor words like 'for', 'of', 'the' when not at index 0).
 * Also preserves any standalone all-caps words (e.g. "BFF <3" includes "BFF").
 */
export function getQuestlineAcronyms(title: string): string[] {
	if (!title || !title.trim()) return [];

	const cached = acronymCache.get(title);
	if (cached) return cached;

	// Tokenize on whitespace, requiring at least one alphabetic letter so symbols and numbers like "<3" or "-" are ignored
	const tokens = title
		.trim()
		.split(/\s+/)
		.filter((t) => /[a-zA-Z]/.test(t));

	if (tokens.length === 0) {
		acronymCache.set(title, []);
		return [];
	}

	const extractFirstChar = (token: string): string => {
		const match = token.match(/[a-zA-Z]/);
		return match ? match[0].toUpperCase() : '';
	};

	// Full acronym: all tokens
	const fullAcronym = tokens.map(extractFirstChar).join('');

	// Stop-word filtered acronym: skips minor words unless it's the very first token
	const filteredTokens = tokens.filter((token, idx) => {
		if (idx === 0) return true;
		const clean = token.toLowerCase().replace(/[^a-z&]/g, '');
		return !STOP_WORDS.has(clean);
	});

	const filteredAcronym = filteredTokens.map(extractFirstChar).join('');

	// Include any distinct all-caps word tokens (e.g. "BFF" in "BFF <3")
	const allCapsWords = tokens.filter((t) => /^[A-Z]{2,}$/.test(t));

	const candidates = Array.from(
		new Set([fullAcronym, filteredAcronym, ...allCapsWords].filter((a) => a.length > 0))
	);
	acronymCache.set(title, candidates);
	return candidates;
}

/**
 * Strips whitespace and punctuation from a query to produce a clean alphanumeric acronym string.
 * e.g. "A.T.I." -> "ATI", "d.i." -> "DI", "a t i" -> "ATI".
 */
function cleanAcronymQuery(query: string): string {
	return query.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/**
 * Determines whether a questline title matches a user search query.
 * Matches if:
 * 1. The query is empty/whitespace.
 * 2. The title contains the query as a substring (case-insensitive).
 * 3. Any candidate acronym for the title matches the normalized query exactly.
 * 4. Any candidate acronym for the title starts with the normalized query (min 2 chars).
 */
export function matchesQuestline(title: string, query: string): boolean {
	if (!query) return true;
	const cleanQuery = query.trim().toLowerCase();
	if (!cleanQuery) return true;

	const titleLower = title.toLowerCase();
	if (titleLower.includes(cleanQuery)) return true;

	const acrQuery = cleanAcronymQuery(query);
	if (acrQuery.length > 0) {
		const acronyms = getQuestlineAcronyms(title);
		if (acronyms.includes(acrQuery)) return true;
		if (acrQuery.length >= 2 && acronyms.some((a) => a.startsWith(acrQuery))) {
			return true;
		}
	}

	return false;
}

/**
 * Computes a numeric relevance rank for a title given a query.
 * Lower numbers represent higher relevance:
 * - 1: Exact acronym match (e.g. ATI -> A Towering Investment, DI -> Dig In) or exact title match.
 * - 2: Title starts with query.
 * - 3: Word boundary match in title (a word in the title starts with the query).
 * - 4: Substring match anywhere in title.
 * - 5: Acronym prefix match (acronym starts with query).
 * - Infinity: No match.
 */
export function rankQuestlineMatch(title: string, query: string): number {
	if (!query || !query.trim()) return 0;

	const cleanQuery = query.trim().toLowerCase();
	const titleLower = title.toLowerCase();
	const acrQuery = cleanAcronymQuery(query);
	const acronyms = getQuestlineAcronyms(title);

	// Tier 1: Exact acronym or exact title match
	if (acrQuery.length > 0 && acronyms.includes(acrQuery)) return 1;
	if (titleLower === cleanQuery) return 1;

	// Tier 2: Title starts with query
	if (titleLower.startsWith(cleanQuery)) return 2;

	// Tier 3: Word boundary in title starts with query
	if (new RegExp(`\\b${escapeRegExp(cleanQuery)}`, 'i').test(title)) return 3;

	// Tier 4: Substring match anywhere in title
	if (titleLower.includes(cleanQuery)) return 4;

	// Tier 5: Acronym prefix match (at least 2 characters)
	if (acrQuery.length >= 2 && acronyms.some((a) => a.startsWith(acrQuery))) return 5;

	return Infinity;
}

/**
 * Filters and ranks questlines according to the search query.
 * If the query is empty or whitespace, the original array is returned untouched
 * preserving the caller's natural ordering.
 */
export function filterAndRankQuestlines<T extends { name: string }>(
	questlines: T[],
	query: string
): T[] {
	if (!query || !query.trim()) return questlines;

	const matched: { item: T; rank: number }[] = [];
	for (const item of questlines) {
		const rank = rankQuestlineMatch(item.name, query);
		if (rank < Infinity) {
			matched.push({ item, rank });
		}
	}

	matched.sort((a, b) => a.rank - b.rank || a.item.name.localeCompare(b.item.name));
	return matched.map((m) => m.item);
}
