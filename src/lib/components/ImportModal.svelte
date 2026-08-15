<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { X } from '@lucide/svelte';
	import { buttonClass } from '$lib/ui/buttonClass';
	import ParseSuccessFlash from './ParseSuccessFlash.svelte';
	import { questKey, type ImportTab, type InventoryEntry, type PlayerStats, type Questline } from '$lib/quest/types';
	import {
		parseInventoryPaste,
		InventoryParseError,
		toInventoryEntries,
		mergeInventory,
		replaceInventory
	} from '$lib/quest/parsing/inventory';
	import { parseCompletedQuestNames, CompletedQuestParseError } from '$lib/quest/parsing/completed';
	import { parseBankPaste, BankParseError } from '$lib/quest/parsing/bank';
	import { parsePlayerStatsPaste, StatsParseError } from '$lib/quest/parsing/stats';
	import { saveInventoryBaseline, savePlayerStats } from '$lib/quest/storage/persistence';
	import { getItemsState, retryItems } from '$lib/quest/storage/itemsStore.svelte';
	import { getNpcNames } from '$lib/quest/storage/npcsStore.svelte';
	import { trapFocus } from '$lib/ui/trapFocus';

	const itemsState = getItemsState();

	let {
		open = $bindable(),
		tab = $bindable(),
		inventory = $bindable(),
		playerStats = $bindable(),
		questlineOptions,
		completed,
		inventoryBaseline,
		staleKeys,
		onCompletedChanged,
		onStorageWriteFailed
	}: {
		open: boolean;
		tab: ImportTab;
		inventory: InventoryEntry[];
		playerStats: PlayerStats | null;
		questlineOptions: Questline[];
		completed: SvelteSet<string>;
		inventoryBaseline: SvelteSet<string>;
		staleKeys: SvelteSet<string>;
		onCompletedChanged: () => void;
		onStorageWriteFailed: () => void;
	} = $props();

	/** Unwraps a caught paste-parsing error into a user-facing message: the parser's own message if it's the expected error class, otherwise a generic fallback — the one rule shared by all three paste-parsing handlers below. */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function parseErrorMessage(err: unknown, ErrorClass: new (...args: any[]) => Error): string {
		return err instanceof ErrorClass ? err.message : 'Unexpected error parsing paste.';
	}

	/** A parse status message paired with whether it's an error, so the UI can style
	 * failures distinctly from successes instead of both rendering as identical neutral
	 * gray text. */
	type StatusMessage = { text: string; ok: boolean };

	function statusMessageClass(ok: boolean): string {
		return ok
			? 'text-xs text-gray-500 dark:text-gray-400'
			: 'text-xs text-red-600 dark:text-red-400';
	}

	let showScraperHelp = $state(false);

	// ---------- Post-parse success flash ----------
	// Shared across all three tabs: a brief confirmation overlay right after a
	// successful parse. Parsing is synchronous, so this isn't gating on real
	// async work — it's deliberate positive feedback that the paste landed,
	// which matters more now that parsing has more ways to throw (footer
	// count mismatches, etc.) than it used to.

	let successFlashMessage = $state<string | null>(null);
	let successFlashTimer: ReturnType<typeof setTimeout> | undefined;

	function flashSuccess(message: string) {
		successFlashMessage = message;
		clearTimeout(successFlashTimer);
		successFlashTimer = setTimeout(() => {
			successFlashMessage = null;
		}, 1200);
	}

	/**
	 * Fills a paste textarea directly from the clipboard, skipping the manual
	 * Ctrl+V step — parsing is still a separate, deliberate "Parse paste"
	 * click, so a stale/wrong clipboard doesn't get committed before the
	 * player has a chance to glance at what actually landed in the textarea.
	 * `navigator.clipboard.readText()` needs a secure context and a
	 * permission grant, and isn't guaranteed to work in every environment
	 * this app runs in (the Steam client's embedded webview in particular) —
	 * so this fails silently on denial/unsupported rather than surfacing an
	 * error, since manual paste into the same textarea always works as the
	 * fallback regardless of Clipboard API support.
	 */
	async function pasteFromClipboard(setText: (value: string) => void) {
		try {
			const text = await navigator.clipboard.readText();
			if (text) setText(text);
		} catch {
			// Denied, unsupported, or non-secure context — fall back to manual paste.
		}
	}

	// Collapses the how-to-help panel any time the active tab changes, whether
	// switched from inside this modal or set by a caller opening straight to a
	// given tab — a single reactive rule instead of a convention every call
	// site has to remember to apply.
	$effect(() => {
		void tab;
		showScraperHelp = false;
	});

	// ---------- Inventory tab ----------

	let pasteText = $state('');
	let parseMessage = $state<StatusMessage | null>(null);

	function clearPasteText() {
		pasteText = '';
		parseMessage = null;
	}

	function handleParsePaste() {
		if (!pasteText.trim()) {
			parseMessage = { text: 'Nothing to parse.', ok: false };
			return;
		}

		if (!itemsState.itemsHydrated) {
			parseMessage = { text: 'Item data is still loading — try again in a moment.', ok: false };
			return;
		}

		if (itemsState.itemsError) {
			parseMessage = { text: 'Item data failed to load — try refreshing the page.', ok: false };
			return;
		}

		let parsed;
		try {
			parsed = toInventoryEntries(parseInventoryPaste(pasteText), itemsState.itemNames);
		} catch (err) {
			parseMessage = { text: parseErrorMessage(err, InventoryParseError), ok: false };
			return;
		}

		// A full inventory-page paste is a complete snapshot: replace the whole
		// inventory rather than merging, so items that dropped to 0 (and so no
		// longer appear in the paste) don't keep their stale last-known qty —
		// they're kept in the table at qty 0 instead of vanishing outright.
		inventory = replaceInventory(inventory, parsed);
		const text = `Parsed ${parsed.size} item${parsed.size === 1 ? '' : 's'}.`;
		parseMessage = { text, ok: true };
		flashSuccess(text);

		// This paste is a resync to ground truth: whatever's completed right
		// now is now reflected in the pasted numbers, so reset the baseline.
		inventoryBaseline.clear();
		for (const key of completed) inventoryBaseline.add(key);
		staleKeys.clear();
		if (!saveInventoryBaseline(completed)) onStorageWriteFailed();
	}

	// ---------- Bank tab ----------

	let bankPasteText = $state('');
	let bankParseMessage = $state<StatusMessage | null>(null);
	let includeBankBalance = $state(false);

	function clearBankPasteText() {
		bankPasteText = '';
		bankParseMessage = null;
	}

	function handleParseBankPaste() {
		if (!bankPasteText.trim()) {
			bankParseMessage = { text: 'Nothing to parse.', ok: false };
			return;
		}

		let parsed;
		try {
			parsed = parseBankPaste(bankPasteText);
		} catch (err) {
			bankParseMessage = { text: parseErrorMessage(err, BankParseError), ok: false };
			return;
		}

		const silver = parsed.walletSilver + (includeBankBalance ? parsed.bankSilver : 0);
		inventory = mergeInventory(
			inventory,
			new Map([['Silver', { item: 'Silver', qty: silver, maxed: false }]])
		);
		const text = includeBankBalance
			? `Set Silver to ${silver.toLocaleString()} (wallet + bank).`
			: `Set Silver to ${silver.toLocaleString()} (wallet only).`;
		bankParseMessage = { text, ok: true };
		flashSuccess(text);
	}

	// ---------- Player stats tab ----------

	let statsPasteText = $state('');
	let statsParseMessage = $state<StatusMessage | null>(null);

	function clearStatsPasteText() {
		statsPasteText = '';
		statsParseMessage = null;
	}

	function handleParseStats() {
		if (!statsPasteText.trim()) {
			statsParseMessage = { text: 'Nothing to parse.', ok: false };
			return;
		}

		let parsed: PlayerStats;
		try {
			const liveNpcNames = getNpcNames();
			parsed =
				liveNpcNames.length > 0
					? parsePlayerStatsPaste(statsPasteText, liveNpcNames)
					: parsePlayerStatsPaste(statsPasteText);
		} catch (err) {
			statsParseMessage = { text: parseErrorMessage(err, StatsParseError), ok: false };
			return;
		}

		playerStats = parsed;
		if (!savePlayerStats(parsed)) onStorageWriteFailed();
		const npcCount = Object.keys(parsed.npcLevels).length;
		const text = `Parsed player stats (${npcCount} friendship level${npcCount === 1 ? '' : 's'} found).`;
		statsParseMessage = { text, ok: true };
		flashSuccess(text);
	}

	// ---------- Completed quests tab ----------

	/** Quest name -> every (questline, quest) pair with that exact name.
	 * The in-game "Completed Quest List" export only gives bare quest names,
	 * not which chain they belong to, so a name that happens to exist in more than
	 * one questline gets marked done everywhere it appears rather than left ambiguous. */
	const questNameIndex = $derived.by(() => {
		const index = new Map<string, { questlineName: string; questName: string }[]>();
		for (const g of questlineOptions) {
			for (const q of g.quests) {
				const matches = index.get(q.name) ?? [];
				matches.push({ questlineName: g.name, questName: q.name });
				index.set(q.name, matches);
			}
		}
		return index;
	});

	let completedPasteText = $state('');
	let completedParseMessage = $state<StatusMessage | null>(null);
	// Quest names from the paste that didn't match anything in questlines.json —
	// surfaced as a copyable list so the player can report them via feedback
	// instead of the mismatch just silently vanishing into an unmatchedNames count.
	let unmatchedQuestNames = $state<string[]>([]);

	function clearCompletedPasteText() {
		completedPasteText = '';
		completedParseMessage = null;
		unmatchedQuestNames = [];
	}

	function handleParseCompleted() {
		if (!completedPasteText.trim()) {
			completedParseMessage = { text: 'Nothing to parse.', ok: false };
			unmatchedQuestNames = [];
			return;
		}

		let names: string[];
		try {
			names = parseCompletedQuestNames(completedPasteText);
		} catch (err) {
			completedParseMessage = { text: parseErrorMessage(err, CompletedQuestParseError), ok: false };
			unmatchedQuestNames = [];
			return;
		}

		let matchedNames = 0;
		const unmatched: string[] = [];
		for (const name of names) {
			const matches = questNameIndex.get(name);
			if (!matches) {
				unmatched.push(name);
				continue;
			}
			matchedNames++;
			for (const m of matches) {
				const key = questKey(m.questlineName, m.questName);
				completed.add(key);
				if (!inventoryBaseline.has(key)) staleKeys.add(key);
			}
		}
		onCompletedChanged();
		unmatchedQuestNames = [...new Set(unmatched)];
		const text =
			unmatched.length > 0
				? `Marked ${matchedNames} quest name${matchedNames === 1 ? '' : 's'} done (${unmatched.length} name${unmatched.length === 1 ? '' : 's'} didn't match a known quest).`
				: `Marked ${matchedNames} quest${matchedNames === 1 ? '' : 's'} done.`;
		completedParseMessage = { text, ok: true };
		flashSuccess(text);
	}

	let copyUnmatchedMessage = $state('');

	async function copyUnmatchedQuestNames() {
		await navigator.clipboard.writeText(unmatchedQuestNames.join('\n'));
		copyUnmatchedMessage = 'Copied!';
		setTimeout(() => (copyUnmatchedMessage = ''), 2000);
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={(e) => e.target === e.currentTarget && (open = false)}
		role="presentation"
	>
		<div
			class="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800 dark:text-gray-100"
			role="dialog"
			aria-modal="true"
			aria-labelledby="import-modal-title"
			use:trapFocus={() => (open = false)}
		>
			{#if successFlashMessage}
				<ParseSuccessFlash message={successFlashMessage} />
			{/if}

			<div class="mb-4 flex items-start justify-between">
				<h2 id="import-modal-title" class="text-lg font-semibold">Import data</h2>
				<button onclick={() => (open = false)} class={buttonClass('icon')} aria-label="Close">
					<X size={16} />
				</button>
			</div>

			<div class="mb-4 flex gap-1.5 text-sm" role="tablist">
				<button
					onclick={() => (tab = 'stats')}
					class={buttonClass('pill', tab === 'stats')}
					role="tab"
					aria-selected={tab === 'stats'}
				>
					Player stats
				</button>
				<button
					onclick={() => (tab = 'inventory')}
					class={buttonClass('pill', tab === 'inventory')}
					role="tab"
					aria-selected={tab === 'inventory'}
				>
					Inventory
				</button>
				<button
					onclick={() => (tab = 'bank')}
					class={buttonClass('pill', tab === 'bank')}
					role="tab"
					aria-selected={tab === 'bank'}
				>
					Bank (Silver)
				</button>
				<button
					onclick={() => (tab = 'completed')}
					class={buttonClass('pill', tab === 'completed')}
					role="tab"
					aria-selected={tab === 'completed'}
				>
					Completed quests
				</button>
			</div>

			<div role="tabpanel">
			{#if tab === 'inventory'}
				<details
					bind:open={showScraperHelp}
					class="mb-3 rounded border border-gray-200 dark:border-gray-700"
				>
					<summary class="cursor-pointer p-2 text-sm font-medium"
						>How do I get my inventory?</summary
					>
					<div class="border-t border-gray-200 p-3 text-sm dark:border-gray-700">
						<ol class="list-decimal space-y-2 pl-5">
							<li>
								Open FarmRPG (browser, mobile browser, or the Steam client) and go to your
								Inventory screen, then select and copy the whole page:
								<ol class="mt-2 list-[lower-alpha] space-y-2 pl-5">
									<li>
										<strong>Desktop:</strong> select the whole page — <kbd
											class="rounded bg-gray-100 px-1 dark:bg-gray-700">Ctrl+A</kbd
										>
										/
										<kbd class="rounded bg-gray-100 px-1 dark:bg-gray-700">Cmd+A</kbd> in a browser,
										or the Steam client's <strong>Edit &gt; Select All</strong> — then copy it (<kbd
											class="rounded bg-gray-100 px-1 dark:bg-gray-700">Ctrl+C</kbd
										>
										/
										<strong>Edit &gt; Copy</strong>).
									</li>
									<li>
										<strong>Mobile:</strong> long-press the page text, tap
										<strong>Select All</strong>, then tap <strong>Copy</strong>. This works in some
										mobile browsers but not all — if it doesn't grab the whole page, try a desktop
										browser instead.
									</li>
								</ol>
							</li>
							<li>Come back here, paste the full copied text below, and click "Parse paste".</li>
						</ol>
						<p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
							The parser looks for the inventory section within whatever you paste, so surrounding
							chat/menu text is fine. Items shown as <code
								class="rounded bg-gray-100 px-1 dark:bg-gray-700">MAX ON HAND</code
							> are flagged as maxed, which sets that item's storage cap for shortfall calculations.
						</p>
					</div>
				</details>

				<div class="mb-1 flex justify-end">
					<button
						onclick={() => pasteFromClipboard((v) => (pasteText = v))}
						class={buttonClass('default')}
					>
						Paste from clipboard
					</button>
				</div>
				<div class="relative">
					<textarea
						bind:value={pasteText}
						rows="6"
						placeholder="Paste the full inventory page text here"
						aria-label="Paste inventory text"
						class="w-full rounded border border-gray-300 p-2 pr-9 font-mono text-xs dark:border-gray-600 dark:bg-gray-800"
					></textarea>
					{#if pasteText}
						<button
							onclick={clearPasteText}
							aria-label="Clear pasted text"
							title="Clear pasted text"
							class="absolute top-2 right-3 {buttonClass('icon-danger')}"
						>
							<X size={16} />
						</button>
					{/if}
				</div>
				<div class="mt-2 flex items-center gap-2">
					<button onclick={handleParsePaste} class={buttonClass('primary')}>Parse paste</button>
					{#if parseMessage}
						<span class={statusMessageClass(parseMessage.ok)}>{parseMessage.text}</span>
						{#if !parseMessage.ok && itemsState.itemsError}
							<button onclick={() => retryItems()} class={buttonClass('link')}>Retry</button>
						{/if}
					{/if}
				</div>
				<p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
					This replaces your entire inventory below with what's in the paste.
				</p>
			{:else if tab === 'bank'}
				<details
					bind:open={showScraperHelp}
					class="mb-3 rounded border border-gray-200 dark:border-gray-700"
				>
					<summary class="cursor-pointer p-2 text-sm font-medium">How do I get my Silver?</summary>
					<div class="border-t border-gray-200 p-3 text-sm dark:border-gray-700">
						<ol class="list-decimal space-y-2 pl-5">
							<li>
								Open FarmRPG (browser, mobile browser, or the Steam client) and go to the Bank
								page, then select and copy the whole page:
								<ol class="mt-2 list-[lower-alpha] space-y-2 pl-5">
									<li>
										<strong>Desktop:</strong> select the whole page — <kbd
											class="rounded bg-gray-100 px-1 dark:bg-gray-700">Ctrl+A</kbd
										>
										/
										<kbd class="rounded bg-gray-100 px-1 dark:bg-gray-700">Cmd+A</kbd> in a browser,
										or the Steam client's <strong>Edit &gt; Select All</strong> — then copy it (<kbd
											class="rounded bg-gray-100 px-1 dark:bg-gray-700">Ctrl+C</kbd
										>
										/
										<strong>Edit &gt; Copy</strong>).
									</li>
									<li>
										<strong>Mobile:</strong> long-press the page text, tap
										<strong>Select All</strong>, then tap <strong>Copy</strong>. This works in some
										mobile browsers but not all — if it doesn't grab the whole page, try a desktop
										browser instead.
									</li>
								</ol>
							</li>
							<li>Come back here, paste the full copied text below, and click "Parse paste".</li>
						</ol>
						<p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
							This reads the <strong>Bulk Options</strong> block. "Deposit All" is Silver sitting in your
							wallet (spendable right now) — that's what's used by default. "Withdraw All" is Silver already
							in the bank, not in your wallet yet; check the box below to add it in too if you'd withdraw
							it to cover a quest.
						</p>
					</div>
				</details>

				<label class="mb-2 flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={includeBankBalance} />
					Also include bank balance (Withdraw All)
				</label>

				<div class="mb-1 flex justify-end">
					<button
						onclick={() => pasteFromClipboard((v) => (bankPasteText = v))}
						class={buttonClass('default')}
					>
						Paste from clipboard
					</button>
				</div>
				<div class="relative">
					<textarea
						bind:value={bankPasteText}
						rows="6"
						placeholder="Paste the full Bank page text here"
						aria-label="Paste Bank page text"
						class="w-full rounded border border-gray-300 p-2 pr-9 font-mono text-xs dark:border-gray-600 dark:bg-gray-800"
					></textarea>
					{#if bankPasteText}
						<button
							onclick={clearBankPasteText}
							aria-label="Clear pasted text"
							title="Clear pasted text"
							class="absolute top-2 right-3 {buttonClass('icon-danger')}"
						>
							<X size={16} />
						</button>
					{/if}
				</div>
				<div class="mt-2 flex items-center gap-2">
					<button onclick={handleParseBankPaste} class={buttonClass('primary')}>Parse paste</button>
					{#if bankParseMessage}
						<span class={statusMessageClass(bankParseMessage.ok)}>{bankParseMessage.text}</span>
					{/if}
				</div>
			{:else if tab === 'completed'}
				<details
					bind:open={showScraperHelp}
					class="mb-3 rounded border border-gray-200 dark:border-gray-700"
				>
					<summary class="cursor-pointer p-2 text-sm font-medium"
						>How do I get my completed quest list?</summary
					>
					<div class="border-t border-gray-200 p-3 text-sm dark:border-gray-700">
						<ol class="list-decimal space-y-2 pl-5">
							<li>
								Open FarmRPG (browser, mobile browser, or the Steam client) and go to Help Needed
								&gt; Completed, then select and copy the whole page:
								<ol class="mt-2 list-[lower-alpha] space-y-2 pl-5">
									<li>
										<strong>Desktop:</strong> select the whole page — <kbd
											class="rounded bg-gray-100 px-1 dark:bg-gray-700">Ctrl+A</kbd
										>
										/
										<kbd class="rounded bg-gray-100 px-1 dark:bg-gray-700">Cmd+A</kbd> in a browser,
										or the Steam client's <strong>Edit &gt; Select All</strong> — then copy it (<kbd
											class="rounded bg-gray-100 px-1 dark:bg-gray-700">Ctrl+C</kbd
										>
										/
										<strong>Edit &gt; Copy</strong>).
									</li>
									<li>
										<strong>Mobile:</strong> long-press the page text, tap
										<strong>Select All</strong>, then tap <strong>Copy</strong>. This works in some
										mobile browsers but not all — if it doesn't grab the whole page, try a desktop
										browser instead.
									</li>
								</ol>
							</li>
							<li>Come back here, paste the full copied text below, and click "Parse paste".</li>
						</ol>
						<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
							The parser looks for the "Completed Requests" section within whatever you paste, so
							surrounding chat/menu/active-request text is fine. It only recovers quest names, not
							which questline each one belongs to — matching quest names get marked done across
							every questline that has one. If the same quest name is reused in more than one chain,
							all of them get marked, since a bare name can't distinguish which chain it actually
							came from.
						</p>
					</div>
				</details>

				<div class="mb-1 flex justify-end">
					<button
						onclick={() => pasteFromClipboard((v) => (completedPasteText = v))}
						class={buttonClass('default')}
					>
						Paste from clipboard
					</button>
				</div>
				<div class="relative">
					<textarea
						bind:value={completedPasteText}
						rows="6"
						placeholder="Paste the full Help Needed &gt; Completed page text here"
						aria-label="Paste completed quests text"
						class="w-full rounded border border-gray-300 p-2 pr-9 font-mono text-xs dark:border-gray-600 dark:bg-gray-800"
					></textarea>
					{#if completedPasteText}
						<button
							onclick={clearCompletedPasteText}
							aria-label="Clear pasted text"
							title="Clear pasted text"
							class="absolute top-2 right-3 {buttonClass('icon-danger')}"
						>
							<X size={16} />
						</button>
					{/if}
				</div>
				<div class="mt-2 flex items-center gap-2">
					<button onclick={handleParseCompleted} class={buttonClass('primary')}>Parse paste</button>
					{#if completedParseMessage}
						<span class={statusMessageClass(completedParseMessage.ok)}>{completedParseMessage.text}</span>
					{/if}
				</div>
				<p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
					A quest name matching more than one questline gets marked done in all of them.
				</p>
				{#if unmatchedQuestNames.length > 0}
					<div
						class="mt-3 rounded border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950"
					>
						<div class="mb-1 flex items-center justify-between">
							<span class="text-xs font-medium text-amber-800 dark:text-amber-300"
								>{unmatchedQuestNames.length} name{unmatchedQuestNames.length === 1 ? '' : 's'} didn't
								match a known quest</span
							>
							<button onclick={copyUnmatchedQuestNames} class={buttonClass('link')}>
								{copyUnmatchedMessage || 'Copy list'}
							</button>
						</div>
						<pre
							class="max-h-32 overflow-y-auto rounded bg-gray-900 p-2 text-xs text-gray-100"><code
								>{unmatchedQuestNames.join('\n')}</code
							></pre>
						<p class="mt-2 text-xs text-amber-800 dark:text-amber-300">
							These might be missing from the quest data. Copy the list above and send it to
							<strong>kodyy</strong> in-game so they can get added.
						</p>
					</div>
				{/if}
			{:else if tab === 'stats'}
				<details
					bind:open={showScraperHelp}
					class="mb-3 rounded border border-gray-200 dark:border-gray-700"
				>
					<summary class="cursor-pointer p-2 text-sm font-medium"
						>How do I get my player stats?</summary
					>
					<div class="border-t border-gray-200 p-3 text-sm dark:border-gray-700">
						<ol class="list-decimal space-y-2 pl-5">
							<li>
								Open FarmRPG (browser, mobile browser, or the Steam client) and go to
								<strong>My Profile</strong>, then select and copy the whole page:
								<ol class="mt-2 list-[lower-alpha] space-y-2 pl-5">
									<li>
										<strong>Desktop:</strong> select the whole page — <kbd
											class="rounded bg-gray-100 px-1 dark:bg-gray-700">Ctrl+A</kbd
										>
										/
										<kbd class="rounded bg-gray-100 px-1 dark:bg-gray-700">Cmd+A</kbd> in a browser,
										or the Steam client's <strong>Edit &gt; Select All</strong> — then copy it (<kbd
											class="rounded bg-gray-100 px-1 dark:bg-gray-700">Ctrl+C</kbd
										>
										/
										<strong>Edit &gt; Copy</strong>).
									</li>
									<li>
										<strong>Mobile:</strong> long-press the page text, tap
										<strong>Select All</strong>, then tap <strong>Copy</strong>. This works in some
										mobile browsers but not all — if it doesn't grab the whole page, try a desktop
										browser instead.
									</li>
								</ol>
							</li>
							<li>Come back here, paste the full copied text below, and click "Parse paste".</li>
						</ol>
						<p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
							This reads your Farming/Fishing/Crafting/Exploring/Cooking/Tower levels and
							Friendship Levels with each Townsfolk NPC, and unlocks the eligibility filter and lock
							badges on the questline list below.
						</p>
					</div>
				</details>

				<div class="mb-1 flex justify-end">
					<button
						onclick={() => pasteFromClipboard((v) => (statsPasteText = v))}
						class={buttonClass('default')}
					>
						Paste from clipboard
					</button>
				</div>
				<div class="relative">
					<textarea
						bind:value={statsPasteText}
						rows="6"
						placeholder="Paste the full My Profile page text here"
						aria-label="Paste player stats text"
						class="w-full rounded border border-gray-300 p-2 pr-9 font-mono text-xs dark:border-gray-600 dark:bg-gray-800"
					></textarea>
					{#if statsPasteText}
						<button
							onclick={clearStatsPasteText}
							aria-label="Clear pasted text"
							title="Clear pasted text"
							class="absolute top-2 right-3 {buttonClass('icon-danger')}"
						>
							<X size={16} />
						</button>
					{/if}
				</div>
				<div class="mt-2 flex items-center gap-2">
					<button onclick={handleParseStats} class={buttonClass('primary')}>Parse paste</button>
					{#if statsParseMessage}
						<span class={statusMessageClass(statsParseMessage.ok)}>{statsParseMessage.text}</span>
					{/if}
				</div>
				<p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
					This overwrites your previously pasted stats.
				</p>
			{/if}
			</div>
		</div>
	</div>
{/if}
