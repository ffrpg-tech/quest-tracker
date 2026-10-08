<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import { MediaQuery, SvelteMap, SvelteSet } from 'svelte/reactivity';
	import type {
		ItemRunsDryAt,
		ItemShortfall,
		QuestDiffResult,
		QuestlineDiffResult
	} from '$lib/quest/calc/diff';
	import {
		isUnavailable,
		type EligibilityGap,
		type RequirementItem,
		type QuestlineEligibility
	} from '$lib/quest/calc/eligibility';
	import { statusTextColorClass } from '$lib/ui/statusColor';
	import { getNpcImagePath } from '$lib/quest/storage/npcsStore.svelte';
	import { toggleExpanded } from '$lib/ui/toggleExpanded';
	import { buddyFarmItemUrl } from '$lib/ui/buddyFarmLink';
	import ItemIcon from './ItemIcon.svelte';
	import CraftTree from './CraftTree.svelte';

	let {
		diffResults,
		eligibilityByQuestline,
		maxedItems,
		runsDryAt,
		showAllItems = false,
		showCraftable = true,
		onOpenImport,
		onToggleCompleted
	}: {
		diffResults: QuestlineDiffResult[];
		eligibilityByQuestline: Map<string, QuestlineEligibility>;
		/** Items the player's current pasted inventory reports as "MAX ON HAND" — surfaced as a MAXED badge so the player knows farming more of it right now is wasted, even on a row that's still short. */
		maxedItems: Set<string>;
		/** For each currently-maxed item, the exact (questline, quest) where its stockpile first runs out in queue order — surfaced as a RUNS DRY badge on that one row. */
		runsDryAt: Map<string, ItemRunsDryAt>;
		showAllItems: boolean;
		showCraftable?: boolean;
		onOpenImport?: (tab: 'stats' | 'mining') => void;
		onToggleCompleted: (questlineName: string, questName: string) => void;
	} = $props();

	// Only mount a questline's quest rows while its <details> is actually open. A
	// closed questline otherwise still rendered its whole row list (up to ~99
	// rows), which dominated render/paint time whenever diffResults changed.
	let openQuestlines = new SvelteSet<string>();

	function handleToggle(name: string, event: Event) {
		if ((event.currentTarget as HTMLDetailsElement).open) openQuestlines.add(name);
		else openQuestlines.delete(name);
	}

	// Render only the layout for the current viewport rather than emitting both
	// the desktop table and the mobile card list for every open questline and
	// letting CSS hide one. `sm` breakpoint = 640px; fallback matches the
	// desktop-first table for SSR / first paint.
	const wide = new MediaQuery('min-width: 640px', true);

	// Eligibility is a second, independent "wall" from the material shortfalls
	// diffResults already carries — a locked quest still gets walked/deducted
	// against the simulated inventory (so its shortfalls stay meaningful for
	// planning), but it can't actually be attempted yet regardless of
	// materials, so its status takes priority over Ready/Wall Point/Short.
	// Same array order as diffResult.quests (both walk questline.quests in
	// order), so indexing by position is safe.
	function questGaps(questlineName: string, qi: number): EligibilityGap[] {
		return eligibilityByQuestline.get(questlineName)?.quests[qi]?.gaps ?? [];
	}

	function questRequirements(questlineName: string, qi: number): RequirementItem[] {
		return eligibilityByQuestline.get(questlineName)?.quests[qi]?.requirements ?? [];
	}

	/** The header badge's "first blocker" — walked independently of
	 * `diffResult.wallPointIndex` (which is purely the material-shortfall wall
	 * from diff.ts) because an eligibility gap (skill/NPC/season) can sit on an
	 * earlier quest than where materials first run out; a locked quest still
	 * gets walked/deducted for planning purposes (see diff.ts), so the material
	 * wall alone can land past the point the player is actually stuck at. This
	 * walks quests in order and stops at whichever blocks first. */
	function effectiveBlock(
		diffResult: QuestlineDiffResult
	): { qi: number; kind: 'unavailable' | 'locked' | 'wall' } | null {
		for (let qi = 0; qi < diffResult.quests.length; qi++) {
			const q = diffResult.quests[qi];
			if (q.done) continue;
			const gaps = questGaps(diffResult.questlineName, qi);
			if (gaps.length > 0) return { qi, kind: isUnavailable(gaps) ? 'unavailable' : 'locked' };
			if (!q.ok) return { qi, kind: 'wall' };
		}
		return null;
	}

	// Computed once per questline whenever diffResults/eligibility changes, rather
	// than re-run for every row on every render of the {#each} below.
	const blockByQuestline = $derived.by(() => {
		const map = new SvelteMap<string, ReturnType<typeof effectiveBlock>>();
		for (const dr of diffResults) map.set(dr.questlineName, effectiveBlock(dr));
		return map;
	});

	// CAPPED's `title` tooltip never reaches touch devices — tapping the badge
	// toggles the same explanation inline instead, so the meaning is reachable
	// without a mouse hover. Keyed by "questName:item" since the same item can
	// be capped in more than one quest row.
	let expandedCapped = $state<string | null>(null);
	function toggleCappedExplanation(key: string) {
		expandedCapped = toggleExpanded(expandedCapped, key);
	}

	const CAPPED_EXPLANATION =
		'This requirement exceeds your known storage cap for this item — no amount of farming clears this until the cap is raised or spent down elsewhere.';

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

{#snippet statusLabel(
	q: QuestDiffResult,
	isWallPoint: boolean,
	small: boolean,
	gaps: EligibilityGap[]
)}
	{@const size = small ? 'shrink-0 text-xs' : ''}
	{#if q.done}
		<span class="{size} {statusTextColorClass('neutral')}">Done</span>
	{:else if isUnavailable(gaps)}
		<span
			class="{size} font-semibold text-red-700 dark:text-red-400"
			title="A seasonal window for this quest has already passed — there's no known guarantee it comes back"
		>
			UNAVAILABLE
		</span>
	{:else if gaps.length > 0}
		<span
			class="{size} font-semibold text-amber-700 dark:text-amber-400"
			title="Level/NPC requirement not met yet — this is a planning-only wall, separate from materials"
		>
			LOCKED
		</span>
	{:else if q.ok}
		<span class="{size} {statusTextColorClass('good')}">Ready</span>
	{:else if isWallPoint}
		<span class="{size} font-semibold {statusTextColorClass('bad')}">Wall Point</span>
	{:else}
		<span class="{size} {statusTextColorClass('warn')}">Short</span>
	{/if}
{/snippet}

{#snippet eligibilityGapList(gaps: EligibilityGap[])}
	<ul class="space-y-0.5 text-xs">
		{#each gaps as gap, i (gap.kind + ':' + gap.label + ':' + i)}
			<li class="flex flex-wrap items-center gap-1">
				{#if gap.kind === 'season'}
					<span
						class="font-medium {gap.expired
							? 'text-red-700 dark:text-red-400'
							: 'text-amber-700 dark:text-amber-400'}">{gap.detail}</span
					>
				{:else if gap.kind === 'pred'}
					<span class="font-medium text-amber-700 dark:text-amber-400">{gap.label}</span> —
					{gap.detail}
				{:else if gap.kind === 'miningFloor'}
					<span class="font-medium text-amber-700 dark:text-amber-400">{gap.label}</span> —
					{gap.detail}
					{#if gap.unimported}
						{#if onOpenImport}
							<button
								type="button"
								onclick={() => onOpenImport?.('mining')}
								class="cursor-pointer text-[10px] text-amber-600 underline hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
							>
								(mining unimported — click to set)
							</button>
						{:else}
							<span class="text-[10px] text-amber-600 italic dark:text-amber-400">
								(mining unimported)
							</span>
						{/if}
					{/if}
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
					<span class="font-medium text-amber-700 dark:text-amber-400">{gap.label}</span>: need
					level
					<span class="tabular-nums text-gray-500 dark:text-gray-400">{gap.required}</span>, have
					<span class="tabular-nums text-sky-600 dark:text-sky-400">{gap.have}</span>
					{#if gap.unimported}
						{#if onOpenImport}
							<button
								type="button"
								onclick={() => onOpenImport?.('stats')}
								class="cursor-pointer text-[10px] text-amber-600 underline hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
							>
								(stats unimported — click to set)
							</button>
						{:else}
							<span class="text-[10px] text-amber-600 italic dark:text-amber-400">
								(stats unimported)
							</span>
						{/if}
					{/if}
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet eligibilityRequirementList(reqs: RequirementItem[])}
	<ul class="space-y-0.5 text-xs">
		{#each reqs as req, i (req.kind + ':' + req.label + ':' + i)}
			<li class="flex flex-wrap items-center gap-1">
				{#if req.met}
					<span class="font-bold text-emerald-600 dark:text-emerald-400">✓</span>
					{#if req.kind === 'season'}
						<span class="text-emerald-700 dark:text-emerald-400">{req.detail}</span>
					{:else if req.kind === 'pred'}
						<span class="text-emerald-700 dark:text-emerald-400">{req.label} — {req.detail}</span>
					{:else if req.kind === 'miningFloor'}
						<span class="text-emerald-700 dark:text-emerald-400">{req.label} — {req.detail}</span>
						<span class="text-[11px] text-gray-500 dark:text-gray-400">(have {req.have})</span>
					{:else}
						{#if req.kind === 'npc' && getNpcImagePath(req.label)}
							<img
								src={getNpcImagePath(req.label)}
								alt=""
								width="14"
								height="14"
								class="inline-block shrink-0"
								loading="lazy"
							/>
						{/if}
						<span class="text-emerald-700 dark:text-emerald-400">{req.label} {req.required}</span>
						<span class="text-[11px] text-gray-500 dark:text-gray-400">(have {req.have})</span>
					{/if}
				{:else}
					{#if req.kind === 'season'}
						<span
							class="font-medium {req.expired
								? 'text-red-700 dark:text-red-400'
								: 'text-amber-700 dark:text-amber-400'}">{req.detail}</span
						>
					{:else if req.kind === 'pred'}
						<span class="font-medium text-amber-700 dark:text-amber-400">{req.label}</span> —
						{req.detail}
					{:else if req.kind === 'miningFloor'}
						<span class="font-medium text-amber-700 dark:text-amber-400">{req.label}</span> —
						{req.detail}
						{#if req.unimported}
							{#if onOpenImport}
								<button
									type="button"
									onclick={() => onOpenImport?.('mining')}
									class="cursor-pointer text-[10px] text-amber-600 underline hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
								>
									(mining unimported — click to set)
								</button>
							{:else}
								<span class="text-[10px] text-amber-600 italic dark:text-amber-400">
									(mining unimported)
								</span>
							{/if}
						{/if}
					{:else}
						{#if req.kind === 'npc' && getNpcImagePath(req.label)}
							<img
								src={getNpcImagePath(req.label)}
								alt=""
								width="14"
								height="14"
								class="inline-block shrink-0"
								loading="lazy"
							/>
						{/if}
						<span class="font-medium text-amber-700 dark:text-amber-400">{req.label}</span>: need
						level
						<span class="tabular-nums text-gray-500 dark:text-gray-400">{req.required}</span>, have
						<span class="tabular-nums text-sky-600 dark:text-sky-400">{req.have}</span>
						{#if req.unimported}
							{#if onOpenImport}
								<button
									type="button"
									onclick={() => onOpenImport?.('stats')}
									class="cursor-pointer text-[10px] text-amber-600 underline hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
								>
									(stats unimported — click to set)
								</button>
							{:else}
								<span class="text-[10px] text-amber-600 italic dark:text-amber-400">
									(stats unimported)
								</span>
							{/if}
						{/if}
					{/if}
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet itemList(q: QuestDiffResult, items: ItemShortfall[], questlineName: string)}
	<ul class="space-y-0.5 text-xs">
		{#each items as s (s.item)}
			{@const cappedKey = q.questName + ':' + s.item}
			{@const maxed = maxedItems.has(s.item)}
			{@const runsDryHere = isRunsDryHere(s.item, questlineName, q.questName)}
			<li>
				<span class="items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
					<ItemIcon name={s.item} />
					<a
						href={buddyFarmItemUrl(s.item)}
						target="_blank"
						rel="noopener noreferrer"
						class="hover:underline">{s.item}</a
					></span
				>: <span class="tabular-nums text-sky-600 dark:text-sky-400">{s.have}</span>
				{#if s.short > 0 && showCraftable && s.craftableQty !== undefined && s.craftableQty > 0}
					<span class="tabular-nums text-violet-600 dark:text-violet-400">(+{s.craftableQty})</span>
					/ <span class="tabular-nums text-gray-500 dark:text-gray-400">{s.needed}</span>
					(<span class="tabular-nums font-semibold text-red-600 dark:text-red-400"
						>{s.short - s.craftableQty}</span
					> left)
				{:else if s.short > 0}
					/ <span class="tabular-nums text-gray-500 dark:text-gray-400">{s.needed}</span>
					(<span class="tabular-nums font-semibold text-red-600 dark:text-red-400">{s.short}</span> left)
				{:else}
					/ <span class="tabular-nums text-gray-500 dark:text-gray-400">{s.needed}</span>
					<span class="font-medium {statusTextColorClass('good')}">(met)</span>
				{/if}
				{#if s.capped}
					<button
						type="button"
						onclick={() => toggleCappedExplanation(cappedKey)}
						title={CAPPED_EXPLANATION}
						aria-expanded={expandedCapped === cappedKey}
						class="ml-1 cursor-pointer rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300"
						>CAPPED</button
					>
				{/if}
				{#if s.exceedsCapacity}
					<span
						title="Cumulative requirement exceeds max capacity of {s.storageCap?.toLocaleString()} — multiple turn-ins or inventory upgrades required"
						class="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300"
						>EXCEEDS CAP</span
					>
				{/if}
				{#if maxed}
					<span
						title={MAXED_EXPLANATION}
						class="ml-1 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300"
						>MAXED</span
					>
				{/if}
				{#if runsDryHere}
					<span
						title={RUNS_DRY_EXPLANATION}
						class="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300"
						>RUNS DRY HERE</span
					>
				{/if}
				{#if s.capped && expandedCapped === cappedKey}
					<div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
						{CAPPED_EXPLANATION}
					</div>
				{/if}
				{#if showCraftable && s.craftTree}
					<CraftTree node={s.craftTree} {showAllItems} />
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

{#if diffResults.length > 0}
	<section class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
		<div class="mb-2 flex items-center justify-between gap-2">
			<h2 class="font-semibold">Results</h2>
		</div>
		<ul class="divide-y divide-gray-100 dark:divide-gray-700">
			{#each diffResults as diffResult, i (diffResult.questlineName)}
				{@const block = blockByQuestline.get(diffResult.questlineName) ?? null}
				<li data-testid="result-row">
					<details class="group" ontoggle={(e) => handleToggle(diffResult.questlineName, e)}>
						<summary
							class="flex cursor-pointer list-none flex-col items-start gap-1 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2"
						>
							<span class="flex min-w-0 items-center gap-2">
								<ChevronRight
									size={14}
									class="shrink-0 text-gray-400 transition-transform group-open:rotate-90"
								/>
								<span class="font-medium sm:truncate">{diffResult.questlineName}</span>
								{#if diffResults.length > 1}
									<span class="hidden shrink-0 text-xs text-gray-400 sm:inline"
										>(queue position {i + 1})</span
									>
								{/if}
							</span>
							{#if block === null}
								<span
									class="shrink-0 rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
								>
									Clear — enough to finish the chain
								</span>
							{:else if block.kind === 'unavailable'}
								<span
									class="shrink-0 rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300"
								>
									Unavailable at {diffResult.quests[block.qi].questName}
								</span>
							{:else if block.kind === 'locked'}
								<span
									class="shrink-0 rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300"
								>
									Locked at {diffResult.quests[block.qi].questName}
								</span>
							{:else}
								<span
									class="shrink-0 rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300"
								>
									Runs out of resources at {diffResult.quests[block.qi].questName}
								</span>
							{/if}
						</summary>

						{#if openQuestlines.has(diffResult.questlineName)}
							{#if wide.current}
								<div
									class="max-h-[32rem] overflow-y-auto rounded border border-gray-100 dark:border-gray-700"
								>
									<table class="w-full text-sm">
										<thead
											class="sticky top-0 z-10 bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400"
										>
											<tr>
												<th class="p-2">Done</th>
												<th class="p-2">#</th>
												<th class="p-2">Quest</th>
												<th class="p-2">Status</th>
												<th class="p-2">Shortfall</th>
											</tr>
										</thead>
										<tbody>
											{#each diffResult.quests as q (q.questName)}
												{@const gaps = questGaps(
													diffResult.questlineName,
													diffResult.quests.indexOf(q)
												)}
												{@const items = showAllItems ? q.requirements : q.shortfalls}
												<tr
													class="border-t border-gray-100 dark:border-gray-700"
													class:bg-red-50={diffResult.quests.indexOf(q) === block?.qi}
													class:dark:bg-red-950={diffResult.quests.indexOf(q) === block?.qi}
													class:opacity-50={q.done}
												>
													<td class="p-2 m-2">
														<input
															type="checkbox"
															checked={q.done}
															aria-label="Mark {q.questName} done"
															onchange={() =>
																onToggleCompleted(diffResult.questlineName, q.questName)}
															class="cursor-pointer h-4 w-4 shrink-0"
														/>
													</td>
													<td class="p-2 text-xs text-gray-400">{q.seq}</td>
													<td class="p-2">
														<span class:line-through={q.done}>{q.questName}</span>
														{#if q.capacityBottlenecks && q.capacityBottlenecks.length > 0}
															<div class="mt-1 space-y-1">
																{#each q.capacityBottlenecks as b (b.item)}
																	<div
																		class="flex items-center gap-1.5 rounded bg-amber-50 px-2 py-0.5 text-[11px] text-amber-900 border border-amber-200 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200"
																	>
																		<span
																			class="rounded bg-amber-200 px-1 text-[9px] font-bold dark:bg-amber-900"
																			>EXCEEDS MAX CAPACITY</span
																		>
																		<span
																			>Exceeds max capacity of {b.maxCapacity.toLocaleString()} ({b.item}:
																			{b.cumulativeNeeded.toLocaleString()} needed) — multiple turn-ins
																			or inventory upgrades required</span
																		>
																	</div>
																{/each}
															</div>
														{/if}
													</td>
													<td class="p-2">
														{@render statusLabel(
															q,
															diffResult.quests.indexOf(q) === block?.qi,
															false,
															gaps
														)}
													</td>
													<td class="p-2">
														{#if showAllItems}
															{@const reqs = questRequirements(diffResult.questlineName, diffResult.quests.indexOf(q))}
															{#if reqs.length > 0}
																{@render eligibilityRequirementList(reqs)}
															{/if}
														{:else if gaps.length > 0}
															{@render eligibilityGapList(gaps)}
														{/if}
														{#if items.length > 0}
															{@render itemList(q, items, diffResult.questlineName)}
														{/if}
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{:else}
								<div
									class="max-h-[32rem] divide-y divide-gray-100 overflow-y-auto rounded border border-gray-100 dark:divide-gray-700 dark:border-gray-700"
								>
									{#each diffResult.quests as q, qi (q.questName + qi)}
										{@const gaps = questGaps(diffResult.questlineName, qi)}
										{@const items = showAllItems ? q.requirements : q.shortfalls}
										<div
											class="flex flex-col gap-1.5 p-2"
											class:bg-red-50={qi === block?.qi}
											class:dark:bg-red-950={qi === block?.qi}
											class:opacity-50={q.done}
										>
											<div class="flex items-start justify-between gap-2">
												<div class="flex min-w-0 items-center gap-2">
													<input
														type="checkbox"
														checked={q.done}
														aria-label="Mark {q.questName} done"
														onchange={() =>
															onToggleCompleted(diffResult.questlineName, q.questName)}
														class="shrink-0 cursor-pointer"
													/>
													<span class="shrink-0 text-xs text-gray-400">#{q.seq}</span>
													<span class="text-sm" class:line-through={q.done}>{q.questName}</span>
												</div>
												{@render statusLabel(q, qi === block?.qi, true, gaps)}
											</div>
											{#if q.capacityBottlenecks && q.capacityBottlenecks.length > 0}
												<div class="pl-6 space-y-1">
													{#each q.capacityBottlenecks as b (b.item)}
														<div
															class="flex items-center gap-1.5 rounded bg-amber-50 px-2 py-0.5 text-[11px] text-amber-900 border border-amber-200 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200"
														>
															<span
																class="rounded bg-amber-200 px-1 text-[9px] font-bold dark:bg-amber-900"
																>EXCEEDS MAX CAPACITY</span
															>
															<span
																>Exceeds max capacity of {b.maxCapacity.toLocaleString()} ({b.item}: {b.cumulativeNeeded.toLocaleString()}
																needed) — multiple turn-ins or upgrades required</span
															>
														</div>
													{/each}
												</div>
											{/if}
											{#if showAllItems}
												{@const reqs = questRequirements(diffResult.questlineName, qi)}
												{#if reqs.length > 0}
													<div class="pl-6">
														{@render eligibilityRequirementList(reqs)}
													</div>
												{/if}
											{:else if gaps.length > 0}
												<div class="pl-6">
													{@render eligibilityGapList(gaps)}
												</div>
											{/if}
											{#if items.length > 0}
												<div class="pl-6">
													{@render itemList(q, items, diffResult.questlineName)}
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						{/if}
					</details>
				</li>
			{/each}
		</ul>
	</section>
{/if}
