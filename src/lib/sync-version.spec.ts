import { describe, it, expect } from 'vitest';
import { extractLatestVersion } from '../../scripts/sync-version.mjs';

describe('extractLatestVersion', () => {
	it('extracts first released version, skipping [Unreleased]', () => {
		const raw = `
# Changelog

## [Unreleased]

### Added
- WIP

## [0.5.3] - 2026-10-15
### Fixed
- Bug fix

## [0.5.2] - 2026-10-14
`;
		expect(extractLatestVersion(raw)).toBe('0.5.3');
	});

	it('returns null if only [Unreleased] exists', () => {
		const raw = `
# Changelog

## [Unreleased]

### Added
- Nothing released yet
`;
		expect(extractLatestVersion(raw)).toBe(null);
	});

	it('extracts version without date suffix if not specified', () => {
		const raw = `
## [1.0.0]
`;
		expect(extractLatestVersion(raw)).toBe('1.0.0');
	});
});
