import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ReactiveDiffProbe from './ReactiveDiffProbe.svelte';
import type { Questline } from '../types';

const selectedQuestline: Questline = {
	name: 'Selected',
	questCount: 1,
	quests: [{ name: 'Selected I', seq: 0, startDate: '', endDate: '', requirements: [] }]
};

describe('ReactiveDiffProbe', () => {
	it('counts diff invalidation from an unselected completion toggle', async () => {
		render(ReactiveDiffProbe, { selectedQuestlines: [selectedQuestline] });

		await expect.element(page.getByTestId('diff-calls')).toHaveTextContent('1');
		await page.getByRole('button', { name: 'Toggle unselected quest' }).click();

		await expect.element(page.getByTestId('diff-calls')).toHaveTextContent('2');
	});

	it('counts separate startup eligibility rebuilds', async () => {
		render(ReactiveDiffProbe, { selectedQuestlines: [selectedQuestline] });

		await page.getByRole('button', { name: 'Settle startup' }).click();

		await expect.element(page.getByTestId('eligibility-rebuilds')).toHaveTextContent('3');
	});
});
