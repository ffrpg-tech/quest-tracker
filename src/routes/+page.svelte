<script lang="ts">
	import { onMount } from 'svelte';
	import { asset } from '$app/paths';
	import { TriangleAlert } from '@lucide/svelte';
	import { SvelteSet, SvelteMap } from 'svelte/reactivity';
	import { canonicalUrl, DEFAULT_DESCRIPTION, SITE_NAME } from '$lib/seo';
	import {
		questKey,
		type ImportTab,
		type InventoryEntry,
		type PlayerStats,
		type Questline
	} from '$lib/quest/types';
	import { loadQuestlines, getQuestlinesState } from '$lib/quest/storage/questlinesStore.svelte';
	import { loadItems, getItemsState } from '$lib/quest/storage/itemsStore.svelte';
	import { loadNpcs, getNpcsState } from '$lib/quest/storage/npcsStore.svelte';
	import { inventoryToMap } from '$lib/quest/parsing/inventory';
	import {
		aggregateQueueShortfalls,
		diffQuestlineQueue,
		findRunsDryPoints,
		type QuestlineDiffResult
	} from '$lib/quest/calc/diff';
	import { evaluateQuestlineEligibility, type QuestlineEligibility } from '$lib/quest/calc/eligibility';
	import {
		loadCompleted,
		saveCompleted,
		loadDarkMode,
		saveDarkMode,
		loadInventory,
		saveInventory,
		loadQueue,
		saveQueue,
		loadInventoryBaseline,
		loadPlayerStats,
		savePlayerStats,
		clearPlayerStats
	} from '$lib/quest/storage/persistence';
	import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import InventoryPanel from '$lib/components/InventoryPanel.svelte';
	import PlayerStatsPanel from '$lib/components/PlayerStatsPanel.svelte';
	import QuestlinePicker from '$lib/components/QuestlinePicker.svelte';
	import ShortfallSummary from '$lib/components/ShortfallSummary.svelte';
	import ResultsList from '$lib/components/ResultsList.svelte';
	import SiteFooter from '$lib/components/SiteFooter.svelte';
	import ProgressBackupModal from '$lib/components/ProgressBackupModal.svelte';
	import ImportModal from '$lib/components/ImportModal.svelte';
	import FeedbackModal from '$lib/components/FeedbackModal.svelte';

	const webApplicationJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: SITE_NAME,
		url: canonicalUrl('/'),
		description: DEFAULT_DESCRIPTION,
		applicationCategory: 'GameApplication',
		operatingSystem: 'Any',
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
		author: { '@type': 'Person', name: 'kodyy' }
	};

	// Fetched as a static asset (rather than imported) so it ships as its own
	// cacheable request instead of being bundled into this page's JS chunk —
	// see _headers (project root) for the cache headers and api/fetch-questlines.mjs
	// for where it's generated. Loaded once per tab via questlinesStore, not
	// re-fetched on every client-side remount of this page.
	const questlinesState = getQuestlinesState();
	const questlines = $derived(questlinesState.questlines);
	const questlinesHydrated = $derived(questlinesState.questlinesHydrated);
	const questlinesError = $derived(questlinesState.questlinesError);

	const itemsState = getItemsState();
	const itemsHydrated = $derived(itemsState.itemsHydrated);

	const npcsState = getNpcsState();
	const npcsHydrated = $derived(npcsState.npcsHydrated);

	onMount(() => {
		void loadQuestlines();
		void loadItems();
		void loadNpcs();
	});

	const questlineOptions = $derived(
		Object.values(questlines)
			.slice()
			.sort((a, b) => a.name.localeCompare(b.name))
	);

	const questlineByName = $derived(new Map(questlineOptions.map((g) => [g.name, g])));

	// ---------- Storage-write failure (quota full / private browsing) ----------

	// Sticky once true: once a save has failed there's no point re-checking on
	// every subsequent write, and flipping it back to false on a later
	// successful write would hide the fact that an earlier edit was lost.
	let storageUnavailable = $state(false);

	function trackSave(ok: boolean) {
		if (!ok) storageUnavailable = true;
	}

	// ---------- Inventory ----------

	let inventory = $state<InventoryEntry[]>([]);
	let inventoryHydrated = $state(false);

	onMount(() => {
		inventory = loadInventory();
		inventoryHydrated = true;
	});

	$effect(() => {
		if (inventoryHydrated) trackSave(saveInventory(inventory));
	});

	const inventoryMap = $derived(inventoryToMap(inventory));

	// Items currently flagged "MAX ON HAND" tell us their real storage cap —
	// the parsed quantity *is* the cap, since the player can't be holding more
	// than that. Only covers items that happen to be maxed right now; anything
	// else has an unknown cap and is treated as uncapped.
	const inventoryCaps = $derived(
		new Map(inventory.filter((e) => e.maxed).map((e) => [e.item, e.qty]))
	);

	// Same underlying "MAX ON HAND" flag as inventoryCaps, just as a Set for
	// cheap membership checks in the results/shortfall UI's MAXED badge.
	const maxedItems = $derived(new Set(inventoryCaps.keys()));

	// ---------- Questline queue ----------

	let selectedQuestlineNames = $state<string[]>([]);
	let queueHydrated = $state(false);

	$effect(() => {
		// Waits on questlinesHydrated since questlineByName is empty until the
		// fetch in the questlines onMount above resolves. Also waits out a fetch
		// failure (questlinesError) — otherwise questlineByName would still be
		// empty, every saved name would look "unmatched," and the save effect
		// below would persist that now-empty queue over the real saved one,
		// permanently losing it to what was only a transient network blip.
		if (questlinesHydrated && !questlinesError && !queueHydrated) {
			// Drop any saved name that no longer matches a real questline (e.g. the
			// underlying quest data changed since the queue was saved).
			selectedQuestlineNames = loadQueue().filter((name) => questlineByName.has(name));
			queueHydrated = true;
		}
	});

	$effect(() => {
		if (queueHydrated) trackSave(saveQueue(selectedQuestlineNames));
	});

	const selectedQuestlines = $derived(
		selectedQuestlineNames
			.map((name) => questlineByName.get(name))
			.filter((g): g is Questline => g !== undefined)
	);

	// ---------- Completion tracking (localStorage-backed) ----------

	// SvelteSet/SvelteMap (not $state(Set)/$state(Map)) so toggling one quest
	// mutates in place instead of cloning the whole set/map on every click —
	// completed can hold up to ~2400 entries and completedCountByQuestline one
	// entry per questline (529), and both used to get fully copied per toggle.
	let completed = new SvelteSet<string>();
	let hydrated = $state(false);

	// Snapshot of `completed` as of the last inventory paste — see the note on
	// loadInventoryBaseline in persistence.ts for why this is a set, not a count.
	let inventoryBaseline = new SvelteSet<string>();

	// Keys currently in `completed` but not in `inventoryBaseline` — kept as its
	// own incrementally-updated set (mirroring completedCountByQuestline below)
	// rather than recomputed via `[...completed].some(...)` on every toggle,
	// which would copy the whole (potentially ~2400-entry) completed set just to
	// check for staleness.
	let staleKeys = new SvelteSet<string>();

	/** How many quests are marked done within each questline, keyed by questline name. Kept as its own state (updated incrementally by toggleCompleted) rather than a $derived recompute, since re-walking all ~2400 quests across every questline on every single checkbox click would be wasted work — only one questline's count actually changes per toggle. */
	let completedCountByQuestline = new SvelteMap<string, number>();

	function computeCompletedCounts(completedSet: Set<string>): Map<string, number> {
		const counts = new Map<string, number>();
		for (const g of questlineOptions) {
			let count = 0;
			for (const q of g.quests) {
				if (completedSet.has(questKey(g.name, q.name))) count++;
			}
			counts.set(g.name, count);
		}
		return counts;
	}

	function applyCompletedCounts(counts: Map<string, number>) {
		for (const [name, count] of counts) completedCountByQuestline.set(name, count);
	}

	/** Passed to ImportModal/ProgressBackupModal, which mutate `completed` directly (it's a shared SvelteSet reference) but don't own `completedCountByQuestline` — this is how they trigger the recount after a bulk change. */
	function onCompletedChanged() {
		applyCompletedCounts(computeCompletedCounts(completed));
	}

	$effect(() => {
		// Waits on questlinesHydrated since computeCompletedCounts walks
		// questlineOptions, which is empty until the questlines fetch resolves.
		if (questlinesHydrated && !hydrated) {
			for (const key of loadCompleted()) completed.add(key);
			applyCompletedCounts(computeCompletedCounts(completed));
			for (const key of loadInventoryBaseline()) inventoryBaseline.add(key);
			for (const key of completed) if (!inventoryBaseline.has(key)) staleKeys.add(key);
			hydrated = true;
		}
	});

	/** True when a quest has been checked done since the inventory was last pasted —
	 * only additions count. Unchecking a quest never deducted anything (walkQuestline
	 * skips completed quests entirely), so it can't make the pasted numbers wrong and
	 * doesn't need to trigger this. */
	const inventoryStale = $derived(staleKeys.size > 0);

	$effect(() => {
		if (hydrated) trackSave(saveCompleted(completed));
	});

	function toggleCompleted(questlineName: string, questName: string) {
		const key = questKey(questlineName, questName);
		const adding = !completed.has(key);
		if (adding) completed.add(key);
		else completed.delete(key);

		completedCountByQuestline.set(
			questlineName,
			(completedCountByQuestline.get(questlineName) ?? 0) + (adding ? 1 : -1)
		);

		if (adding && !inventoryBaseline.has(key)) staleKeys.add(key);
		else if (!adding) staleKeys.delete(key);
	}

	// ---------- Diff ----------

	const diffResults = $derived<QuestlineDiffResult[]>(
		diffQuestlineQueue(selectedQuestlines, inventoryMap, completed, inventoryCaps)
	);

	// The single item-level shortfall view, regardless of queue length — this
	// replaces each panel having its own "Total shortfall" block, which was
	// just a redundant subset of this same data once more than one questline
	// was queued.
	const shortfallSummary = $derived(
		diffResults.length > 0 ? aggregateQueueShortfalls(diffResults) : []
	);

	// Where each currently-maxed item's stockpile first actually runs out, in
	// queue order — only computed for maxed items, since a non-maxed item's
	// shortfall is already visible on every row it's short on.
	const runsDryAt = $derived(findRunsDryPoints(diffResults, maxedItems));

	// ---------- Player stats / eligibility ----------

	// Null means "never pasted" — skill/NPC gaps (and the LOCKED badges they
	// drive) stay hidden until then, rather than showing an "unknown" state.
	// Seasonal availability is independent of stats though — evaluateQuestlineEligibility
	// still runs with a null `stats` and reports expired-season gaps regardless, so an
	// UNAVAILABLE quest shows as such even before any stats are pasted.
	let playerStats = $state<PlayerStats | null>(null);

	onMount(() => {
		playerStats = loadPlayerStats();
	});

	function handleClearPlayerStats() {
		playerStats = null;
		clearPlayerStats();
	}

	function handleUpdatePlayerStats(stats: PlayerStats) {
		playerStats = stats;
		trackSave(savePlayerStats(stats));
	}

	const eligibilityByQuestline = $derived.by(() => {
		const now = new Date();
		return new Map(
			questlineOptions.map((g) => [
				g.name,
				evaluateQuestlineEligibility(g, playerStats, completed, questlineByName, now)
			])
		);
	});

	// ---------- Modals ----------

	let progressModalOpen = $state(false);
	let feedbackModalOpen = $state(false);

	let importModalOpen = $state(false);
	let importTab = $state<ImportTab>('inventory');

	function openImportModal(tab: ImportTab) {
		importTab = tab;
		importModalOpen = true;
	}

	// ---------- Dark mode ----------

	let darkMode = $state(false);
	let darkModeHydrated = $state(false);

	onMount(() => {
		darkMode = loadDarkMode();
		darkModeHydrated = true;
	});

	$effect(() => {
		document.documentElement.classList.toggle('dark', darkMode);
		if (darkModeHydrated) trackSave(saveDarkMode(darkMode));
	});

	// ---------- Startup loading screen ----------

	/** Each localStorage read runs in its own onMount and is synchronous, but
	 * naming them individually here still lets the overlay show which piece
	 * is outstanding rather than a single opaque spinner. Questlines/Items are
	 * the two actual network fetches — `questlinesHydrated`/`itemsHydrated` go
	 * true on failure too (see the stores' `finally` blocks), so a fetch error
	 * doesn't leave the overlay stuck; it just means that stage still needed
	 * to be accounted for before the rest of the UI claims to be ready. */
	const loadingStages = $derived([
		{ label: 'Preferences', done: darkModeHydrated },
		{ label: 'Inventory', done: inventoryHydrated },
		{ label: 'Completed quests', done: hydrated },
		{ label: 'Questline queue', done: queueHydrated },
		{ label: 'Questlines', done: questlinesHydrated },
		{ label: 'Items', done: itemsHydrated },
		{ label: 'NPCs', done: npcsHydrated }
	]);
	const appReady = $derived(loadingStages.every((s) => s.done));
</script>

<svelte:head>
	<title>{SITE_NAME}</title>
	<meta name="description" content={DEFAULT_DESCRIPTION} />
	<link rel="canonical" href={canonicalUrl('/')} />

	<meta property="og:type" content="website" />
	<meta property="og:title" content={SITE_NAME} />
	<meta property="og:description" content={DEFAULT_DESCRIPTION} />
	<meta property="og:url" content={canonicalUrl('/')} />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={SITE_NAME} />
	<meta name="twitter:description" content={DEFAULT_DESCRIPTION} />

	<!-- Preload the runtime-fetched data JSON so the browser starts downloading
	     it while parsing <head>, instead of waiting for onMount's fetch() to
	     fire after the route chunk loads and hydrates. -->
	<link rel="preload" href={asset('/questlines.json')} as="fetch" crossorigin="anonymous" />
	<link rel="preload" href={asset('/items.json')} as="fetch" crossorigin="anonymous" />
	<link rel="preload" href={asset('/questlines-meta.json')} as="fetch" crossorigin="anonymous" />

	<!-- eslint-disable svelte/no-at-html-tags -- JSON-LD script tags: content is
	     JSON.stringify of static, developer-authored objects above, not user
	     input, so there's no injection surface. {@html} is the only way to
	     emit a literal <script> tag from svelte:head. -->
	{@html `<script type="application/ld+json">${JSON.stringify(webApplicationJsonLd)}</` + 'script>'}
	<!-- eslint-enable svelte/no-at-html-tags -->
</svelte:head>

{#if !appReady}
	<LoadingOverlay stages={loadingStages} />
{/if}

<div class="mx-auto max-w-6xl space-y-8 p-6 dark:text-gray-100">
	<AppHeader
		{darkMode}
		onToggleDarkMode={() => (darkMode = !darkMode)}
		onOpenImport={() => openImportModal('inventory')}
		onOpenBackup={() => (progressModalOpen = true)}
		onOpenFeedback={() => (feedbackModalOpen = true)}
	/>

	{#if storageUnavailable}
		<div
			class="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
			role="alert"
		>
			<TriangleAlert size={14} class="mt-0.5 shrink-0" />
			<span
				>Your browser blocked saving to local storage (private browsing or storage is full) —
				changes made this session won't be there when you reload. Use "Progress backup" to export
				before you close this tab.</span
			>
		</div>
	{/if}

	<main class="space-y-8">
		<PlayerStatsPanel
			{playerStats}
			onOpenImport={() => openImportModal('stats')}
			onClear={handleClearPlayerStats}
			onUpdate={handleUpdatePlayerStats}
		/>

		<section class="grid grid-rows-[60vh_70vh] gap-6 md:h-[100vh] md:grid-cols-2 md:grid-rows-none">
			<InventoryPanel
				bind:inventory
				{inventoryStale}
				onOpenImport={() => openImportModal('inventory')}
			/>
			<QuestlinePicker
				{questlineOptions}
				{questlineByName}
				{completedCountByQuestline}
				{eligibilityByQuestline}
				bind:selectedQuestlineNames
				{questlinesHydrated}
				{questlinesError}
				onOpenImportCompleted={() => openImportModal('completed')}
			/>
		</section>

		<ShortfallSummary {diffResults} {shortfallSummary} {maxedItems} {runsDryAt} />

		<ResultsList
			{diffResults}
			{eligibilityByQuestline}
			{maxedItems}
			{runsDryAt}
			onToggleCompleted={toggleCompleted}
		/>
	</main>

	<SiteFooter />
</div>

<ProgressBackupModal
	bind:open={progressModalOpen}
	{completed}
	{inventoryBaseline}
	{staleKeys}
	bind:selectedQuestlineNames
	bind:playerStats
	{onCompletedChanged}
	onStorageWriteFailed={() => (storageUnavailable = true)}
/>

<ImportModal
	bind:open={importModalOpen}
	bind:tab={importTab}
	bind:inventory
	bind:playerStats
	{questlineOptions}
	{completed}
	{inventoryBaseline}
	{staleKeys}
	{onCompletedChanged}
	onStorageWriteFailed={() => (storageUnavailable = true)}
/>

<FeedbackModal bind:open={feedbackModalOpen} />
