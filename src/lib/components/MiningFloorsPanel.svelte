<script lang="ts">
	import { Upload, Trash2, X } from '@lucide/svelte';
	import { buttonClass } from '$lib/ui/buttonClass';
	import { matchesQuery } from '$lib/ui/matchesQuery';
	import type { PlayerStats } from '$lib/quest/types';
	import { getMiningImagePath } from '$lib/quest/storage/miningStore.svelte';

	let {
		miningFloorsStats,
		hasPlayerStats,
		onOpenImport,
		onOpenStatsImport,
		onClear,
		onUpdate
	}: {
		miningFloorsStats: PlayerStats['miningFloors'] | null;
		hasPlayerStats: boolean;
		onOpenImport: () => void;
		onOpenStatsImport: () => void;
		onClear: () => void;
		onUpdate: (floors: Record<string, number>) => void;
	} = $props();

	const MINING_FLOORS: { key: string; label: string }[] = [
		{ key: 'springCave', label: 'Spring Cave' },
		{ key: 'highlandHollow', label: 'Highland Hollow' },
		{ key: 'solGrotto', label: 'Sol Grotto' },
		{ key: 'emberCaverns', label: 'Ember Caverns' },
		{ key: 'fenrirsDen', label: "Fenrir's Den" },
		{ key: 'mossrockMine', label: 'Mossrock Mine' }
	];

	function clearStats() {
		if (
			confirm(
				'Clear your pasted mining floor stats? This also hides the eligibility filter and lock badges.'
			)
		) {
			onClear();
		}
	}

	function parseLevel(raw: string): number {
		const n = Number(raw);
		return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
	}

	function updateMiningFloor(key: string, raw: string) {
		if (!miningFloorsStats) return;

		const n = Number(raw);
		const value = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;

		onUpdate({
			...miningFloorsStats,
			[key]: value
		});
	}
</script>

<div
	class="flex h-full min-h-0 flex-col space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
>
	<div class="flex items-center justify-between">
		<h2 class="font-semibold">Mining Floors</h2>
		<div class="flex items-center gap-1">
			<button
				onclick={onOpenImport}
				title="Import mining floor stats"
				aria-label="Import mining floor stats"
				class={buttonClass('icon')}
			>
				<Upload size={16} class="text-sky-600 dark:text-sky-400" />
			</button>
			{#if miningFloorsStats}
				<button
					onclick={clearStats}
					title="Clear mining floor stats"
					aria-label="Clear mining floor stats"
					class={buttonClass('icon-danger')}
				>
					<Trash2 size={16} />
				</button>
			{/if}
		</div>
	</div>

	{#if miningFloorsStats}
		<div class="flex flex-1 flex-col justify-between space-y-1">
			{#each MINING_FLOORS as { key, label }}
				<div class="flex items-center gap-2 text-sm">
					<img
						src={getMiningImagePath(label)}
						alt={label}
						class="h-6 w-6 shrink-0 rounded object-contain"
					/>
					<label for={key} class="w-[120px] shrink-0 font-semibold">{label}</label>
					<input
						id={key}
						type="number"
						min="0"
						value={miningFloorsStats?.[key] ?? 0}
						onchange={(e) => updateMiningFloor(key, e.currentTarget.value)}
						class="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-sky-500 focus:ring-sky-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-sky-400 dark:focus:ring-sky-400"
					/>
				</div>
			{/each}
		</div>
	{:else}
		{#if hasPlayerStats}
			<p class="text-sm text-gray-500">
				No mining floor stats available. Import or paste your mining floor stats to view and edit
				them.
			</p>
		{:else}
			<p class="text-sm text-gray-500">
				Import your player stats first, then add your mining floor stats.
			</p>
			<button onclick={onOpenStatsImport} class={buttonClass('link')}>Go to Player Stats</button>
		{/if}
	{/if}
</div>
