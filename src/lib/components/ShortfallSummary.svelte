<script lang="ts">
	import { ChevronRight, Search } from '@lucide/svelte';
	import { matchesQuery } from '$lib/ui/matchesQuery';
	import { buttonClass } from '$lib/ui/buttonClass';
	import { getItemCanMail } from '$lib/quest/storage/itemsStore.svelte';
	import { buddyFarmItemUrl } from '$lib/ui/buddyFarmLink';
	import type { ItemRunsDryAt, QuestlineDiffResult, QueueItemShortfall } from '$lib/quest/calc/diff';
	import ItemIcon from './ItemIcon.svelte';

	let {
		diffResults,
		shortfallSummary,
		maxedItems,
		runsDryAt
	}: {
		diffResults: QuestlineDiffResult[];
		shortfallSummary: QueueItemShortfall[];
		/** Items the player's current pasted inventory reports as "MAX ON HAND" — surfaced as a MAXED badge so a still-short item is flagged as not worth farming further right now. */
		maxedItems: Set<string>;
		/** For each currently-maxed item, the exact (questline, quest) where its stockpile first runs out in queue order — surfaced as a RUNS DRY marker on that one entry below. */
		runsDryAt: Map<string, ItemRunsDryAt>;
	} = $props();

	let shortfallSearch = $state('');

	type MailFilter = 'mailable' | 'not-mailable';
	// Checkbox-style multi-select, both checked by default (no filtering).
	// An item with unknown canMail data always passes — this filter can only
	// narrow down items the data actually has an answer for.
	let mailFilters = $state<Set<MailFilter>>(new Set(['mailable', 'not-mailable']));

	function toggleMailFilter(value: MailFilter) {
		const next = new Set(mailFilters);
		if (next.has(value)) next.delete(value);
		else next.add(value);
		mailFilters = next;
	}

	function matchesMailFilter(item: string): boolean {
		const canMail = getItemCanMail(item);
		if (canMail === undefined) return true;
		return mailFilters.has(canMail ? 'mailable' : 'not-mailable');
	}

	// Off by default (no narrowing) — an opt-in way to jump straight to items
	// that are worth stopping farming for right now, in a long shortfall list.
	let maxedOnly = $state(false);

	const filteredShortfallSummary = $derived(
		shortfallSummary.filter(
			(s) =>
				matchesQuery(s.item, shortfallSearch) &&
				matchesMailFilter(s.item) &&
				(!maxedOnly || maxedItems.has(s.item))
		)
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
		"Your pasted inventory shows this item at \"MAX ON HAND\" right now — farming more of it won't add anything until some is spent, so focus on a different item instead.";

	const RUNS_DRY_EXPLANATION =
		"This is the first quest, in queue order, where this maxed item's stockpile actually falls short.";

	function isRunsDryHere(item: string, questlineName: string, questName: string): boolean {
		const loc = runsDryAt.get(item);
		return loc !== undefined && loc.questlineName === questlineName && loc.questName === questName;
	}
</script>

{#if shortfallSummary.length > 0}
	<section class="rounded-lg border border-gray-200 dark:border-gray-700">
		<details class="group">
			<summary
				class="flex cursor-pointer list-none items-center gap-1 p-4 font-semibold text-gray-900 dark:text-gray-100"
			>
				<ChevronRight size={16} class="shrink-0 transition-transform group-open:rotate-90" />
				{#if diffResults.length > 1}
					Shortfall summary — combined across {diffResults.length} questlines
				{:else}
					Shortfall summary — {diffResults[0].questlineName}
				{/if}
			</summary>
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
						bind:value={shortfallSearch}
						placeholder="Search items…"
						aria-label="Search items"
						class="w-full rounded border border-gray-300 bg-white py-1.5 pl-8 pr-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
					/>
				</div>
				<div class="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Filter by mailability">
					{#each [['mailable', 'Mailable'], ['not-mailable', 'Not mailable']] as [value, label] (value)}
						<button
							role="checkbox"
							onclick={() => toggleMailFilter(value as MailFilter)}
							class={buttonClass('pill', mailFilters.has(value as MailFilter))}
							aria-checked={mailFilters.has(value as MailFilter)}
						>
							{label}
						</button>
					{/each}
					<button
						role="checkbox"
						onclick={() => (maxedOnly = !maxedOnly)}
						class={buttonClass('pill', maxedOnly)}
						aria-checked={maxedOnly}
						title="Only show items currently at your known storage cap"
					>
						Maxed only
					</button>
				</div>
				{#if filteredShortfallSummary.length === 0}
					<p class="text-sm text-gray-500 dark:text-gray-400">
						No items match "{shortfallSearch}".
					</p>
				{:else}
					<ul
						class="grid max-h-[60vh] grid-cols-1 gap-x-6 gap-y-2 overflow-y-auto text-sm sm:grid-cols-3 md:max-h-none md:overflow-visible"
					>
						{#each filteredShortfallSummary as s (s.item)}
							<li class="border-b border-gray-100 py-1 dark:border-gray-700">
								<div class="flex items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100">
									<ItemIcon name={s.item} />
									<a href={buddyFarmItemUrl(s.item)} target="_blank" rel="noopener noreferrer" class="hover:underline"
										>{s.item}</a
									>
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
									{#if maxedItems.has(s.item)}
										<span
											title={MAXED_EXPLANATION}
											class="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300"
											>MAXED</span
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
									<span class="tabular-nums text-red-600 dark:text-red-400">−{s.short}</span>
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
														>−{ql.short}</span
													>
												</div>
											{/if}
											<ul class="space-y-0.5" class:pl-4={s.byQuestline.length > 1}>
												{#each ql.byQuest as bq (bq.seq)}
													<li class="flex justify-between text-gray-500 dark:text-gray-400">
														<span class="inline-flex items-center gap-1">
															{bq.questName}
															{#if isRunsDryHere(s.item, ql.questlineName, bq.questName)}
																<span
																	title={RUNS_DRY_EXPLANATION}
																	class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300"
																	>RUNS DRY HERE</span
																>
															{/if}
														</span>
														<span class="tabular-nums">−{bq.short}</span>
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
		</details>
	</section>
{/if}
