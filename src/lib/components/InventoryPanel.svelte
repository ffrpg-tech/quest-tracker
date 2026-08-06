<script lang="ts">
	import { Upload, Trash2, X, TriangleAlert } from '@lucide/svelte';
	import { buttonClass } from '$lib/ui/buttonClass';
	import { matchesQuery } from '$lib/ui/matchesQuery';
	import type { InventoryEntry } from '$lib/quest/types';
	import { buddyFarmItemUrl } from '$lib/ui/buddyFarmLink';
	import ItemIcon from './ItemIcon.svelte';

	let {
		inventory = $bindable(),
		inventoryStale,
		onOpenImport
	}: {
		inventory: InventoryEntry[];
		inventoryStale: boolean;
		onOpenImport: () => void;
	} = $props();

	let inventoryQuery = $state('');

	const filteredInventory = $derived(inventory.filter((e) => matchesQuery(e.item, inventoryQuery)));

	/** Directly editing a row's Qty field is the only way to update an existing item's quantity — there's no separate "manual entry" form duplicating the table. Clamps rather than rejecting invalid input (negative, empty, non-numeric) — silently no-op'ing left the input showing whatever the user typed while state stayed unchanged underneath it, since the field's displayed value only resyncs when the bound state actually changes. Clears `maxed` on edit: a maxed entry's qty is trusted as the item's real storage cap, and a manual edit invalidates that — the new number is the player's own claim, not a re-observed "MAX ON HAND" from a paste. */
	function updateItemQty(name: string, qty: number) {
		const clamped = Number.isFinite(qty) ? Math.max(0, qty) : 0;
		inventory = inventory.map((e) => (e.item === name ? { ...e, qty: clamped, maxed: false } : e));
	}

	function removeItem(name: string) {
		inventory = inventory.filter((e) => e.item !== name);
	}

	function clearInventoryTable() {
		if (inventory.length === 0 || confirm(`Clear all ${inventory.length} inventory items?`)) {
			inventory = [];
		}
	}
</script>

<div
	class="flex min-h-0 flex-col space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
>
	<div class="flex items-center justify-between">
		<h2 class="font-semibold">2. Inventory ({inventory.length})</h2>
		<div class="flex items-center gap-1">
			<button
				onclick={onOpenImport}
				title="Import inventory"
				aria-label="Import inventory"
				class={buttonClass('icon')}
			>
				<Upload size={16} class="text-sky-600 dark:text-sky-400" />
			</button>
			{#if inventory.length > 0}
				<button
					onclick={clearInventoryTable}
					title="Clear inventory"
					aria-label="Clear inventory"
					class={buttonClass('icon-danger')}
				>
					<Trash2 size={16} />
				</button>
			{/if}
		</div>
	</div>

	{#if inventoryStale}
		<div
			class="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
		>
			<TriangleAlert size={14} class="mt-0.5 shrink-0" />
			<span
				>You've checked off quests since your last inventory paste — re-paste your inventory to keep
				shortfall numbers accurate.</span
			>
		</div>
	{/if}

	{#if inventory.length > 0}
		<div class="relative">
			<input
				bind:value={inventoryQuery}
				placeholder="Search current inventory…"
				aria-label="Search current inventory"
				class="w-full rounded border border-gray-300 p-1.5 pr-9 text-sm transition-colors hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500"
			/>
			{#if inventoryQuery}
				<button
					onclick={() => (inventoryQuery = '')}
					aria-label="Clear inventory search"
					title="Clear inventory search"
					class="absolute top-1/2 right-3 -translate-y-1/2 {buttonClass('icon-danger')}"
				>
					<X size={14} />
				</button>
			{/if}
		</div>
	{/if}
	<div
		class="relative min-h-0 max-h-[100vh] flex-1 overflow-auto rounded border border-gray-100 dark:border-gray-700"
	>
		<table class="w-full table-fixed text-sm">
			<thead
				class="sticky top-0 z-10 bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400"
			>
				<tr>
					<th class="p-2">Item</th>
					<th class="w-24 p-2">Qty</th>
					<th class="w-10 p-2"></th>
				</tr>
			</thead>
			<tbody>
				{#each filteredInventory as entry (entry.item)}
					<tr class="border-t border-gray-100 dark:border-gray-700">
						<td class="p-2">
							<div class="flex items-center gap-1.5">
								<ItemIcon name={entry.item} />
								<a
									href={buddyFarmItemUrl(entry.item)}
									target="_blank"
									rel="noopener noreferrer"
									class="hover:underline">{entry.item}</a
								>{#if entry.maxed}<span class="text-red-600 dark:text-red-400"> (MAX)</span>{/if}
							</div>
						</td>
						<td class="p-2">
							<input
								type="number"
								value={entry.qty}
								min="0"
								aria-label="Qty for {entry.item}"
								onchange={(e) => updateItemQty(entry.item, Number(e.currentTarget.value))}
								class="w-20 rounded border border-gray-300 p-1 text-sm tabular-nums transition-colors hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500"
							/>
						</td>
						<td class="p-2 text-right">
							<button
								onclick={() => removeItem(entry.item)}
								aria-label="Remove {entry.item}"
								title="Remove"
								class={buttonClass('icon-danger')}
							>
								<X size={14} />
							</button>
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="3" class="p-4 text-center text-xs text-gray-400">
							{inventory.length === 0
								? 'No items yet — import a dump to get started.'
								: 'No items match that search.'}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
