<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ChevronDown,
		Search,
		ArrowDownWideNarrow,
		ArrowUpNarrowWide,
		RotateCcw,
		Mail,
		MailX,
		ShieldAlert,
		Archive,
		MapPin,
		MessageSquare,
		X
	} from '@lucide/svelte';
	import { matchesQuery } from '$lib/ui/matchesQuery';
	import { buttonClass } from '$lib/ui/buttonClass';
	import { getItemCanMail } from '$lib/quest/storage/itemsStore.svelte';
	import {
		getItemSources,
		getLocationMeta,
		getFullSourceImageUrl,
		isImageFailed,
		markImageFailed
	} from '$lib/quest/storage/sourcesStore.svelte';
	import { buddyFarmItemUrl } from '$lib/ui/buddyFarmLink';
	import { formatNumber } from '$lib/ui/formatNumber';
	import type {
		ItemRunsDryAt,
		QuestlineDiffResult,
		QueueItemShortfall
	} from '$lib/quest/calc/diff';
	import {
		DEFAULT_SHORTFALL_FILTERS,
		loadShortfallFilters,
		saveShortfallFilters,
		type MailFilter,
		type SortDirection
	} from '$lib/quest/storage/persistence';
	import ItemIcon from './ItemIcon.svelte';
	import CraftTree from './CraftTree.svelte';
	import ItemSourcePill from './ItemSourcePill.svelte';
	import RequestListModal from './RequestListModal.svelte';
	import BottomSheet from './BottomSheet.svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import type { PlayerStats } from '$lib/quest/types';

	let {
		diffResults,
		shortfallSummary,
		maxedItems,
		runsDryAt,
		playerStats = null,
		showAllItems = $bindable(false),
		showCraftable = true,
		showLocationSources = true,
		showAlternativeSources = true
	}: {
		diffResults: QuestlineDiffResult[];
		shortfallSummary: QueueItemShortfall[];
		playerStats?: PlayerStats | null;
		/** Items the player's current pasted inventory reports as "MAX ON HAND" — surfaced as a MAX ON HAND badge so a still-short item is flagged as not worth farming further right now. */
		maxedItems: Set<string>;
		/** For each currently-maxed item, the exact (questline, quest) where its stockpile first runs out in queue order — surfaced as a RUNS DRY marker on that one entry below. */
		runsDryAt: Map<string, ItemRunsDryAt>;
		showAllItems: boolean;
		showCraftable?: boolean;
		showLocationSources?: boolean;
		showAlternativeSources?: boolean;
	} = $props();

	const hideCannotMail = false;

	let requestModalOpen = $state(false);

	let expanded = $state(false);

	let rawSearchInput = $state('');
	let shortfallSearch = $state('');
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	function handleSearchInput(e: Event) {
		const val = (e.currentTarget as HTMLInputElement).value;
		rawSearchInput = val;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			shortfallSearch = val;
		}, 150);
	}

	let filtersHydrated = $state(false);
	let mailFilters = $state<Set<MailFilter>>(new Set(['mailable', 'not-mailable']));

	function toggleMailFilter(value: MailFilter) {
		const next = new Set(mailFilters);
		if (next.has(value)) next.delete(value);
		else next.add(value);
		mailFilters = next;
	}

	const itemMailStatusMap = $derived.by(() => {
		const map = new Map();
		for (const s of shortfallSummary) {
			if (!map.has(s.item)) {
				map.set(s.item, getItemCanMail(s.item));
			}
		}
		return map;
	});

	function matchesMailFilter(item: string): boolean {
		const canMail = itemMailStatusMap.get(item);
		if (canMail === undefined) return true;
		return mailFilters.has(canMail ? 'mailable' : 'not-mailable');
	}

	let maxedOnly = $state(false);
	let exceedsCapOnly = $state(false);
	let sortDirection = $state<SortDirection>('desc');

	let showSourcePopover = $state(false);
	let sourcePopoverContainer: HTMLDivElement | null = $state(null);
	let selectedCategories = $state<Set<string>>(new Set());
	let selectedSources = $state<Set<string>>(new Set());
	let sourceFilterSearch = $state('');

	function toggleSourcePopover(e: MouseEvent) {
		e.stopPropagation();
		showSourcePopover = !showSourcePopover;
	}

	function closeSourcePopover() {
		showSourcePopover = false;
	}

	const wide = new MediaQuery('min-width: 640px', true);

	function handleWindowClick(e: MouseEvent) {
		if (
			wide.current &&
			showSourcePopover &&
			sourcePopoverContainer &&
			!sourcePopoverContainer.contains(e.target as Node)
		) {
			showSourcePopover = false;
		}
	}

	interface ShortfallSourceOption {
		id: string;
		name: string;
		image?: string;
		type?: string;
		itemCount: number;
	}

	interface ShortfallCategoryOption {
		id: string;
		label: string;
		icon: string;
		itemCount: number;
	}

	const CATEGORY_CONFIG: { id: string; label: string; icon: string }[] = [
		{ id: 'explore', label: 'Exploring', icon: '' },
		{ id: 'fish', label: 'Fishing', icon: '' },
		{ id: 'mining', label: 'Mining', icon: '' },
		{ id: 'workshop', label: 'Workshop', icon: '' },
		{ id: 'pet', label: 'Pets', icon: '' },
		{ id: 'building', label: 'Farm Buildings', icon: '' },
		{ id: 'farm', label: 'Crops', icon: '' },
		{ id: 'town', label: 'Town & Other', icon: '' }
	];

	function getCategoryForType(type?: string): string {
		if (!type) return 'town';
		if (type === 'store' || type === 'well' || type === 'exchange' || type === 'temple') return 'town';
		return type;
	}

	const availableCategories = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const s of shortfallSummary) {
			const sources = getItemSources(s.item);
			const itemCats = new Set<string>();
			for (const src of sources) {
				const meta = getLocationMeta(src.locId);
				const cat = getCategoryForType(meta?.type);
				itemCats.add(cat);
			}
			for (const cat of itemCats) {
				counts.set(cat, (counts.get(cat) ?? 0) + 1);
			}
		}

		const list: ShortfallCategoryOption[] = [];
		for (const catDef of CATEGORY_CONFIG) {
			const count = counts.get(catDef.id);
			if (count && count > 0) {
				list.push({
					id: catDef.id,
					label: catDef.label,
					icon: catDef.icon,
					itemCount: count
				});
			}
		}
		return list;
	});

	const availableSources = $derived.by(() => {
		const map = new Map<string, ShortfallSourceOption>();
		for (const s of shortfallSummary) {
			const sources = getItemSources(s.item);
			for (const src of sources) {
				const existing = map.get(src.locId);
				if (existing) {
					existing.itemCount++;
				} else {
					const meta = getLocationMeta(src.locId);
					map.set(src.locId, {
						id: src.locId,
						name: meta?.name ?? src.locId,
						image: meta?.image,
						type: meta?.type,
						itemCount: 1
					});
				}
			}
		}
		return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
	});

	const filteredAvailableSources = $derived(
		availableSources.filter((s) => matchesQuery(s.name, sourceFilterSearch))
	);

	function toggleCategory(catId: string) {
		const next = new Set(selectedCategories);
		if (next.has(catId)) next.delete(catId);
		else next.add(catId);
		selectedCategories = next;
	}

	function toggleSource(locId: string) {
		const next = new Set(selectedSources);
		if (next.has(locId)) next.delete(locId);
		else next.add(locId);
		selectedSources = next;
	}

	function selectAllSources() {
		selectedSources = new Set(availableSources.map((s) => s.id));
	}

	function clearAllSourceFilters() {
		selectedSources = new Set();
		selectedCategories = new Set();
	}

	function matchesSourceFilter(item: string): boolean {
		if (selectedCategories.size === 0 && selectedSources.size === 0) return true;
		const sources = getItemSources(item);
		return sources.some((s) => {
			if (selectedSources.has(s.locId)) return true;
			const meta = getLocationMeta(s.locId);
			const cat = getCategoryForType(meta?.type);
			return selectedCategories.has(cat);
		});
	}

	const activeSourceFiltersCount = $derived(selectedCategories.size + selectedSources.size);

	function resetFilters() {
		sortDirection = DEFAULT_SHORTFALL_FILTERS.sortDirection;
		mailFilters = new Set(DEFAULT_SHORTFALL_FILTERS.mailFilters);
		maxedOnly = DEFAULT_SHORTFALL_FILTERS.maxedOnly;
		exceedsCapOnly = DEFAULT_SHORTFALL_FILTERS.exceedsCapOnly;
		selectedCategories = new Set();
		selectedSources = new Set();
	}

	onMount(() => {
		const saved = loadShortfallFilters();
		sortDirection = saved.sortDirection;
		mailFilters = new Set(saved.mailFilters);
		maxedOnly = saved.maxedOnly;
		exceedsCapOnly = saved.exceedsCapOnly;
		if (saved.sourceFilters) {
			selectedSources = new Set(saved.sourceFilters);
		}
		if (saved.categoryFilters) {
			selectedCategories = new Set(saved.categoryFilters);
		}
		filtersHydrated = true;
	});

	$effect(() => {
		if (filtersHydrated) {
			saveShortfallFilters({
				sortDirection,
				mailFilters: Array.from(mailFilters),
				maxedOnly,
				exceedsCapOnly,
				sourceFilters: Array.from(selectedSources),
				categoryFilters: Array.from(selectedCategories)
			});
		}
	});

	const filteredShortfallSummary = $derived(
		shortfallSummary
			.filter(
				(s) =>
					matchesQuery(s.item, shortfallSearch) &&
					matchesMailFilter(s.item) &&
					(!maxedOnly || maxedItems.has(s.item)) &&
					(!exceedsCapOnly || s.exceedsCapacity) &&
					matchesSourceFilter(s.item)
			)
			.toSorted((a, b) => (sortDirection === 'desc' ? b.short - a.short : a.short - b.short))
	);

	const requestModalItems = $derived(
		filteredShortfallSummary.map((s) => ({
			item: s.item,
			short: s.short,
			craftableQty: s.craftableQty
		}))
	);

	// CAPPED's `title` tooltip never reaches touch devices — tapping the badge
	// toggles the same explanation inline instead, so the meaning is reachable
	// without a mouse hover.
	let expandedCappedItem = $state<string | null>(null);

	function toggleCappedExplanation(item: string) {
		expandedCappedItem = expandedCappedItem === item ? null : item;
	}

	const CAPPED_EXPLANATION =
		'A single requirement for this item exceeds your known storage cap — no amount of farming clears this until the cap is raised or spent down elsewhere.';

	const MAXED_EXPLANATION =
		'Your pasted inventory shows this item at "MAX ON HAND" right now — farming more of it won\'t add anything until some is spent, so focus on a different item instead.';

	const RUNS_DRY_EXPLANATION =
		"This is the first quest, in queue order, where this maxed item's stockpile actually falls short.";

	const runsDryKeySet = $derived.by(() => {
		const set = new Set();
		for (const [item, loc] of runsDryAt.entries()) {
			set.add(`\({item}:\){loc.questlineName}:${loc.questName}`);
		}
		return set;
	});

	function isRunsDryHere(item: string, questlineName: string, questName: string): boolean {
		return runsDryKeySet.has(`\({item}:\){questlineName}:${questName}`);
	}
</script>

<svelte:window onclick={handleWindowClick} />

{#if shortfallSummary.length > 0}
	<section class="rounded-lg border border-gray-200 dark:border-gray-700">
		<button
			type="button"
			onclick={() => (expanded = !expanded)}
			aria-expanded={expanded}
			class="flex w-full cursor-pointer items-center gap-1.5 p-4 text-left font-semibold text-gray-900 hover:text-sky-600 dark:text-gray-100 dark:hover:text-sky-400"
		>
			<ChevronDown
				size={16}
				class="transition-transform duration-200 {expanded ? 'rotate-180' : ''}"
			/>
			<span>
				{#if diffResults.length > 1}
					Shortfall summary — combined across {diffResults.length} questlines
				{:else}
					Shortfall summary — {diffResults[0].questlineName}
				{/if}
			</span>
		</button>
		{#if expanded}
			<div class="space-y-2 border-t border-gray-200 p-4 dark:border-gray-700">
				{#if diffResults.length > 1}
					<p class="text-xs text-gray-500 dark:text-gray-400">
						Since queued questlines share one inventory, an item's total below can come from more
						than one questline.
					</p>
				{/if}
				<div class="relative">
					<Search
						size={14}
						class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
					/>
					<input
						type="text"
						oninput={handleSearchInput}
						value={rawSearchInput}
						placeholder="Search items…"
						aria-label="Search items"
						class="w-full rounded border border-gray-300 bg-white py-1.5 pl-8 pr-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
					/>
				</div>
				<div class="flex flex-wrap items-center gap-1 text-xs">
					<!-- Sort Direction -->
					<button
						type="button"
						onclick={() => (sortDirection = sortDirection === 'desc' ? 'asc' : 'desc')}
						class={buttonClass('icon')}
						title={sortDirection === 'desc'
							? 'Sorted by most short (descending) — click to sort least short'
							: 'Sorted by least short (ascending) — click to sort most short'}
						aria-label={sortDirection === 'desc' ? 'Sort least short' : 'Sort most short'}
					>
						{#if sortDirection === 'desc'}
							<ArrowDownWideNarrow size={14} />
						{:else}
							<ArrowUpNarrowWide size={14} />
						{/if}
					</button>

					<span class="mx-0.5 h-4 w-px shrink-0 bg-gray-200 dark:bg-gray-700"></span>

					<!-- Mailable Toggle -->
					<button
						type="button"
						role="checkbox"
						onclick={() => toggleMailFilter('mailable')}
						class={buttonClass('icon', mailFilters.has('mailable'))}
						aria-checked={mailFilters.has('mailable')}
						title="Mailable items {mailFilters.has('mailable') ? '(active)' : '(inactive)'}"
						aria-label="Filter mailable items"
					>
						<Mail size={14} />
					</button>

					<!-- Not Mailable Toggle -->
					<button
						type="button"
						role="checkbox"
						onclick={() => toggleMailFilter('not-mailable')}
						class={buttonClass('icon', mailFilters.has('not-mailable'))}
						aria-checked={mailFilters.has('not-mailable')}
						title="Non-mailable items {mailFilters.has('not-mailable') ? '(active)' : '(inactive)'}"
						aria-label="Filter non-mailable items"
					>
						<MailX size={14} />
					</button>

					<!-- Exceeds Cap Toggle -->
					<button
						type="button"
						role="checkbox"
						onclick={() => (exceedsCapOnly = !exceedsCapOnly)}
						class={buttonClass('icon', exceedsCapOnly)}
						aria-checked={exceedsCapOnly}
						title="Exceeds inventory capacity only {exceedsCapOnly ? '(active)' : '(inactive)'}"
						aria-label="Filter items exceeding inventory capacity"
					>
						<ShieldAlert size={14} />
					</button>

					<!-- Max on Hand Toggle -->
					<button
						type="button"
						role="checkbox"
						onclick={() => (maxedOnly = !maxedOnly)}
						class={buttonClass('icon', maxedOnly)}
						aria-checked={maxedOnly}
						title="Max on hand only {maxedOnly ? '(active)' : '(inactive)'}"
						aria-label="Filter max on hand items"
					>
						<Archive size={14} />
					</button>

					<!-- Location Sources Filter Popover Trigger -->
					{#if showLocationSources && (availableSources.length > 0 || availableCategories.length > 0)}
						<div class="relative inline-flex items-center">
							<button
								type="button"
								onclick={toggleSourcePopover}
								aria-expanded={showSourcePopover}
								class="flex items-center gap-1 {buttonClass('icon', activeSourceFiltersCount > 0)}"
								title="Filter by item sources{activeSourceFiltersCount > 0 ? ` (${activeSourceFiltersCount} active)` : ''}"
								aria-label="Filter by item sources"
							>
								<MapPin size={14} />
								{#if activeSourceFiltersCount > 0}
									<span class="text-[10px] font-bold text-sky-600 dark:text-sky-400">
										{activeSourceFiltersCount}
									</span>
								{/if}
							</button>

							<!-- Sources Popover -->
							{#snippet sourceFilterContent()}
								<div class="mb-2 flex items-center justify-between border-b border-gray-100 pb-1.5 dark:border-gray-700">
									<div class="flex items-center gap-1.5">
										<MapPin size={13} class="text-sky-600 dark:text-sky-400" />
										<span class="text-xs font-semibold text-gray-700 dark:text-gray-300">
											Filter by Source
										</span>
									</div>
									<button
										type="button"
										onclick={closeSourcePopover}
										aria-label="Close"
										class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
									>
										<X size={13} />
									</button>
								</div>

								<!-- Level 1: Category Filter Chips -->
								{#if availableCategories.length > 0}
									<div class="mb-2.5">
										<div class="mb-1 text-[11px] font-semibold text-gray-700 dark:text-gray-300">
											Categories ({availableCategories.length})
										</div>
										<div class="flex flex-wrap gap-1">
											{#each availableCategories as cat (cat.id)}
												<button
													type="button"
													onclick={() => toggleCategory(cat.id)}
													class="inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors {selectedCategories.has(cat.id)
														? 'bg-sky-600 font-semibold text-white shadow-sm dark:bg-sky-500'
														: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}"
													aria-pressed={selectedCategories.has(cat.id)}
												>
													<span>{cat.icon}</span>
													<span>{cat.label}</span>
													<span class="text-[10px] opacity-75">({cat.itemCount})</span>
												</button>
											{/each}
										</div>
									</div>
								{/if}

								<!-- Level 2: Specific Sources -->
								<div class="border-t border-gray-100 pt-2 dark:border-gray-700">
									<div class="mb-1.5 flex items-center justify-between">
										<span class="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
											Specific Sources ({availableSources.length})
										</span>
										<div class="flex items-center gap-2 text-[11px]">
											<button
												type="button"
												onclick={selectAllSources}
												class="text-sky-600 hover:underline dark:text-sky-400"
											>
												Select all
											</button>
											<span class="text-gray-300 dark:text-gray-600">|</span>
											<button
												type="button"
												onclick={clearAllSourceFilters}
												class="text-gray-500 hover:underline dark:text-gray-400"
											>
												Clear all
											</button>
										</div>
									</div>

									{#if availableSources.length > 5}
										<div class="mb-2">
											<input
												bind:value={sourceFilterSearch}
												placeholder="Search sources…"
												class="w-full rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
											/>
										</div>
									{/if}

									<ul class="space-y-1 text-xs max-h-44 overflow-y-auto">
										{#each filteredAvailableSources as src (src.id)}
											{@const cat = getCategoryForType(src.type)}
											{@const isCatSelected = selectedCategories.has(cat)}
											<li>
												<label
													class="flex cursor-pointer items-center justify-between gap-1.5 rounded px-1.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-700/60 {isCatSelected ? 'bg-sky-50/50 dark:bg-sky-950/30' : ''}"
												>
													<div class="flex min-w-0 items-center gap-1.5">
														<input
															type="checkbox"
															checked={selectedSources.has(src.id) || isCatSelected}
															disabled={isCatSelected}
															onchange={() => toggleSource(src.id)}
															class="h-3.5 w-3.5 shrink-0 rounded text-sky-600"
														/>
														{#if src.image && !isImageFailed(src.image)}
															<img
																src={getFullSourceImageUrl(src.image)}
																alt=""
																width="12"
																height="12"
																class="inline-block shrink-0 object-contain"
																loading="lazy"
																onerror={() => markImageFailed(src.image)}
															/>
														{/if}
														<span class="truncate">{src.name}</span>
														{#if isCatSelected}
															<span class="text-[9px] text-sky-600 dark:text-sky-400 font-medium shrink-0">
																(in category)
															</span>
														{/if}
													</div>
													<span class="shrink-0 text-[10px] text-gray-400">({src.itemCount})</span>
												</label>
											</li>
										{:else}
											<li class="py-2 text-center text-[11px] text-gray-400">
												No sources match "{sourceFilterSearch}".
											</li>
										{/each}
									</ul>
								</div>
							{/snippet}

							{#if showSourcePopover}
								{#if wide.current}
									<div
										bind:this={sourcePopoverContainer}
										class="absolute left-0 top-full z-40 mt-1 max-h-80 w-72 sm:w-80 overflow-y-auto rounded-md border border-gray-200 bg-white p-2.5 shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
										role="region"
										aria-label="Filter by source"
									>
										{@render sourceFilterContent()}
									</div>
								{:else}
									<BottomSheet bind:open={showSourcePopover} title="Filter by Source">
										{@render sourceFilterContent()}
									</BottomSheet>
								{/if}
							{/if}
						</div>
					{/if}

					<span class="mx-0.5 h-4 w-px shrink-0 bg-gray-200 dark:bg-gray-700"></span>

					<!-- Reset Filters -->
					<button
						type="button"
						onclick={resetFilters}
						title="Reset all sorting and filters"
						aria-label="Reset all sorting and filters"
						class={buttonClass('icon')}
					>
						<RotateCcw size={14} class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" />
					</button>

					<span class="mx-0.5 h-4 w-px shrink-0 bg-gray-200 dark:bg-gray-700"></span>

					<!-- Copy Request List -->
					<button
						type="button"
						onclick={() => (requestModalOpen = true)}
						title="Export and copy request list for in-game chat & trade"
						aria-label="Export and copy request list for in-game chat & trade"
						class={buttonClass('icon')}
					>
						<MessageSquare size={14} class="text-emerald-600 dark:text-emerald-400" />
					</button>
				</div>
				{#if filteredShortfallSummary.length === 0}
					<p class="text-sm text-gray-500 dark:text-gray-400">
						No items match "{shortfallSearch}".
					</p>
				{:else}
					<ul
						class="grid max-h-[32rem] grid-cols-1 gap-x-6 gap-y-2 overflow-y-auto text-sm sm:grid-cols-2 lg:grid-cols-3"
					>
						{#each filteredShortfallSummary as s (s.item)}
							<li class="border-b border-gray-100 py-1 dark:border-gray-700">
								<div class="flex flex-wrap items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100">
									<ItemIcon name={s.item} />
									<a
										href={buddyFarmItemUrl(s.item)}
										target="_blank"
										rel="noopener noreferrer"
										class="hover:underline">{s.item}</a
									>
									{#if showLocationSources}
										<ItemSourcePill itemName={s.item} {playerStats} {showAlternativeSources} />
									{/if}
									{#if s.capped}
										<button
											type="button"
											onclick={() => toggleCappedExplanation(s.item)}
											title={CAPPED_EXPLANATION}
											aria-expanded={expandedCappedItem === s.item}
											class="cursor-pointer rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300"
											>CAPPED</button
										>
									{/if}
									{#if s.exceedsCapacity}
										<span
											title="Total requirement ({s.needed.toLocaleString()}) exceeds max capacity of {s.storageCap?.toLocaleString()}{s.thresholdBreakerQuest ? ` (first exceeded at ${s.thresholdBreakerQuest})` : ''}{maxedItems.has(s.item) ? ' (currently MAX ON HAND)' : ''} — multiple turn-ins or inventory upgrades required"
											class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300"
											>EXCEEDS CAP</span
										>
									{/if}
									{#if maxedItems.has(s.item)}
										<span
											title={MAXED_EXPLANATION}
											class="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300"
											>MAX ON HAND</span
										>
									{/if}
								</div>
								{#if s.capped && expandedCappedItem === s.item}
									<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{CAPPED_EXPLANATION}</p>
								{/if}
								<div
									class="mt-1 flex justify-between border-l border-gray-200 pl-2 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
								>
									<span>Total</span>
									<span class="tabular-nums text-red-600 dark:text-red-400"
										>−{formatNumber(s.short)}</span
									>
								</div>
								<ul
									class="mt-1 space-y-1 border-l border-gray-200 pl-2 text-xs dark:border-gray-700"
								>
									{#each s.byQuestline as ql (ql.questlineName)}
										<li>
											{#if s.byQuestline.length > 1}
												<div class="flex justify-between text-gray-700 dark:text-gray-300">
													<span class="font-medium">{ql.questlineName} subtotal</span>
													<span class="tabular-nums text-amber-600 dark:text-amber-400"
														>−{formatNumber(ql.short)}</span
													>
												</div>
											{/if}
											<ul
												class="max-h-36 space-y-0.5 overflow-y-auto pr-1"
												class:pl-4={s.byQuestline.length > 1}
											>
												{#each ql.byQuest as bq (bq.seq)}
													<li class="flex flex-col gap-0.5 text-gray-500 dark:text-gray-400">
														<div class="flex items-center justify-between gap-1">
															<span class="inline-flex items-center gap-1">
																{bq.questName}
																{#if isRunsDryHere(s.item, ql.questlineName, bq.questName)}
																	<span
																		title={RUNS_DRY_EXPLANATION}
																		class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300"
																		>RUNS DRY HERE</span
																	>
																{/if}
																{#if bq.isThresholdBreaker}
																	<span
																		title="Inventory capacity limit ({s.storageCap?.toLocaleString()}) is first crossed starting at this quest"
																		class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300"
																		>EXCEEDS CAP HERE</span
																	>
																{/if}
															</span>
															<span class="text-red-300 tabular-nums">−{formatNumber(bq.short)}</span>
														</div>
														{#if showCraftable && bq.craftTree}
															<CraftTree node={bq.craftTree} {showAllItems} {hideCannotMail} />
														{/if}
													</li>
												{/each}
											</ul>
										</li>
									{/each}
								</ul>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}
	</section>
{/if}

<RequestListModal
	bind:open={requestModalOpen}
	items={requestModalItems}
	{maxedItems}
	scopeTitle="Shortfall Summary"
/>
