import { describe, it, expect } from 'vitest';
import {
	getQuestlineAcronyms,
	matchesQuestline,
	rankQuestlineMatch,
	filterAndRankQuestlines
} from './questSearch';

describe('questSearch', () => {
	describe('getQuestlineAcronyms', () => {
		it('extracts exact acronym for standard multi-word titles', () => {
			expect(getQuestlineAcronyms('A Towering Investment')).toContain('ATI');
			expect(getQuestlineAcronyms('Secretly A Society Summons You')).toContain('SASSY');
			expect(getQuestlineAcronyms('Distant Illusions')).toContain('DI');
			expect(getQuestlineAcronyms('Dig In')).toContain('DI');
			expect(getQuestlineAcronyms('Fitness Friends Fit Forever')).toContain('FFFF');
			expect(getQuestlineAcronyms('Incrementally Collecting Everything')).toContain('ICE');
			expect(getQuestlineAcronyms('A Difficult Option Requires Bravery Sometimes')).toContain(
				'ADORBS'
			);
			expect(
				getQuestlineAcronyms(
					'Pleasantly Arbitrating Misconstrued Relational Affronts, Troubles Skirted'
				)
			).toContain('PAMRATS');
		});

		it('handles contractions and punctuation without splitting into extra words', () => {
			// "Ain't" should be treated as one word starting with A, not "Ain" + "t"
			expect(getQuestlineAcronyms("Starting To Actually Realize Magic Ain't Pretty")).toContain(
				'STARMAP'
			);
		});

		it('supports community backronyms that omit minor stop words', () => {
			// "Crates Unlocked for Buddy's Enrichment" -> "CUBE" (skipping "for")
			expect(getQuestlineAcronyms("Crates Unlocked for Buddy's Enrichment")).toContain('CUBE');
			// "Heart Of The Matter" -> both "HOTM" and "HM"
			const hotm = getQuestlineAcronyms('Heart Of The Matter');
			expect(hotm).toContain('HOTM');
		});

		it('ignores standalone punctuation tokens and symbols', () => {
			expect(getQuestlineAcronyms('The Collector - Gold Crab')).toContain('TCGC');
			expect(getQuestlineAcronyms('BFF <3')).toContain('BFF');
		});

		it('returns empty array for empty or whitespace titles', () => {
			expect(getQuestlineAcronyms('')).toEqual([]);
			expect(getQuestlineAcronyms('   ')).toEqual([]);
		});
	});

	describe('matchesQuestline', () => {
		it('matches acronyms case-insensitively for user test cases', () => {
			expect(matchesQuestline('A Towering Investment', 'ATI')).toBe(true);
			expect(matchesQuestline('A Towering Investment', 'ati')).toBe(true);
			expect(matchesQuestline('Secretly A Society Summons You', 'SASSY')).toBe(true);
			expect(matchesQuestline('Secretly A Society Summons You', 'sassy')).toBe(true);
			expect(matchesQuestline("Starting To Actually Realize Magic Ain't Pretty", 'STARMAP')).toBe(
				true
			);
			expect(matchesQuestline("Starting To Actually Realize Magic Ain't Pretty", 'starmap')).toBe(
				true
			);
			expect(matchesQuestline('Distant Illusions', 'DI')).toBe(true);
			expect(matchesQuestline('Distant Illusions', 'di')).toBe(true);
			expect(matchesQuestline('Dig In', 'DI')).toBe(true);
			expect(matchesQuestline('Dig In', 'di')).toBe(true);
		});

		it('matches stop-word filtered backronyms', () => {
			expect(matchesQuestline("Crates Unlocked for Buddy's Enrichment", 'CUBE')).toBe(true);
			expect(matchesQuestline("Crates Unlocked for Buddy's Enrichment", 'cube')).toBe(true);
			expect(matchesQuestline('Heart Of The Matter', 'HOTM')).toBe(true);
			expect(matchesQuestline('Heart Of The Matter', 'hotm')).toBe(true);
		});

		it('matches formatted queries with periods or internal spaces', () => {
			expect(matchesQuestline('A Towering Investment', 'A.T.I.')).toBe(true);
			expect(matchesQuestline('Distant Illusions', 'D.I.')).toBe(true);
			expect(matchesQuestline('A Towering Investment', 'a t i')).toBe(true);
		});

		it('preserves existing case-insensitive substring searching', () => {
			expect(matchesQuestline('A Towering Investment', 'Towering')).toBe(true);
			expect(matchesQuestline('A Towering Investment', 'towering')).toBe(true);
			expect(matchesQuestline('A Towering Investment', 'investment')).toBe(true);
			expect(matchesQuestline('A Towering Investment', 'xyz')).toBe(false);
		});

		it('treats empty or whitespace query as matching everything', () => {
			expect(matchesQuestline('A Towering Investment', '')).toBe(true);
			expect(matchesQuestline('A Towering Investment', '   ')).toBe(true);
		});
	});

	describe('rankQuestlineMatch and relevance ordering', () => {
		it('ranks exact acronym matches at tier 1', () => {
			const atiRank = rankQuestlineMatch('A Towering Investment', 'ATI');
			expect(atiRank).toBe(1);
			const diRank = rankQuestlineMatch('Dig In', 'DI');
			expect(diRank).toBe(1);
		});

		it('ranks exact acronym match ahead of substring matches', () => {
			// "Bowling for Goldie" contains substring "di"
			const substringRank = rankQuestlineMatch('Bowling for Goldie', 'DI');
			// "Distant Illusions" and "Dig In" have exact acronym "DI"
			const acronymRank = rankQuestlineMatch('Distant Illusions', 'DI');
			const digInRank = rankQuestlineMatch('Dig In', 'DI');

			expect(acronymRank).toBeLessThan(substringRank);
			expect(digInRank).toBeLessThan(substringRank);
		});

		it('returns Infinity for non-matching queries', () => {
			expect(rankQuestlineMatch('A Towering Investment', 'xyz')).toBe(Infinity);
		});
	});

	describe('filterAndRankQuestlines', () => {
		const sampleQuestlines = [
			{ name: 'Bowling for Goldie' },
			{ name: 'Distant Illusions' },
			{ name: 'Bad Dirt' },
			{ name: 'Dig In' },
			{ name: 'A Towering Investment' },
			{ name: 'Green Initiative' },
			{ name: 'Secretly A Society Summons You' },
			{ name: "Starting To Actually Realize Magic Ain't Pretty" }
		];

		it('ranks Dig In and Distant Illusions first when searching DI', () => {
			const results = filterAndRankQuestlines(sampleQuestlines, 'DI');
			const names = results.map((q) => q.name);

			expect(names.slice(0, 2)).toEqual(['Dig In', 'Distant Illusions']);
			expect(names).toContain('Bowling for Goldie');
			expect(names).toContain('Bad Dirt');
			expect(names).not.toContain('A Towering Investment');
		});

		it('ranks A Towering Investment first when searching ATI', () => {
			const results = filterAndRankQuestlines(sampleQuestlines, 'ATI');
			const names = results.map((q) => q.name);

			expect(names[0]).toBe('A Towering Investment');
			// Green Initiative contains "ati" in Initiative
			expect(names).toContain('Green Initiative');
		});

		it('finds STARMAP and SASSY cleanly', () => {
			const starmap = filterAndRankQuestlines(sampleQuestlines, 'STARMAP');
			expect(starmap.map((q) => q.name)).toEqual([
				"Starting To Actually Realize Magic Ain't Pretty"
			]);

			const sassy = filterAndRankQuestlines(sampleQuestlines, 'SASSY');
			expect(sassy.map((q) => q.name)).toEqual(['Secretly A Society Summons You']);
		});

		it('returns all questlines unchanged when query is empty', () => {
			const results = filterAndRankQuestlines(sampleQuestlines, '');
			expect(results).toEqual(sampleQuestlines);
		});
	});
});
