<script lang="ts">
	import { ChevronDown, ChevronRight } from '@lucide/svelte';
	import type { CraftTreeNode } from '$lib/quest/calc/recipes';
	import CraftTreeNodeComponent from './CraftTreeNode.svelte';

	let {
		node,
		showAllItems = false,
		hideCannotMail = false
	}: {
		node: CraftTreeNode;
		showAllItems?: boolean;
		hideCannotMail?: boolean;
	} = $props();

	let expanded = $state(false);

	const isReady = $derived(node.left <= 0 && node.craftableQty > 0);
</script>

{#if node.craftable && node.children.length > 0}
	<button
		type="button"
		onclick={() => (expanded = !expanded)}
		aria-expanded={expanded}
		class="inline-flex cursor-pointer items-center gap-0.5 text-xs text-sky-700 hover:underline dark:text-sky-400"
	>
		{#if expanded}<ChevronDown size={12} />{:else}<ChevronRight size={12} />{/if}
		<span>{expanded ? 'Hide' : 'Craft Tree'}</span>
		{#if !expanded && isReady}
			<span
				class="rounded bg-emerald-100 px-1 py-0.2 text-[9px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
			>
				Ready
			</span>
		{/if}
	</button>
	{#if expanded}
		<div
			class="mt-1 w-full basis-full space-y-1 border-l border-gray-200 pl-2.5 dark:border-gray-700"
		>
			{#each node.children as child (child.item)}
				{#if showAllItems || child.left > 0}
					<CraftTreeNodeComponent node={child} {showAllItems} {hideCannotMail} />
				{/if}
			{/each}
		</div>
	{/if}
{/if}
