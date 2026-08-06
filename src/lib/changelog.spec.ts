import { describe, it, expect } from 'vitest';
import { groupByMinor, type ChangelogEntry } from './changelog';

function entry(version: string): ChangelogEntry {
	return { version, date: null, sections: [{ heading: 'Added', items: ['something'] }] };
}

describe('groupByMinor', () => {
	it('groups entries sharing a major.minor version together, preserving input order', () => {
		const entries = [entry('0.2.5'), entry('0.2.4'), entry('0.1.5'), entry('0.1.4')];

		expect(groupByMinor(entries)).toEqual([
			{ minor: '0.2', entries: [entry('0.2.5'), entry('0.2.4')] },
			{ minor: '0.1', entries: [entry('0.1.5'), entry('0.1.4')] }
		]);
	});

	it('keeps a later occurrence of an already-seen minor version in that same group', () => {
		// Not expected in practice (CHANGELOG.md lists versions newest-first,
		// contiguous by minor), but the grouping shouldn't silently duplicate a
		// minor group if entries were ever interleaved.
		const entries = [entry('0.2.1'), entry('0.1.9'), entry('0.2.0')];

		expect(groupByMinor(entries)).toEqual([
			{ minor: '0.2', entries: [entry('0.2.1'), entry('0.2.0')] },
			{ minor: '0.1', entries: [entry('0.1.9')] }
		]);
	});

	it('falls back to grouping a malformed version under itself', () => {
		const entries = [entry('Unreleased')];

		expect(groupByMinor(entries)).toEqual([{ minor: 'Unreleased', entries: [entry('Unreleased')] }]);
	});

	it('returns an empty array for no entries', () => {
		expect(groupByMinor([])).toEqual([]);
	});
});
