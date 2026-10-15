<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import {
		X,
		ExternalLink,
		ChevronDown,
		Check,
		AlertCircle,
		Upload,
		FileText
	} from '@lucide/svelte';
	import { buttonClass } from '$lib/ui/buttonClass';
	import ParseSuccessFlash from './ParseSuccessFlash.svelte';
	import {
		questKey,
		type ImportTab,
		type InventoryEntry,
		type PlayerStats,
		type Questline
	} from '$lib/quest/types';
	import { replaceInventory, mergeInventory } from '$lib/quest/parsing/inventory';
	import {
		detectAndParseInput,
		type ImportMode,
		type ImportTargetType
	} from '$lib/quest/parsing/smartParser';
	import { saveInventoryBaseline } from '$lib/quest/storage/persistence';
	import { getItemsState, retryItems } from '$lib/quest/storage/itemsStore.svelte';
	import { getNpcNames } from '$lib/quest/storage/npcsStore.svelte';
	import { trapFocus } from '$lib/ui/trapFocus';

	const itemsState = getItemsState();

	let {
		open = $bindable(),
		tab = $bindable(),
		inventory = $bindable(),
		questlineOptions,
		completed,
		inventoryBaseline,
		staleKeys,
		onCompletedChanged,
		onStorageWriteFailed,
		onUpdatePlayerStats,
		onUpdateMiningFloors,
		onMaxCapacityDetected
	}: {
		open: boolean;
		tab: ImportTab;
		inventory: InventoryEntry[];
		questlineOptions: Questline[];
		completed: SvelteSet<string>;
		inventoryBaseline: SvelteSet<string>;
		staleKeys: SvelteSet<string>;
		onCompletedChanged: () => void;
		onStorageWriteFailed: () => void;
		onUpdatePlayerStats: (stats: PlayerStats) => void;
		onUpdateMiningFloors: (floors: Record<string, number>) => void;
		onMaxCapacityDetected?: (capacity: number) => void;
	} = $props();

	let importMode = $state<ImportMode>('auto');
	let rawPasteText = $state('');
	let includeBankBalance = $state(false);
	let showGuides = $state(false);
	let activeGuideTab = $state<ImportTargetType>('inventory');

	interface FeedbackStatus {
		type: ImportTargetType | 'composite' | 'unknown';
		summary: string;
		ok: boolean;
	}
	let feedbackStatus = $state<FeedbackStatus | null>(null);

	// Sync caller tab to importMode when modal opens
	$effect(() => {
		if (open) {
			if (tab === 'stats') importMode = 'stats';
			else if (tab === 'mining') importMode = 'mining';
			else if (tab === 'completed') importMode = 'completed';
			else if (tab === 'bank') importMode = 'bank';
			else importMode = 'auto';
		}
	});

	// ---------- Post-parse success flash ----------
	let successFlashMessage = $state<string | null>(null);
	let successFlashTimer: ReturnType<typeof setTimeout> | undefined;

	function flashSuccess(message: string) {
		successFlashMessage = message;
		clearTimeout(successFlashTimer);
		successFlashTimer = setTimeout(() => {
			successFlashMessage = null;
		}, 1500);
	}

	async function pasteFromClipboard() {
		try {
			const text = await navigator.clipboard.readText();
			if (text) rawPasteText = text;
		} catch {
			// Clipboard read denied or not available; fallback to manual paste
		}
	}

	let fileInputEl = $state<HTMLInputElement>();
	let isDraggingOver = $state(false);
	let loadedFileName = $state<string | null>(null);

	function clearPaste() {
		rawPasteText = '';
		feedbackStatus = null;
		unmatchedQuestNames = [];
		loadedFileName = null;
	}

	/** Quest name -> every (questline, quest) pair with that exact name. */
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

	let unmatchedQuestNames = $state<string[]>([]);
	let copyUnmatchedMessage = $state('');

	const missingQuestReportUrl = $derived.by(() => {
		if (unmatchedQuestNames.length === 0) return '';
		const base =
			'https://docs.google.com/forms/d/e/1FAIpQLSclXRihQ2KnJchUlGiqBGCBHTtce193kbAb-g9XvXz9OEvCAA/viewform?usp=pp_url';
		const params = new URLSearchParams({
			'entry.1859873416': 'Missing or wrong quest/item data',
			'entry.1461965644': unmatchedQuestNames.join('\n'),
			'entry.119487616': 'Quest missing entirely',
			'entry.2112241944': `Unmatched during completed quest import on FarmRPG Quest Tracker (${unmatchedQuestNames.length} quest${unmatchedQuestNames.length === 1 ? '' : 's'})`
		});
		return `${base}&${params.toString()}`;
	});

	async function copyUnmatchedQuestNames() {
		const text = `[Quest Tracker] Missing quest(s):\n${unmatchedQuestNames.join('\n')}`;
		await navigator.clipboard.writeText(text);
		copyUnmatchedMessage = 'Copied!';
		setTimeout(() => (copyUnmatchedMessage = ''), 2000);
	}

	function handleParseAndImport() {
		if (!rawPasteText.trim()) {
			feedbackStatus = {
				type: 'unknown',
				summary: 'Nothing to parse — paste content into the box first.',
				ok: false
			};
			return;
		}

		if (importMode === 'inventory' || importMode === 'auto') {
			if (!itemsState.itemsHydrated) {
				feedbackStatus = {
					type: 'inventory',
					summary: 'Item database is still loading — try again in a moment.',
					ok: false
				};
				return;
			}
			if (itemsState.itemsError) {
				feedbackStatus = {
					type: 'inventory',
					summary: 'Item database failed to load — refresh the page.',
					ok: false
				};
				return;
			}
		}

		const result = detectAndParseInput(rawPasteText, importMode, {
			knownItemNames: itemsState.itemNames,
			npcNames: getNpcNames()
		});

		if (!result.ok) {
			feedbackStatus = {
				type: result.detectedType,
				summary: result.error,
				ok: false
			};
			return;
		}

		// Apply parsed output across all detected sections (singular or composite)
		if (result.inventory) {
			if (result.inventory.entries) {
				inventory = replaceInventory(inventory, result.inventory.entries);
			}
			if (result.inventory.maxCapacityDetected) {
				onMaxCapacityDetected?.(result.inventory.maxCapacityDetected);
			}
			inventoryBaseline.clear();
			for (const key of completed) inventoryBaseline.add(key);
			staleKeys.clear();
			if (!saveInventoryBaseline(completed)) onStorageWriteFailed();
		}

		if (result.playerStats) {
			onUpdatePlayerStats(result.playerStats);
		}

		if (result.miningFloors) {
			onUpdateMiningFloors(result.miningFloors);
		}

		if (result.bank) {
			const silver = result.bank.walletSilver + (includeBankBalance ? result.bank.bankSilver : 0);
			inventory = mergeInventory(
				inventory,
				new Map([['Silver', { item: 'Silver', qty: silver, maxed: false }]])
			);
		}

		if (result.completedQuestNames) {
			let matchedNames = 0;
			const unmatched: string[] = [];
			for (const name of result.completedQuestNames) {
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
		}

		flashSuccess(result.summary);
		feedbackStatus = {
			type: result.type,
			summary: result.summary,
			ok: true
		};
	}

	async function processFile(file: File) {
		if (!file) return;

		// Protect against accidental large/binary uploads (5MB ceiling)
		if (file.size > 5 * 1024 * 1024) {
			feedbackStatus = {
				type: 'unknown',
				summary: `"${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed file size is 5 MB.`,
				ok: false
			};
			return;
		}

		try {
			const text = await file.text();
			if (!text.trim()) {
				feedbackStatus = {
					type: 'unknown',
					summary: `"${file.name}" is empty.`,
					ok: false
				};
				return;
			}

			rawPasteText = text;
			loadedFileName = file.name;
			handleParseAndImport();
		} catch (err) {
			feedbackStatus = {
				type: 'unknown',
				summary: err instanceof Error ? err.message : 'Failed to read file.',
				ok: false
			};
		}
	}

	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file) {
			void processFile(file);
		}
		target.value = '';
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDraggingOver = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDraggingOver = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDraggingOver = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) {
			void processFile(file);
		}
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

			<div class="mb-3 flex items-start justify-between">
				<div>
					<h2 id="import-modal-title" class="text-lg font-semibold">Import Data</h2>
					<p class="text-xs text-gray-500 dark:text-gray-400">
						Paste raw text from any FarmRPG page — schema is auto-detected.
					</p>
				</div>
				<button onclick={() => (open = false)} class={buttonClass('icon')} aria-label="Close">
					<X size={16} />
				</button>
			</div>

			<!-- Mode Selector / Fallback Toggle -->
			<div class="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
				<span class="font-medium text-gray-500 dark:text-gray-400">Mode:</span>
				<button
					type="button"
					onclick={() => (importMode = 'auto')}
					class={buttonClass('pill', importMode === 'auto')}
				>
					Auto-Detect
				</button>
				<button
					type="button"
					onclick={() => (importMode = 'inventory')}
					class={buttonClass('pill', importMode === 'inventory')}
				>
					Inventory
				</button>
				<button
					type="button"
					onclick={() => (importMode = 'stats')}
					class={buttonClass('pill', importMode === 'stats')}
				>
					Player Stats
				</button>
				<button
					type="button"
					onclick={() => (importMode = 'mining')}
					class={buttonClass('pill', importMode === 'mining')}
				>
					Mining Floors
				</button>
				<button
					type="button"
					onclick={() => (importMode = 'bank')}
					class={buttonClass('pill', importMode === 'bank')}
				>
					Bank
				</button>
				<button
					type="button"
					onclick={() => (importMode = 'completed')}
					class={buttonClass('pill', importMode === 'completed')}
				>
					Completed Quests
				</button>
			</div>

			<!-- Unified Full-Width Auto-Expanding Textarea -->
			<div class="space-y-2">
				<div class="flex flex-wrap items-center justify-between gap-2 text-xs">
					<label
						for="smart-paste-box"
						class="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300"
					>
						<span>Input Text</span>
						{#if loadedFileName}
							<span
								class="inline-flex items-center gap-1 font-normal text-sky-600 dark:text-sky-400"
							>
								<FileText size={12} />
								{loadedFileName}
							</span>
						{/if}
					</label>
					<div class="flex items-center gap-2">
						<input
							bind:this={fileInputEl}
							type="file"
							accept=".txt,.text,.log,text/plain"
							onchange={handleFileSelect}
							class="hidden"
							aria-label="Upload text file"
						/>
						<button
							type="button"
							onclick={() => fileInputEl?.click()}
							class={buttonClass('default')}
							title="Upload raw text file (.txt)"
						>
							<Upload size={14} class="mr-1 inline text-gray-500 dark:text-gray-400" />
							<span>Upload .txt</span>
						</button>
						<button type="button" onclick={pasteFromClipboard} class={buttonClass('default')}>
							Paste from clipboard
						</button>
						{#if rawPasteText}
							<button type="button" onclick={clearPaste} class={buttonClass('default')}>
								Clear
							</button>
						{/if}
					</div>
				</div>

				<div
					class="relative rounded border transition-colors {isDraggingOver
						? 'border-sky-500 ring-2 ring-sky-500/30 dark:border-sky-400'
						: 'border-gray-300 dark:border-gray-600'}"
				>
					<textarea
						id="smart-paste-box"
						bind:value={rawPasteText}
						rows="7"
						placeholder="Paste anything: Inventory, Player Stats, Mining Floor, Bank, or Quest logs... or drop a .txt file here"
						aria-label="Paste input text or drop text file"
						ondragover={handleDragOver}
						ondragleave={handleDragLeave}
						ondrop={handleDrop}
						class="w-full rounded p-2.5 font-mono text-xs dark:bg-gray-900 dark:text-gray-100 focus:border-sky-500 focus:outline-none"
					></textarea>
					{#if isDraggingOver}
						<div
							class="pointer-events-none absolute inset-0 flex items-center justify-center rounded bg-sky-50/90 text-sm font-semibold text-sky-700 dark:bg-gray-900/90 dark:text-sky-300"
						>
							<Upload size={18} class="mr-2 animate-bounce" />
							Drop .txt file to import
						</div>
					{/if}
				</div>

				{#if importMode === 'bank'}
					<label class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
						<input type="checkbox" bind:checked={includeBankBalance} class="rounded" />
						Include Bank balance with Silver (wallet + bank)
					</label>
				{/if}

				<!-- Action and Feedback -->
				<div class="flex flex-wrap items-center justify-between gap-2 pt-1">
					<button
						type="button"
						onclick={handleParseAndImport}
						class="flex items-center gap-1.5 {buttonClass('primary')}"
					>
						<span>Parse & Import</span>
					</button>

					{#if itemsState.itemsError && (importMode === 'inventory' || importMode === 'auto')}
						<button type="button" onclick={() => retryItems()} class={buttonClass('link')}>
							Retry loading item data
						</button>
					{/if}
				</div>

				<!-- Non-destructive Visual Feedback Pill / Status -->
				{#if feedbackStatus}
					<div
						class="mt-2 flex items-start gap-2 rounded border p-2.5 text-xs {feedbackStatus.ok
							? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
							: 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200'}"
					>
						{#if feedbackStatus.ok}
							<Check size={16} class="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
						{:else}
							<AlertCircle size={16} class="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
						{/if}
						<div class="flex-1">
							<span class="font-semibold uppercase tracking-wider text-[10px]">
								{feedbackStatus.ok
									? feedbackStatus.type === 'composite'
										? 'Parsed Multiple Sections'
										: `Parsed ${feedbackStatus.type}`
									: 'Parse Error'}
							</span>
							<p class="mt-0.5">{feedbackStatus.summary}</p>
						</div>
					</div>
				{/if}

				<!-- Unmatched Quest Names Report Box (if completed quests imported with mismatches) -->
				{#if unmatchedQuestNames.length > 0}
					<div
						class="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-700 dark:bg-amber-950 text-amber-900 dark:text-amber-200"
					>
						<div class="mb-1 flex items-center justify-between">
							<span class="font-semibold">
								{unmatchedQuestNames.length} quest name{unmatchedQuestNames.length === 1 ? '' : 's'} didn't
								match known quests
							</span>
							{#if copyUnmatchedMessage}
								<span class="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
									{copyUnmatchedMessage}
								</span>
							{/if}
						</div>
						<p class="text-[11px] text-amber-800 dark:text-amber-300">
							These may be recently added quests not yet in the tracker database.
						</p>
						<div class="mt-2 flex flex-wrap gap-2">
							<a
								href={missingQuestReportUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1 rounded bg-amber-200 px-2 py-1 font-medium text-amber-900 hover:bg-amber-300 dark:bg-amber-800 dark:text-amber-100"
							>
								<ExternalLink size={12} />
								1-Click Report (Google Form)
							</a>
							<button
								type="button"
								onclick={copyUnmatchedQuestNames}
								class="inline-flex items-center gap-1 rounded border border-amber-400 px-2 py-1 font-medium hover:bg-amber-100 dark:border-amber-600 dark:hover:bg-amber-900"
							>
								Copy missing quest list
							</button>
						</div>
					</div>
				{/if}

				<!-- Collapsible Help Guides Accordion -->
				<div class="mt-4 rounded border border-gray-200 dark:border-gray-700">
					<button
						type="button"
						onclick={() => (showGuides = !showGuides)}
						aria-expanded={showGuides}
						class="flex w-full items-center justify-between bg-gray-50/80 px-3 py-2 text-left text-xs font-medium hover:bg-gray-100 dark:bg-gray-800/80 dark:hover:bg-gray-800"
					>
						<span>How to copy your data from FarmRPG (Guides)</span>
						<ChevronDown
							size={14}
							class="transition-transform duration-200 {showGuides ? 'rotate-180' : ''}"
						/>
					</button>

					{#if showGuides}
						<div class="p-3 text-xs border-t border-gray-200 dark:border-gray-700 space-y-3">
							<div class="flex gap-1.5 border-b border-gray-200 pb-2 dark:border-gray-700">
								<button
									type="button"
									onclick={() => (activeGuideTab = 'inventory')}
									class={buttonClass('pill', activeGuideTab === 'inventory')}
								>
									Inventory
								</button>
								<button
									type="button"
									onclick={() => (activeGuideTab = 'stats')}
									class={buttonClass('pill', activeGuideTab === 'stats')}
								>
									Player Stats
								</button>
								<button
									type="button"
									onclick={() => (activeGuideTab = 'mining')}
									class={buttonClass('pill', activeGuideTab === 'mining')}
								>
									Mining
								</button>
								<button
									type="button"
									onclick={() => (activeGuideTab = 'bank')}
									class={buttonClass('pill', activeGuideTab === 'bank')}
								>
									Bank
								</button>
								<button
									type="button"
									onclick={() => (activeGuideTab = 'completed')}
									class={buttonClass('pill', activeGuideTab === 'completed')}
								>
									Completed
								</button>
							</div>

							{#if activeGuideTab === 'inventory'}
								<div class="space-y-1.5 text-gray-600 dark:text-gray-300">
									<p class="font-medium text-gray-900 dark:text-gray-100">Copying Inventory:</p>
									<ol class="list-decimal pl-4 space-y-1">
										<li>In FarmRPG, open your <strong>Inventory</strong> screen.</li>
										<li>
											Select all text (<kbd class="rounded bg-gray-100 px-1 dark:bg-gray-700"
												>Ctrl+A</kbd
											> or mobile Select All).
										</li>
										<li>
											Copy (<kbd class="rounded bg-gray-100 px-1 dark:bg-gray-700">Ctrl+C</kbd>) and
											paste into the box above.
										</li>
									</ol>
									<p class="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
										<strong>Mobile tip:</strong> If your phone's clipboard truncates large text
										(e.g. Android 9 on Honor Play capping at 1KB), save or share the page to a
										<code>.txt</code>
										file and use <strong>Upload .txt</strong> above.
									</p>
								</div>
							{:else if activeGuideTab === 'stats'}
								<div class="space-y-1.5 text-gray-600 dark:text-gray-300">
									<p class="font-medium text-gray-900 dark:text-gray-100">Copying Player Stats:</p>
									<ol class="list-decimal pl-4 space-y-1">
										<li>In FarmRPG, open your <strong>My Profile</strong> page.</li>
										<li>
											Select all text (<kbd class="rounded bg-gray-100 px-1 dark:bg-gray-700"
												>Ctrl+A</kbd
											> / Select All).
										</li>
										<li>
											Copy and paste into the box above to extract skills and NPC friendships.
										</li>
									</ol>
								</div>
							{:else if activeGuideTab === 'mining'}
								<div class="space-y-1.5 text-gray-600 dark:text-gray-300">
									<p class="font-medium text-gray-900 dark:text-gray-100">Copying Mining Floors:</p>
									<ol class="list-decimal pl-4 space-y-1">
										<li>In FarmRPG, go to the <strong>Mining</strong> page.</li>
										<li>
											Select all page text (<kbd class="rounded bg-gray-100 px-1 dark:bg-gray-700"
												>Ctrl+A</kbd
											> / Select All).
										</li>
										<li>Copy and paste into the box above to import your unlocked floor levels.</li>
									</ol>
								</div>
							{:else if activeGuideTab === 'bank'}
								<div class="space-y-1.5 text-gray-600 dark:text-gray-300">
									<p class="font-medium text-gray-900 dark:text-gray-100">Copying Bank Silver:</p>
									<ol class="list-decimal pl-4 space-y-1">
										<li>In FarmRPG, go to the <strong>Bank</strong> page.</li>
										<li>
											Select all and copy (<kbd class="rounded bg-gray-100 px-1 dark:bg-gray-700"
												>Ctrl+A</kbd
											>
											/ <kbd class="rounded bg-gray-100 px-1 dark:bg-gray-700">Ctrl+C</kbd>).
										</li>
										<li>
											Paste into the box above to import wallet (Deposit All) and optionally bank
											Silver.
										</li>
									</ol>
								</div>
							{:else if activeGuideTab === 'completed'}
								<div class="space-y-1.5 text-gray-600 dark:text-gray-300">
									<p class="font-medium text-gray-900 dark:text-gray-100">
										Copying Completed Quests:
									</p>
									<ol class="list-decimal pl-4 space-y-1">
										<li>In FarmRPG, go to <strong>Help Needed &gt; Completed</strong>.</li>
										<li>
											Select all and copy (<kbd class="rounded bg-gray-100 px-1 dark:bg-gray-700"
												>Ctrl+A</kbd
											>
											/ <kbd class="rounded bg-gray-100 px-1 dark:bg-gray-700">Ctrl+C</kbd>).
										</li>
										<li>Paste into the box above to mark matching quests completed.</li>
									</ol>
									<p class="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
										<strong>Mobile tip:</strong> Long completed quest logs can also be saved as a
										<code>.txt</code>
										file and imported using <strong>Upload .txt</strong>.
									</p>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
