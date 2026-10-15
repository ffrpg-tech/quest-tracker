<script lang="ts">
	import { X, Copy, Check, MessageSquare, Info, ChevronDown } from '@lucide/svelte';
	import { buttonClass } from '$lib/ui/buttonClass';
	import { trapFocus } from '$lib/ui/trapFocus';
	import { copyToClipboard } from '$lib/ui/clipboard';
	import {
		generateRequestList,
		type RequestListInputItem,
		type RequestListChunk
	} from '$lib/quest/export/requestList';

	let {
		open = $bindable(false),
		items,
		maxedItems,
		scopeTitle = 'Current Queue'
	}: {
		open: boolean;
		items: RequestListInputItem[];
		maxedItems?: Set<string>;
		scopeTitle?: string;
	} = $props();

	let deductCraftable = $state(true);
	let excludeMaxed = $state(true);
	let showUnmailableDetails = $state(false);

	let copiedAll = $state(false);
	let copiedChunkIndex = $state<number | null>(null);

	const filteredItems = $derived(items.filter((it) => !excludeMaxed || !maxedItems?.has(it.item)));
	const excludedMaxedCount = $derived(
		maxedItems && excludeMaxed ? items.filter((it) => maxedItems.has(it.item)).length : 0
	);

	const result = $derived(generateRequestList(filteredItems, { deductCraftable }));

	async function handleCopyAll() {
		if (!result.allText) return;
		const ok = await copyToClipboard(result.allText);
		if (ok) {
			copiedAll = true;
			setTimeout(() => {
				copiedAll = false;
			}, 2000);
		}
	}

	async function handleCopyChunk(chunk: RequestListChunk, index: number) {
		const ok = await copyToClipboard(chunk.text);
		if (ok) {
			copiedChunkIndex = index;
			setTimeout(() => {
				if (copiedChunkIndex === index) copiedChunkIndex = null;
			}, 2000);
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
			class="flex max-h-[90vh] w-full max-w-xl flex-col rounded-lg bg-white p-5 shadow-xl dark:bg-gray-800 dark:text-gray-100"
			role="dialog"
			aria-modal="true"
			aria-labelledby="request-list-modal-title"
			use:trapFocus={() => (open = false)}
		>
			<!-- Header -->
			<div
				class="mb-3 flex items-start justify-between border-b border-gray-100 pb-3 dark:border-gray-700"
			>
				<div>
					<div class="flex items-center gap-2">
						<MessageSquare size={18} class="text-emerald-600 dark:text-emerald-400" />
						<h2 id="request-list-modal-title" class="text-base font-semibold">
							In-Game Request List
						</h2>
					</div>
					<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
						Ready for Giveaways, Trade chat, and mailbox threads &bull; <span class="font-medium"
							>{scopeTitle}</span
						>
					</p>
				</div>
				<button onclick={() => (open = false)} class={buttonClass('icon')} aria-label="Close modal">
					<X size={16} />
				</button>
			</div>

			<!-- Options bar -->
			<div class="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
				<div class="flex flex-wrap items-center gap-3">
					<label class="flex cursor-pointer items-center gap-1.5 text-gray-700 dark:text-gray-300">
						<input
							type="checkbox"
							bind:checked={deductCraftable}
							class="h-3.5 w-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
						/>
						<span>Deduct craftable materials (ask only for net deficits)</span>
					</label>

					{#if maxedItems && maxedItems.size > 0}
						<label
							class="flex cursor-pointer items-center gap-1.5 text-gray-700 dark:text-gray-300"
						>
							<input
								type="checkbox"
								bind:checked={excludeMaxed}
								class="h-3.5 w-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
							/>
							<span>Exclude items at MAX ON HAND (inventory full)</span>
						</label>
					{/if}
				</div>

				{#if result.chunks.length > 0}
					<button
						type="button"
						onclick={handleCopyAll}
						class="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800 dark:bg-emerald-700 dark:hover:bg-emerald-600 cursor-pointer"
					>
						{#if copiedAll}
							<Check size={13} />
							<span>Copied All!</span>
						{:else}
							<Copy size={13} />
							<span
								>Copy All ({result.chunks.length}
								{result.chunks.length === 1 ? 'msg' : 'msgs'})</span
							>
						{/if}
					</button>
				{/if}
			</div>

			<!-- Main content / chunks list -->
			<div class="flex-1 space-y-3 overflow-y-auto pr-1">
				{#if result.chunks.length === 0}
					<div
						class="rounded-md border border-gray-200 bg-gray-50 p-4 text-center dark:border-gray-700 dark:bg-gray-800/60"
					>
						<p class="text-sm font-medium text-gray-700 dark:text-gray-300">
							No mailable deficit items found!
						</p>
						<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
							{#if excludedMaxedCount > 0 && items.length === excludedMaxedCount}
								All deficit items in this view are currently at MAX ON HAND in your inventory.
							{:else if result.excludedUnmailable.length > 0}
								All shortfalls are non-mailable items (such as Iron or Large Chests).
							{:else}
								All quest requirements in this selection are already satisfied in your inventory.
							{/if}
						</p>
					</div>
				{:else}
					{#each result.chunks as chunk, idx (chunk.text + idx)}
						<div
							class="rounded-md border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-900/50"
						>
							<div class="mb-1.5 flex items-center justify-between text-xs">
								<span class="font-medium text-gray-600 dark:text-gray-400">
									{#if result.chunks.length > 1}
										Message {idx + 1} of {result.chunks.length}
									{:else}
										Chat Message
									{/if}
								</span>
								<div class="flex items-center gap-2">
									<span
										class="tabular-nums font-mono text-[11px] {chunk.length <= 250
											? 'text-gray-400 dark:text-gray-500'
											: 'text-red-500 font-semibold'}"
									>
										{chunk.length} / 250 chars
									</span>
									<button
										type="button"
										onclick={() => handleCopyChunk(chunk, idx)}
										class="inline-flex cursor-pointer items-center gap-1 rounded bg-white px-2 py-0.5 text-xs font-medium text-gray-700 shadow-xs border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
									>
										{#if copiedChunkIndex === idx}
											<Check size={12} class="text-emerald-600 dark:text-emerald-400" />
											<span class="text-emerald-600 dark:text-emerald-400">Copied!</span>
										{:else}
											<Copy size={12} />
											<span>Copy</span>
										{/if}
									</button>
								</div>
							</div>

							<div
								class="select-all rounded border border-gray-200 bg-white p-2 font-mono text-xs break-all text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
							>
								{chunk.text}
							</div>
						</div>
					{/each}
				{/if}

				<!-- Excluded Unmailable Notice -->
				{#if result.excludedUnmailable.length > 0}
					<div
						class="rounded border border-amber-200 bg-amber-50/70 p-2.5 text-xs dark:border-amber-900/40 dark:bg-amber-950/20"
					>
						<button
							type="button"
							onclick={() => (showUnmailableDetails = !showUnmailableDetails)}
							class="flex w-full cursor-pointer items-center justify-between text-left text-amber-800 dark:text-amber-300"
						>
							<span class="flex items-center gap-1.5 font-medium">
								<Info size={14} />
								<span>
									Excluded {result.excludedUnmailable.length} non-mailable {result
										.excludedUnmailable.length === 1
										? 'item'
										: 'items'}
								</span>
							</span>
							<ChevronDown
								size={14}
								class="transition-transform duration-150 {showUnmailableDetails
									? 'rotate-180'
									: ''}"
							/>
						</button>
						{#if showUnmailableDetails}
							<div
								class="mt-2 text-[11px] text-amber-700 dark:text-amber-400 border-t border-amber-200/50 pt-1.5 dark:border-amber-900/30"
							>
								<p class="mb-1 text-gray-500 dark:text-gray-400">
									These items cannot be mailed or traded in Farm RPG:
								</p>
								<div class="flex flex-wrap gap-1">
									{#each result.excludedUnmailable as unmailable (unmailable.item)}
										<span
											class="rounded bg-amber-100/80 px-1.5 py-0.5 font-mono text-[10px] dark:bg-amber-900/40"
										>
											{unmailable.item} &times;{unmailable.qty}
										</span>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div
				class="mt-3 flex items-center justify-end border-t border-gray-100 pt-3 dark:border-gray-700"
			>
				<button
					type="button"
					onclick={() => (open = false)}
					class="{buttonClass('default')} text-xs"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
