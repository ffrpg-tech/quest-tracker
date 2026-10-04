<script lang="ts">
	import { ChevronDown, ChevronRight } from '@lucide/svelte';
	import type { CraftTreeNode } from '$lib/quest/calc/recipes';
	import CraftTreeNodeComponent from './CraftTreeNode.svelte';

	let { node, showAllItems = false, hideCannotMail = false }: { node: CraftTreeNode; showAllItems?: boolean, hideCannotMail?: boolean } = $props();
	let expanded = $state(false);
</script>

{#if node.craftable && node.children.length > 0}
	<div class="">
		<button
			type="button"
			onclick={() => (expanded = !expanded)}
			aria-expanded={expanded}
			class="inline-flex items-center gap-0.5 text-xs text-sky-700 hover:underline dark:text-sky-400"
		>
			{#if expanded}<ChevronDown size={13} />{:else}<ChevronRight size={13} />{/if}
			{expanded ? 'Hide' : 'Craft Tree'}
		</button>
		{#if expanded}
			<div class="mt-1 space-y-1 border-l-2 border-gray-200 pl-2 dark:border-gray-700">
				{#each node.children as child (child.item)}
					{#if showAllItems || child.left > 0}
						<CraftTreeNodeComponent node={child} {showAllItems} {hideCannotMail} />
					{/if}
				{/each}
			</div>
		{/if}
	</div>
{/if}
