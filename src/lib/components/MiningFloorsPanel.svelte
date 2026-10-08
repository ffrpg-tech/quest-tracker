<script lang="ts">
	import { Upload, Trash2, ChevronDown } from '@lucide/svelte';
	import { buttonClass } from '$lib/ui/buttonClass';
	import type { PlayerStats } from '$lib/quest/types';
	import { getMiningImagePath } from '$lib/quest/storage/miningStore.svelte';

	let {
		miningFloorsStats,
		onOpenImport,
		onClear,
		onUpdate
	}: {
		miningFloorsStats: PlayerStats['miningFloors'] | null;
		onOpenImport: () => void;
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

	let isMiningOpen = $state(true);

	function clearStats() {
		if (confirm('Clear your mining floor stats? This also resets mining requirement checks.')) {
			onClear();
		}
	}

	function parseLevel(raw: string): number {
		const n = Number(raw);
		return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
	}

	function updateMiningFloor(key: string, raw: string) {
		const value = parseLevel(raw);
		const base = miningFloorsStats ?? {
			springCave: 0,
			highlandHollow: 0,
			solGrotto: 0,
			emberCaverns: 0,
			fenrirsDen: 0,
			mossrockMine: 0
		};

		onUpdate({
			...base,
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

	<!-- Mining Floors Accordion -->
	<div class="rounded border border-gray-100 dark:border-gray-700">
		<button
			type="button"
			onclick={() => (isMiningOpen = !isMiningOpen)}
			aria-expanded={isMiningOpen}
			class="flex w-full items-center justify-between bg-gray-50/80 px-3 py-1.5 text-left text-xs font-medium hover:bg-gray-100 dark:bg-gray-800/80 dark:hover:bg-gray-800"
		>
			<span>Floors ({MINING_FLOORS.length})</span>
			<ChevronDown
				size={14}
				class="transition-transform duration-200 {isMiningOpen ? 'rotate-180' : ''}"
			/>
		</button>

		{#if isMiningOpen}
			<div class="flex flex-1 flex-col justify-between space-y-1.5 p-2">
				{#each MINING_FLOORS as { key, label } (key)}
					<div class="flex items-center gap-2 text-xs">
						<img
							src={getMiningImagePath(label)}
							alt={label}
							class="h-5 w-5 shrink-0 rounded object-contain"
						/>
						<label for={key} class="w-[100px] shrink-0 font-medium truncate sm:w-[110px]"
							>{label}</label
						>
						<input
							id={key}
							type="number"
							min="0"
							value={miningFloorsStats?.[key] ?? 0}
							onchange={(e) => updateMiningFloor(key, e.currentTarget.value)}
							class="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-sky-500 focus:ring-sky-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-sky-400 dark:focus:ring-sky-400"
						/>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
