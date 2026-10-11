import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';
import BottomSheetTestHelper from './BottomSheetTestHelper.svelte';

describe('BottomSheet portal and focus behavior', () => {
	// Check 1: The dialog element is a direct child of document.body, not nested inside the test's wrapper.
	it('Check 1: moves dialog outside test wrapper to document.body via portal', () => {
		const { container, unmount } = render(BottomSheetTestHelper, { open: true });

		const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
		expect(dialog).not.toBeNull();
		// Not nested inside the test's wrapper
		expect(container.contains(dialog)).toBe(false);
		// Root portal container is a direct child of document.body
		expect(dialog.parentElement?.parentElement).toBe(document.body);

		unmount();
	});

	// Check 2: Tab and Shift+Tab stay inside the sheet. Focus cannot land on an element outside it.
	it('Check 2: traps Tab and Shift+Tab focus inside the sheet', () => {
		const { unmount } = render(BottomSheetTestHelper, { open: true });

		const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
		const btn1 = document.getElementById('sheet-btn-1') as HTMLButtonElement;
		const btn2 = document.getElementById('sheet-btn-2') as HTMLButtonElement;
		const outsideBtn = document.getElementById('outside-trigger') as HTMLButtonElement;

		// Focus the first button inside the sheet
		btn1.focus();
		expect(document.activeElement).toBe(btn1);

		// Tab on last element cycles back to first element
		btn2.focus();
		expect(document.activeElement).toBe(btn2);
		dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false, bubbles: true }));
		expect(document.activeElement).toBe(btn1);
		expect(document.activeElement).not.toBe(outsideBtn);

		// Shift+Tab on first element cycles back to last element
		dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
		expect(document.activeElement).toBe(btn2);
		expect(document.activeElement).not.toBe(outsideBtn);

		unmount();
	});

	// Check 3: Pressing Escape calls onClose and sets open to false.
	it('Check 3: pressing Escape calls onClose and sets open to false', async () => {
		const onClose = vi.fn();
		const { unmount } = render(BottomSheetTestHelper, { open: true, onClose });

		const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
		expect(dialog).not.toBeNull();

		dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await tick();

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(document.querySelector('[role="dialog"]')).toBeNull();

		unmount();
	});

	// Check 4: Clicking the scrim calls onClose and sets open to false.
	it('Check 4: clicking the scrim calls onClose and sets open to false', async () => {
		const onClose = vi.fn();
		const { unmount } = render(BottomSheetTestHelper, { open: true, onClose });

		const scrim = document.querySelector('.backdrop-blur-xs') as HTMLElement;
		expect(scrim).not.toBeNull();

		scrim.click();
		await tick();

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(document.querySelector('[role="dialog"]')).toBeNull();

		unmount();
	});

	// Check 5: After closing, focus returns to the element that had focus before the sheet opened.
	it('Check 5: restores focus to previously focused element after closing', async () => {
		const preTrigger = document.createElement('button');
		preTrigger.id = 'pre-test-trigger';
		document.body.appendChild(preTrigger);
		preTrigger.focus();
		expect(document.activeElement).toBe(preTrigger);

		const { unmount } = render(BottomSheetTestHelper, { open: true });

		const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
		expect(dialog).not.toBeNull();

		dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await tick();

		expect(document.activeElement).toBe(preTrigger);

		preTrigger.remove();
		unmount();
	});

	// Check 6: Destroying the component while open is still true removes the node from document.body.
	it('Check 6: destroying component while open removes the node from document.body', () => {
		const { unmount } = render(BottomSheetTestHelper, { open: true });

		expect(document.querySelector('[role="dialog"]')).not.toBeNull();

		unmount();

		expect(document.querySelector('[role="dialog"]')).toBeNull();
	});

	// Check 7: Destroying the component while open is still true restores document.body.style.overflow to its previous value.
	it('Check 7: destroying component while open restores document.body.style.overflow', () => {
		document.body.style.overflow = 'visible';

		const { unmount } = render(BottomSheetTestHelper, { open: true });

		expect(document.body.style.overflow).toBe('hidden');

		unmount();

		expect(document.body.style.overflow).toBe('visible');

		document.body.style.overflow = '';
	});
});
