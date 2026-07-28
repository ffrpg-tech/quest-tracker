<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import type { ItemShortfall, QuestDiffResult, QuestlineDiffResult } from '$lib/quest/calc/diff';
	import { isUnavailable, type EligibilityGap, type QuestlineEligibility } from '$lib/quest/calc/eligibility';
	import { statusTextColorClass } from '$lib/ui/statusColor';
	import { getNpcImagePath } from '$lib/quest/storage/npcsStore.svelte';
	import { toggleExpanded } from '$lib/ui/toggleExpanded';
	import { buddyFarmItemUrl } from '$lib/ui/buddyFarmLink';
	import { buttonClass } from '$lib/ui/buttonClass';
	import ItemIcon from './ItemIcon.svelte';

	let {
		diffResults,
		eligibilityByQuestline,
		maxedItems,
		onToggleCompleted
	}: {
		diffResults: QuestlineDiffResult[];
		eligibilityByQuestline: Map<string, QuestlineEligibility>;
		/** Items the player's current pasted inventory reports as "MAX ON HAND" — surfaced as a MAXED badge so the player knows farming more of it right now is wasted, even on a row that's still short. */
		maxedItems: Set<string>;
		onToggleCompleted: (questlineName: string, questName: string) => void;
	} = $props();

	// Off by default — shortfalls-only is the existing/expected view; showing
	// every requirement (including already-satisfied ones) is opt-in so a
	// MAXED item can be spotted even where it isn't blocking anything.
	let showAllItems = $state(false);

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
		"Your pasted inventory shows this item at \"MAX ON HAND\" right now — farming more of it won't add anything until some is spent, so focus on a different item instead.";
</script>

{#snippet statusLabel(q: QuestDiffResult, isWallPoint: boolean, small: boolean, gaps: EligibilityGap[])}
	{@const size = small ? 'shrink-0 text-xs' : ''}
	{#if q.done}
		<span class="{size} {statusTextColorClass('neutral')}">Done</span>
	{:else if isUnavailable(gaps)}
		<span
			class="{size} font-semibold text-red-700 dark:text-red-400"
			title="A seasonal window for this quest has already passed — there's no known guarantee it comes back">
			UNAVAILABLE
		</span>
	{:else if gaps.length > 0}
		<span
			class="{size} font-semibold text-amber-700 dark:text-amber-400"
			title="Level/NPC requirement not met yet — this is a planning-only wall, separate from materials">
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
		{#each gaps as gap (gap.kind + ':' + gap.label)}
			<li class="flex items-center gap-1">
				{#if gap.kind === 'season'}
					<span
						class="font-medium {gap.expired
							? 'text-red-700 dark:text-red-400'
							: 'text-amber-700 dark:text-amber-400'}">{gap.detail}</span
					>
				{:else if gap.kind === 'pred'}
					<span class="font-medium text-amber-700 dark:text-amber-400">{gap.label}</span> —
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
					<span class="font-medium text-amber-700 dark:text-amber-400">{gap.label}</span>: need level
					<span class="tabular-nums text-gray-500 dark:text-gray-400">{gap.required}</span>, have
					<span class="tabular-nums text-sky-600 dark:text-sky-400">{gap.have}</span>
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet itemList(q: QuestDiffResult, items: ItemShortfall[])}
	<ul class="space-y-0.5 text-xs">
		{#each items as s (s.item)}
			{@const cappedKey = q.questName + ':' + s.item}
			{@const maxed = maxedItems.has(s.item)}
			<li>
				<span class="inline-flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
					<ItemIcon name={s.item} />
					<a href={buddyFarmItemUrl(s.item)} target="_blank" rel="noopener noreferrer" class="hover:underline"
						>{s.item}</a
					></span
				>: need
				<span class="tabular-nums text-gray-500 dark:text-gray-400">{s.needed}</span>, have
				<span class="tabular-nums text-sky-600 dark:text-sky-400">{s.have}</span>
				{#if s.short > 0}
					(short
					<span class="tabular-nums font-semibold text-red-600 dark:text-red-400">{s.short}</span>)
				{:else}
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
				{#if maxed}
					<span
						title={MAXED_EXPLANATION}
						class="ml-1 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300"
						>MAXED</span
					>
				{/if}
				{#if s.capped && expandedCapped === cappedKey}
					<div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
						{CAPPED_EXPLANATION}
					</div>
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

{#if diffResults.length > 0}
	<section class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
		<div class="mb-2 flex items-center justify-between gap-2">
			<h2 class="font-semibold">Results</h2>
			<button
				type="button"
				onclick={() => (showAllItems = !showAllItems)}
				aria-pressed={showAllItems}
				class={buttonClass('pill', showAllItems)}
			>
				Show all items
			</button>
		</div>
		<ul class="divide-y divide-gray-100 dark:divide-gray-700">
			{#each diffResults as diffResult, i (diffResult.questlineName)}
				{@const block = effectiveBlock(diffResult)}
				<li data-testid="result-row">
					<details class="group">
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
									Runs dry at {diffResult.quests[block.qi].questName}
								</span>
							{/if}
						</summary>

						<div
							class="hidden max-h-[32rem] overflow-y-auto rounded border border-gray-100 dark:border-gray-700 sm:block"
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
									{#each diffResult.quests as q, qi (q.questName + qi)}
										{@const gaps = questGaps(diffResult.questlineName, qi)}
										{@const items = showAllItems ? q.requirements : q.shortfalls}
										<tr
											class="border-t border-gray-100 dark:border-gray-700"
											class:bg-red-50={qi === block?.qi}
											class:dark:bg-red-950={qi === block?.qi}
											class:opacity-50={q.done}
										>
											<td class="p-2">
												<input
													type="checkbox"
													checked={q.done}
													aria-label="Mark {q.questName} done"
													onchange={() => onToggleCompleted(diffResult.questlineName, q.questName)}
													class="cursor-pointer"
												/>
											</td>
											<td class="p-2 text-xs text-gray-400">{q.seq}</td>
											<td class="p-2" class:line-through={q.done}>{q.questName}</td>
											<td class="p-2">
												{@render statusLabel(q, qi === block?.qi, false, gaps)}
											</td>
											<td class="p-2">
												{#if gaps.length > 0}
													{@render eligibilityGapList(gaps)}
												{/if}
												{#if items.length > 0}
													{@render itemList(q, items)}
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						<div
							class="max-h-[32rem] divide-y divide-gray-100 overflow-y-auto rounded border border-gray-100 dark:divide-gray-700 dark:border-gray-700 sm:hidden"
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
												onchange={() => onToggleCompleted(diffResult.questlineName, q.questName)}
												class="shrink-0 cursor-pointer"
											/>
											<span class="shrink-0 text-xs text-gray-400">#{q.seq}</span>
											<span class="text-sm" class:line-through={q.done}>{q.questName}</span>
										</div>
										{@render statusLabel(q, qi === block?.qi, true, gaps)}
									</div>
									{#if gaps.length > 0}
										<div class="pl-6">
											{@render eligibilityGapList(gaps)}
										</div>
									{/if}
									{#if items.length > 0}
										<div class="pl-6">
											{@render itemList(q, items)}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</details>
				</li>
			{/each}
		</ul>
	</section>
{/if}
