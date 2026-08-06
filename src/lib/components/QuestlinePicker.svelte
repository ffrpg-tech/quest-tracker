<script lang="ts">
	import {
		Upload,
		GripVertical,
		ChevronUp,
		ChevronDown,
		X,
		Star,
		CircleDashed,
		CircleDot,
		CircleCheck,
		Lock,
		LockOpen,
		CalendarOff
	} from '@lucide/svelte';
	import { buttonClass } from '$lib/ui/buttonClass';
	import { matchesQuery } from '$lib/ui/matchesQuery';
	import { retryQuestlines, getQuestlinesState } from '$lib/quest/storage/questlinesStore.svelte';
	import { getNpcImagePath } from '$lib/quest/storage/npcsStore.svelte';
	import { statusTextColorClass, type SemanticStatus } from '$lib/ui/statusColor';
	import type { Questline } from '$lib/quest/types';
	import { isUnavailable, type EligibilityGap, type QuestlineEligibility } from '$lib/quest/calc/eligibility';
	import { toggleExpanded } from '$lib/ui/toggleExpanded';

	let {
		questlineOptions,
		questlineByName,
		completedCountByQuestline,
		eligibilityByQuestline,
		selectedQuestlineNames = $bindable(),
		questlinesHydrated,
		questlinesError,
		onOpenImportCompleted
	}: {
		questlineOptions: Questline[];
		questlineByName: Map<string, Questline>;
		completedCountByQuestline: Map<string, number>;
		eligibilityByQuestline: Map<string, QuestlineEligibility>;
		selectedQuestlineNames: string[];
		questlinesHydrated: boolean;
		questlinesError: boolean;
		onOpenImportCompleted: () => void;
	} = $props();

	// eligibilityByQuestline is now always populated once questlines are loaded
	// (season gaps are evaluated regardless of player stats — see eligibility.ts)
	// — this just gates the filter/badge UI on "do we have any questlines at all".
	const hasEligibilityData = $derived(eligibilityByQuestline.size > 0);

	type EligibilityFilter = 'eligible' | 'locked';
	// Checkbox-style multi-select (any combination), not a single active choice —
	// different players want different combinations (e.g. locked + not-started).
	// Defaults to 'eligible' only checked, so the picker opens showing what's
	// actually startable right now.
	let eligibilityFilters = $state<Set<EligibilityFilter>>(new Set(['eligible']));

	function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
		const next = new Set(set);
		if (next.has(value)) next.delete(value);
		else next.add(value);
		return next;
	}

	// Expired-season quests are a different category from an ordinary skill/NPC
	// lock — there's no known guarantee they ever return — so they're excluded
	// from the list entirely by default rather than folded into "Locked", and
	// surfaced only via this explicit opt-in toggle.
	let showUnavailable = $state(false);

	// Second, independent "wall" from diff.ts's material wall. Deliberately
	// `canStartNow`, not `allEligible` — a chain with a gap 20 quests from now
	// but a clean next quest is still fully startable today, so it shouldn't
	// read as LOCKED here (that would misrepresent "you can't touch this chain
	// at all" when really only a future quest is walled — that case is still
	// visible per-quest in the Results panel once queued, see ResultsList.svelte).
	function questlineEligible(g: Questline): boolean {
		return eligibilityByQuestline.get(g.name)?.canStartNow ?? true;
	}

	// A questline counts as "main" if any of its quests is flagged — the source
	// data marks main-story status per-quest, not per-chain.
	function isMainQuestline(g: Questline): boolean {
		return g.quests.some((q) => q.mainQuest === true);
	}

	let mainQuestOnly = $state(false);

	// CAPPED's `title` tooltip never reaches touch devices — tapping the badge
	// toggles the same explanation inline instead, matching that existing pattern.
	let expandedLock = $state<string | null>(null);

	function toggleLockExplanation(name: string) {
		expandedLock = toggleExpanded(expandedLock, name);
	}

	// The first non-done quest is exactly the one blocking `canStartNow` above
	// whenever this questline is locked, so this always resolves to the real
	// current blocker, not some other gapped quest further down the chain.
	function lockGaps(g: Questline) {
		const eligibility = eligibilityByQuestline.get(g.name);
		if (!eligibility) return [];
		const nextQuest = eligibility.quests.find((q) => !q.done);
		return nextQuest?.gaps ?? [];
	}

	interface LockInfo {
		locked: boolean;
		unavailable: boolean;
		gaps: EligibilityGap[];
	}

	// Computed once per questline (not once for filtering + once again per rendered
	// row) — both `matchesEligibilityFilter` and the row template below read from
	// this instead of independently re-deriving the same lock/gap facts.
	const lockInfoByQuestline = $derived.by(() => {
		const map = new Map<string, LockInfo>();
		for (const g of questlineOptions) {
			const locked = hasEligibilityData && !questlineEligible(g);
			const gaps = locked ? lockGaps(g) : [];
			map.set(g.name, { locked, unavailable: locked && isUnavailable(gaps), gaps });
		}
		return map;
	});

	let questlineQuery = $state('');
	type QuestlineStatusFilter = 'not-started' | 'ongoing' | 'done';
	// Checkbox-style multi-select. "Done" starts unchecked so finished questlines
	// don't clutter the list by default — opt in via the icon to see them again.
	let questlineStatusFilters = $state<Set<QuestlineStatusFilter>>(
		new Set(['not-started', 'ongoing'])
	);

	const statusFilterIcon = {
		'not-started': CircleDashed,
		ongoing: CircleDot,
		done: CircleCheck
	} as const;

	const eligibilityFilterIcon = {
		eligible: LockOpen,
		locked: Lock
	} as const;

	const questlinesState = getQuestlinesState();
	const dataLastUpdatedLabel = $derived(
		questlinesState.dataLastUpdated
			? new Date(questlinesState.dataLastUpdated).toLocaleDateString(undefined, {
					year: 'numeric',
					month: 'short',
					day: 'numeric'
				})
			: null
	);

	function clearQuestlineSearch() {
		questlineQuery = '';
	}

	function questlineStatus(g: Questline, doneCount: number): 'not-started' | 'ongoing' | 'done' {
		if (doneCount === 0) return 'not-started';
		if (doneCount >= g.questCount) return 'done';
		return 'ongoing';
	}

	const questlineSemanticStatus: Record<ReturnType<typeof questlineStatus>, SemanticStatus> = {
		'not-started': 'bad',
		ongoing: 'warn',
		done: 'good'
	};

	// Unavailable (expired-season) chains are gated by `showUnavailable` alone,
	// bypassing the Eligible/Locked checkboxes entirely — it's neither, it's a
	// distinct "possibly gone for good" category the player opts into seeing.
	function matchesEligibilityFilter(g: Questline): boolean {
		if (!hasEligibilityData) return true;
		const info = lockInfoByQuestline.get(g.name);
		if (info?.unavailable) return showUnavailable;
		return eligibilityFilters.has(info?.locked ? 'locked' : 'eligible');
	}

	const filteredQuestlines = $derived(
		questlineOptions.filter((g) => {
			const matchesStatus = questlineStatusFilters.has(
				questlineStatus(g, completedCountByQuestline.get(g.name) ?? 0)
			);
			return (
				matchesQuery(g.name, questlineQuery) &&
				matchesStatus &&
				matchesEligibilityFilter(g) &&
				(!mainQuestOnly || isMainQuestline(g))
			);
		})
	);

	const selectedQuestlineNameSet = $derived(new Set(selectedQuestlineNames));

	const selectedQuestlines = $derived(
		selectedQuestlineNames
			.map((name) => questlineByName.get(name))
			.filter((g): g is Questline => g !== undefined)
	);

	/** Clicking a picker row toggles it in/out of the queue — appends to the end when adding (order is meaningful for the shared-inventory simulation), removes when it's already queued. Mirrors the highlighted/pressed-toggle-button pattern instead of requiring a trip down to the queue list's ✕ to undo a click. */
	function toggleQueue(name: string) {
		selectedQuestlineNames = selectedQuestlineNames.includes(name)
			? selectedQuestlineNames.filter((n) => n !== name)
			: [...selectedQuestlineNames, name];
	}

	function removeFromQueue(name: string) {
		selectedQuestlineNames = selectedQuestlineNames.filter((n) => n !== name);
	}

	// Announced via the aria-live region below so screen-reader users hear the
	// result of a reorder — a sighted user sees the row move, but nothing else
	// signals that to someone who can't see the drag/drop or the row shift.
	let reorderAnnouncement = $state('');

	/** Keyboard-operable equivalent to the drag-to-reorder handling below — dragging has no
	 * keyboard alternative on its own, so this gives keyboard users a way to reorder the queue. */
	function moveQueueItem(index: number, delta: number) {
		const to = index + delta;
		if (to < 0 || to >= selectedQuestlineNames.length) return;
		const next = selectedQuestlineNames.slice();
		const [moved] = next.splice(index, 1);
		next.splice(to, 0, moved);
		selectedQuestlineNames = next;
		reorderAnnouncement = `Moved ${moved} to position ${to + 1} of ${next.length}.`;
	}

	// ---------- Queue drag-to-reorder ----------

	let dragFromIndex = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);

	function handleQueueDrop(toIndex: number) {
		if (dragFromIndex === null || dragFromIndex === toIndex) {
			dragFromIndex = null;
			dragOverIndex = null;
			return;
		}
		const next = selectedQuestlineNames.slice();
		const [moved] = next.splice(dragFromIndex, 1);
		next.splice(toIndex, 0, moved);
		selectedQuestlineNames = next;
		reorderAnnouncement = `Moved ${moved} to position ${toIndex + 1} of ${next.length}.`;
		dragFromIndex = null;
		dragOverIndex = null;
	}
</script>

<div
	class="flex min-h-0 flex-col space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
>
	<div class="flex items-center justify-between">
		<h2 class="font-semibold">
			1. Questline
			{#if dataLastUpdatedLabel}
				<span class="text-xs font-normal text-gray-500 dark:text-gray-400"
					>&middot; Data updated {dataLastUpdatedLabel}</span
				>
			{/if}
		</h2>
		<button
			onclick={onOpenImportCompleted}
			title="Import completed quests"
			aria-label="Import completed quests"
			class={buttonClass('icon')}
		>
			<Upload size={16} class="text-sky-600 dark:text-sky-400" />
		</button>
	</div>
	<div class="relative">
		<input
			bind:value={questlineQuery}
			placeholder="Search questline name…"
			aria-label="Search questlines"
			class="w-full rounded border border-gray-300 p-2 pr-8 text-sm transition-colors hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500"
		/>
		{#if questlineQuery}
			<button
				onclick={clearQuestlineSearch}
				aria-label="Clear questline search"
				title="Clear questline search"
				class="absolute top-1/2 right-2 -translate-y-1/2 {buttonClass('icon-danger')}"
			>
				<X size={14} />
			</button>
		{/if}
	</div>

	<!-- Every pill below is an independent toggle (checkbox semantics, aria-checked) —
	     any combination can be active at once, e.g. "Not started" + "Locked" together. -->
	<div class="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Filter by status">
		{#each [['not-started', 'Not started'], ['ongoing', 'Ongoing'], ['done', 'Done']] as [value, label] (value)}
			{@const Icon = statusFilterIcon[value as QuestlineStatusFilter]}
			<button
				role="checkbox"
				onclick={() =>
					(questlineStatusFilters = toggleInSet(questlineStatusFilters, value as QuestlineStatusFilter))}
				title={label}
				aria-label={label}
				class={buttonClass('icon', questlineStatusFilters.has(value as QuestlineStatusFilter))}
				aria-checked={questlineStatusFilters.has(value as QuestlineStatusFilter)}
			>
				<Icon size={14} />
			</button>
		{/each}
		{#if hasEligibilityData}
			<span class="mx-0.5 h-4 w-px shrink-0 bg-gray-200 dark:bg-gray-700"></span>
			<span role="group" aria-label="Filter by eligibility" class="contents">
				{#each [['eligible', 'Eligible'], ['locked', 'Locked']] as [value, label] (value)}
					{@const Icon = eligibilityFilterIcon[value as EligibilityFilter]}
					<button
						role="checkbox"
						onclick={() =>
							(eligibilityFilters = toggleInSet(eligibilityFilters, value as EligibilityFilter))}
						title={label}
						aria-label={label}
						class={buttonClass('icon', eligibilityFilters.has(value as EligibilityFilter))}
						aria-checked={eligibilityFilters.has(value as EligibilityFilter)}
					>
						<Icon size={14} />
					</button>
				{/each}
			</span>
			<span class="mx-0.5 h-4 w-px shrink-0 bg-gray-200 dark:bg-gray-700"></span>
			<button
				role="checkbox"
				onclick={() => (showUnavailable = !showUnavailable)}
				title="Unavailable — expired-seasonal quests, hidden by default"
				aria-label="Unavailable"
				class={buttonClass('icon-danger', showUnavailable)}
				aria-checked={showUnavailable}
			>
				<CalendarOff size={14} />
			</button>
		{/if}
		<span class="mx-0.5 h-4 w-px shrink-0 bg-gray-200 dark:bg-gray-700"></span>
		<button
			role="checkbox"
			onclick={() => (mainQuestOnly = !mainQuestOnly)}
			title="Main quest — only show main-story questlines"
			aria-label="Main quest"
			class={buttonClass('icon', mainQuestOnly)}
			aria-checked={mainQuestOnly}
		>
			<Star size={14} class={mainQuestOnly ? 'fill-amber-400 text-amber-400' : ''} />
		</button>
	</div>

	<div class="flex min-h-0 flex-1 flex-col gap-3">
		<div class="min-h-0 flex-1 overflow-y-auto rounded border border-gray-100 dark:border-gray-700">
			<ul data-testid="questline-list">
				{#each filteredQuestlines as g (g.name)}
					{@const doneCount = completedCountByQuestline.get(g.name) ?? 0}
					{@const queued = selectedQuestlineNameSet.has(g.name)}
					{@const statusColor = statusTextColorClass(questlineSemanticStatus[questlineStatus(g, doneCount)])}
					{@const locked = lockInfoByQuestline.get(g.name)?.locked ?? false}
					{@const gaps = lockInfoByQuestline.get(g.name)?.gaps ?? []}
					{@const unavailable = lockInfoByQuestline.get(g.name)?.unavailable ?? false}
					{@const mainQuest = isMainQuestline(g)}
					<li>
						<button
							onclick={() => toggleQueue(g.name)}
							aria-pressed={queued}
							title={queued ? 'Click to remove from queue' : 'Click to add to queue'}
							class="flex w-full cursor-pointer items-center justify-between border-t border-gray-100 p-2 text-left text-sm transition-colors first:border-t-0 hover:bg-gray-50 active:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 dark:active:bg-gray-700"
							class:bg-emerald-50={queued}
							class:dark:bg-emerald-900={queued}
							class:hover:bg-emerald-100={queued}
							class:dark:hover:bg-emerald-800={queued}
						>
							<span class="flex min-w-0 items-center gap-1">
								{#if mainQuest}
									<Star
										size={12}
										class="shrink-0 fill-amber-400 text-amber-400"
										aria-label="Main quest"
									/>
								{/if}
								<span class="truncate">{g.name}</span>
							</span>
							<span class="flex shrink-0 items-center gap-1.5">
								{#if locked}
									<span
										role="button"
										tabindex="0"
										onclick={(e) => {
											e.stopPropagation();
											toggleLockExplanation(g.name);
										}}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												e.stopPropagation();
												toggleLockExplanation(g.name);
											}
										}}
										title={unavailable
											? "A seasonal window has already passed — tap for details"
											: 'Eligibility gap — tap for details'}
										aria-expanded={expandedLock === g.name}
										class="inline-flex cursor-pointer items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold {unavailable
											? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
											: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}"
									>
										{unavailable ? 'UNAVAILABLE' : 'LOCKED'}
										<ChevronDown
											size={10}
											class="transition-transform {expandedLock === g.name ? 'rotate-180' : ''}"
										/>
									</span>
								{/if}
								<span class="text-xs {statusColor}">{doneCount}/{g.questCount}</span>
							</span>
						</button>
						{#if locked && expandedLock === g.name}
							<div class="border-t border-gray-100 p-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
								{#each gaps as gap (gap.kind + ':' + gap.label)}
									<div
										class="flex items-center gap-1 {gap.kind === 'season' && gap.expired
											? 'text-red-600 dark:text-red-400'
											: ''}"
									>
										{#if gap.kind === 'pred'}
											{gap.label} — {gap.detail}
										{:else if gap.kind === 'season'}
											{gap.detail}
										{:else}
											{#if gap.kind === 'npc' && getNpcImagePath(gap.label)}
												<img
													src={getNpcImagePath(gap.label)}
													alt=""
													width="14"
													height="14"
													class="inline-block shrink-0"
													loading="lazy"
												/>
											{/if}
											{gap.label}: need level {gap.required}, have {gap.have}
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</li>
				{:else}
					<li class="p-4 text-center text-xs text-gray-400">
						{#if questlinesError}
							<span class="flex items-center justify-center gap-2">
								Quest data failed to load.
								<button onclick={() => retryQuestlines()} class={buttonClass('link')}>Retry</button>
							</span>
						{:else if questlinesHydrated}
							No questlines match that search/filter.
						{:else}
							Loading questlines…
						{/if}
					</li>
				{/each}
			</ul>
		</div>

		{#if selectedQuestlines.length > 0}
			<div class="flex min-h-0 flex-1 flex-col space-y-2">
				<h3 class="text-xs font-medium text-gray-500 dark:text-gray-400">
					Queue ({selectedQuestlines.length}) — order matters, shared inventory
				</h3>
				<span class="sr-only" role="status" aria-live="polite">{reorderAnnouncement}</span>
				<ul class="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
					{#each selectedQuestlines as g, i (g.name)}
						<li
							data-testid="queue-row"
							draggable="true"
							ondragstart={(e) => {
								dragFromIndex = i;
								// Firefox aborts the drag entirely if dataTransfer.setData isn't
								// called during dragstart — Chromium doesn't enforce this, which is
								// why this was easy to miss testing only against Chromium.
								e.dataTransfer?.setData('text/plain', String(i));
							}}
							ondragover={(e) => {
								e.preventDefault();
								dragOverIndex = i;
							}}
							ondragleave={() => {
								if (dragOverIndex === i) dragOverIndex = null;
							}}
							ondrop={() => handleQueueDrop(i)}
							ondragend={() => {
								dragFromIndex = null;
								dragOverIndex = null;
							}}
							class="flex items-center justify-between gap-2 rounded border border-gray-100 p-2 text-sm transition-colors dark:border-gray-700"
							class:opacity-40={dragFromIndex === i}
							class:border-emerald-400={dragOverIndex === i && dragFromIndex !== i}
							class:dark:border-emerald-500={dragOverIndex === i && dragFromIndex !== i}
						>
							<span class="flex min-w-0 items-center gap-1.5">
								<GripVertical
									size={14}
									class="shrink-0 cursor-grab text-gray-400 active:cursor-grabbing"
								/>
								<span class="truncate">{i + 1}. {g.name}</span>
							</span>
							<span class="flex shrink-0 items-center gap-0.5">
								<button
									onclick={() => moveQueueItem(i, -1)}
									disabled={i === 0}
									aria-label="Move {g.name} up in queue"
									title="Move up"
									class={buttonClass('icon')}
								>
									<ChevronUp size={14} />
								</button>
								<button
									onclick={() => moveQueueItem(i, 1)}
									disabled={i === selectedQuestlines.length - 1}
									aria-label="Move {g.name} down in queue"
									title="Move down"
									class={buttonClass('icon')}
								>
									<ChevronDown size={14} />
								</button>
								<button
									onclick={() => removeFromQueue(g.name)}
									aria-label="Remove from queue"
									title="Remove from queue"
									class={buttonClass('icon-danger')}
								>
									<X size={14} />
								</button>
							</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
</div>
