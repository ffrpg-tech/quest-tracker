<script lang="ts">
	import { Check, ChevronDown, ChevronRight } from '@lucide/svelte';
	import { buddyFarmItemUrl } from '$lib/ui/buddyFarmLink';
	import { formatNumber } from '$lib/ui/formatNumber';
	import type { CraftTreeNode as CraftTreeNodeData } from '$lib/quest/calc/recipes';
	import ItemIcon from './ItemIcon.svelte';
	import CraftTreeNodeComponent from './CraftTreeNode.svelte';

	let {
		node,
		showAllItems = false,
		hideCannotMail
	}: { node: CraftTreeNodeData; showAllItems?: boolean; hideCannotMail?: boolean } = $props();
	let expanded = $state(false);

	const satisfied = $derived(node.left <= 0);
	const hasChildren = $derived(node.craftable && node.children.length > 0);
	const isReady = $derived(node.left <= 0 && node.craftableQty > 0);
</script>

<div class="border-l-2 border-gray-200 pl-2 dark:border-gray-700">
	<div
		class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs {satisfied ? 'opacity-50' : ''}"
	>
		<span class="inline-flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
			<ItemIcon name={node.item} {hideCannotMail} cannotMailFormat="icon" />
			<a
				href={buddyFarmItemUrl(node.item)}
				target="_blank"
				rel="noopener noreferrer"
				class="hover:underline">{node.item}</a
			>
		</span>
		<span class="inline-flex items-center gap-1 tabular-nums">
			<span>{formatNumber(node.have)} / {formatNumber(node.needed)}</span>
			{#if satisfied}
				<Check
					size={13}
					class="shrink-0 text-emerald-600 dark:text-emerald-400"
					aria-label="Satisfied"
				/>
			{:else}
				<span class="font-semibold text-red-600 dark:text-red-400"
					>({formatNumber(node.left)} left)</span
				>
			{/if}
			{#if node.craftableQty > 0}
				<span class="text-violet-600 dark:text-violet-400"
					>(+{formatNumber(node.craftableQty)})</span
				>
			{/if}
		</span>
		{#if hasChildren}
			<button
				type="button"
				onclick={() => (expanded = !expanded)}
				aria-expanded={expanded}
				class="inline-flex shrink-0 items-center gap-1 text-sky-700 hover:underline dark:text-sky-400"
			>
				{#if expanded}<ChevronDown size={13} />{:else}<ChevronRight size={13} />{/if}
				<span>{expanded ? 'Hide' : 'Craft Tree'}</span>
				{#if !expanded && isReady}
					<span
						class="rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
					>
						Ready
					</span>
				{/if}
			</button>
		{/if}
	</div>

	{#if expanded}
		<div class="mt-1 space-y-1" style="content-visibility: auto;">
			{#each node.children as child (child.item)}
				{#if showAllItems || child.left > 0}
					<CraftTreeNodeComponent node={child} {showAllItems} {hideCannotMail} />
				{/if}
			{/each}
		</div>
	{/if}
</div>
