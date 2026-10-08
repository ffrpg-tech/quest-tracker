import { describe, it, expect } from 'vitest';
import { compareSemver, APP_VERSION } from './version';

describe('compareSemver', () => {
	it('identifies identical versions', () => {
		expect(compareSemver('0.4.2', '0.4.2')).toBe(0);
		expect(compareSemver('v0.4.2', '0.4.2')).toBe(0);
	});

	it('detects newer version correctly', () => {
		expect(compareSemver('0.4.2', '0.4.1')).toBe(1);
		expect(compareSemver('0.5.0', '0.4.9')).toBe(1);
		expect(compareSemver('1.0.0', '0.9.9')).toBe(1);
	});

	it('detects older version correctly', () => {
		expect(compareSemver('0.4.1', '0.4.2')).toBe(-1);
		expect(compareSemver('0.4.0', '0.4.2')).toBe(-1);
	});

	it('exports valid APP_VERSION constant matching 0.4.2', () => {
		expect(APP_VERSION).toBe('0.4.2');
	});
});
