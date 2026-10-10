<script lang="ts">
	import { X, Lock, ChevronDown } from '@lucide/svelte';
	import {
		resolveItemSources,
		getFullSourceImageUrl,
		isImageFailed,
		markImageFailed,
		type ResolvedSource
	} from '$lib/quest/storage/sourcesStore.svelte';
	import type { PlayerStats } from '$lib/quest/types';

	let {
		itemName,
		playerStats = null,
		showAlternativeSources = true
	}: {
		itemName: string;
		playerStats?: PlayerStats | null;
		showAlternativeSources?: boolean;
	} = $props();

	const resolution = $derived(resolveItemSources(itemName, playerStats));
	const primary = $derived(resolution.primary);
	const secondary = $derived(resolution.secondary);

	let showSecondary = $state(false);
	let popoverContainer: HTMLDivElement | null = $state(null);

	function toggleSecondary(e: MouseEvent) {
		e.stopPropagation();
		showSecondary = !showSecondary;
	}

	function closeSecondary() {
		showSecondary = false;
	}

	function handleWindowClick(e: MouseEvent) {
		if (showSecondary && popoverContainer && !popoverContainer.contains(e.target as Node)) {
			showSecondary = false;
		}
	}

	/** Normalizes source names: compacts Wishing Well, Exchange Center, and Pet tiers */
	function formatSourceName(source: ResolvedSource): string {
		if (source.type === 'well' || source.type === 'exchange') {
			return source.name;
		}
		if (source.type === 'pet' && source.tier) {
			const lvlMatch = source.tier.match(/\d+/);
			return lvlMatch ? `${source.name} (Lvl ${lvlMatch[0]})` : `${source.name} (${source.tier})`;
		}
		return source.tier ? `${source.name} (${source.tier})` : source.name;
	}
</script>

<svelte:window onclick={handleWindowClick} />

{#if primary}
	<span class="relative inline-flex items-center gap-1 text-xs">
		<!-- Primary Source Link or Text -->
		{#if primary.buddyUrl}
			<a
				href={primary.buddyUrl}
				target="_blank"
				rel="noopener noreferrer"
				title={primary.tier ? `${primary.name} • ${primary.tier}` : primary.name}
				class="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline dark:text-sky-400"
				class:opacity-60={!primary.unlocked}
			>
				{#if primary.image && !isImageFailed(primary.image)}
					<img
						src={getFullSourceImageUrl(primary.image)}
						alt=""
						width="13"
						height="13"
						class="inline-block shrink-0 object-contain"
						loading="lazy"
						onerror={() => markImageFailed(primary.image)}
					/>
				{/if}
				<span>{formatSourceName(primary)}</span>
			</a>
		{:else}
			<span
				title={primary.tier ? `${primary.name} • ${primary.tier}` : primary.name}
				class="inline-flex items-center gap-1 font-medium text-sky-700 dark:text-sky-400"
				class:opacity-60={!primary.unlocked}
			>
				{#if primary.image && !isImageFailed(primary.image)}
					<img
						src={getFullSourceImageUrl(primary.image)}
						alt=""
						width="13"
						height="13"
						class="inline-block shrink-0 object-contain"
						loading="lazy"
						onerror={() => markImageFailed(primary.image)}
					/>
				{/if}
				<span>{formatSourceName(primary)}</span>
			</span>
		{/if}

		<!-- Lock indicator if locked -->
		{#if !primary.unlocked}
			<span
				title="Requires {primary.reqSkill} level {primary.reqLevel}"
				class="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400"
			>
				<Lock size={10} />
				<span>L{primary.reqLevel}</span>
			</span>
		{/if}

		<!-- Secondary sources count trigger -->
		{#if showAlternativeSources && secondary.length > 0}
			<button
				type="button"
				onclick={toggleSecondary}
				aria-expanded={showSecondary}
				title="View {secondary.length} other sources for {itemName}"
				class="inline-flex cursor-pointer items-center gap-0.5 text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
			>
				<span>(+{secondary.length} more)</span>
				<ChevronDown size={11} class="transition-transform {showSecondary ? 'rotate-180' : ''}" />
			</button>
		{/if}

		<!-- Floating popover with secondary sources (completely unmounted when closed) -->
		{#if showAlternativeSources && showSecondary}
			<div
				bind:this={popoverContainer}
				class="absolute left-0 top-full z-40 mt-1 max-h-56 w-64 overflow-y-auto rounded-md border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
				role="region"
				aria-label="Other sources for {itemName}"
			>
				<div class="mb-1.5 flex items-center justify-between border-b border-gray-100 pb-1 dark:border-gray-700">
					<span class="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
						Other Sources ({secondary.length})
					</span>
					<button
						type="button"
						onclick={closeSecondary}
						aria-label="Close"
						class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
					>
						<X size={12} />
					</button>
				</div>
				<ul class="space-y-1 text-[11px]">
					{#each secondary as sec (sec.locId + (sec.tier ?? ''))}
						<li class="flex items-center justify-between gap-1 py-0.5">
							<div class="flex min-w-0 items-center gap-1">
								{#if sec.image && !isImageFailed(sec.image)}
									<img
										src={getFullSourceImageUrl(sec.image)}
										alt=""
										width="12"
										height="12"
										class="inline-block shrink-0 object-contain"
										loading="lazy"
										onerror={() => markImageFailed(sec.image)}
									/>
								{/if}
								{#if sec.buddyUrl}
									<a
										href={sec.buddyUrl}
										target="_blank"
										rel="noopener noreferrer"
										class="truncate text-sky-700 hover:text-sky-800 hover:underline dark:text-sky-400 dark:hover:text-sky-300"
									>
										{formatSourceName(sec)}
									</a>
								{:else}
									<span class="truncate text-gray-700 dark:text-gray-300">
										{formatSourceName(sec)}
									</span>
								{/if}
								{#if (sec.type === 'well' || sec.type === 'exchange') && sec.tier}
									<span class="text-[10px] text-gray-400 shrink-0">({sec.tier})</span>
								{/if}
							</div>
							<div class="flex shrink-0 items-center gap-1 text-[10px]">
								{#if !sec.unlocked}
									<span class="font-medium text-amber-600 dark:text-amber-400">
										Req. {sec.reqLevel}
									</span>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</span>
{/if}
