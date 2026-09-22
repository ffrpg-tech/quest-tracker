<script lang="ts">
	import { Upload, Trash2, X } from '@lucide/svelte';
	import { buttonClass } from '$lib/ui/buttonClass';
	import { matchesQuery } from '$lib/ui/matchesQuery';
	import { getNpcImagePath, getNpcsState, retryNpcs } from '$lib/quest/storage/npcsStore.svelte';
	import type { PlayerStats } from '$lib/quest/types';

	let {
		playerStats,
		onOpenImport,
		onClear,
		onUpdate
	}: {
		playerStats: PlayerStats | null;
		onOpenImport: () => void;
		onClear: () => void;
		onUpdate: (stats: PlayerStats) => void;
	} = $props();

	const npcsState = getNpcsState();

	const SKILLS: { key: keyof Omit<PlayerStats, 'npcLevels'>; label: string }[] = [
		{ key: 'farming', label: 'Farming' },
		{ key: 'fishing', label: 'Fishing' },
		{ key: 'crafting', label: 'Crafting' },
		{ key: 'exploring', label: 'Exploring' },
		{ key: 'cooking', label: 'Cooking' },
		{ key: 'mining', label: 'Mining' },
		{ key: 'tower', label: 'Tower' }
	];

	let npcQuery = $state('');

	const npcRows = $derived(
		playerStats
			? Object.entries(playerStats.npcLevels)
					.filter(([name]) => matchesQuery(name, npcQuery))
					.sort(([a], [b]) => a.localeCompare(b))
			: []
	);

	function clearStats() {
		if (confirm('Clear your pasted player stats? This also hides the eligibility filter and lock badges.')) {
			onClear();
		}
	}

	// Manual edits go through the same eligibility engine as a fresh paste — a
	// player who just leveled up (or wants to correct a mis-parsed value)
	// shouldn't have to re-paste the whole profile page to update one number.
	// Clamps rather than rejecting invalid input, same rationale as
	// InventoryPanel's `updateItemQty`: silently no-op'ing leaves the input
	// showing whatever the user typed while the bound state stays unchanged.
	function parseLevel(raw: string): number {
		const n = Number(raw);
		return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
	}

	function updateSkill(key: keyof Omit<PlayerStats, 'npcLevels'>, raw: string) {
		if (!playerStats) return;
		onUpdate({ ...playerStats, [key]: parseLevel(raw) });
	}

	function updateNpcLevel(name: string, raw: string) {
		if (!playerStats) return;
		onUpdate({ ...playerStats, npcLevels: { ...playerStats.npcLevels, [name]: parseLevel(raw) } });
	}
</script>

<div
	class="flex min-h-0 flex-col space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
>
	<div class="flex items-center justify-between">
		<h2 class="font-semibold">Player stats</h2>
		<div class="flex items-center gap-1">
			<button
				onclick={onOpenImport}
				title="Import player stats"
				aria-label="Import player stats"
				class={buttonClass('icon')}
			>
				<Upload size={16} class="text-sky-600 dark:text-sky-400" />
			</button>
			{#if playerStats}
				<button
					onclick={clearStats}
					title="Clear player stats"
					aria-label="Clear player stats"
					class={buttonClass('icon-danger')}
				>
					<Trash2 size={16} />
				</button>
			{/if}
		</div>
	</div>

	{#if npcsState.npcsError}
		<p class="flex items-center justify-center gap-2 text-center text-xs text-red-600 dark:text-red-400">
			NPC data failed to load — friendship names/images may be missing or incomplete.
			<button onclick={() => retryNpcs()} class={buttonClass('link')}>Retry</button>
		</p>
	{/if}

	{#if !playerStats}
		<p class="p-4 text-center text-xs text-gray-400">
			No stats yet — import your "My Profile" page to unlock the eligibility filter and lock
			badges on the questline list.
		</p>
	{:else}
		<div class="grid grid-cols-4 gap-2 text-center text-xs sm:grid-cols-7">
			{#each SKILLS as skill (skill.key)}
				<div class="rounded border border-gray-100 p-1.5 dark:border-gray-700">
					<label class="text-gray-500 dark:text-gray-400" for="stat-{skill.key}">{skill.label}</label>
					<input
						id="stat-{skill.key}"
						type="number"
						inputmode="numeric"
						min="0"
						value={playerStats[skill.key]}
						onchange={(e) => updateSkill(skill.key, e.currentTarget.value)}
						class="w-full rounded border border-gray-300 bg-transparent text-center tabular-nums font-semibold hover:border-gray-400 focus:border-sky-500 focus:outline-none dark:border-gray-600 dark:hover:border-gray-500"
					/>
				</div>
			{/each}
		</div>

		{#if Object.keys(playerStats.npcLevels).length === 0}
			<p class="p-2 text-center text-xs text-gray-400">
				No friendship levels found in that paste — try re-copying the full "My Profile" page.
			</p>
		{:else}
			<div class="relative">
				<input
					bind:value={npcQuery}
					placeholder="Search NPC"
					aria-label="Search NPC"
					class="w-full rounded border border-gray-300 p-1.5 pr-9 text-sm transition-colors hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500"
				/>
				{#if npcQuery}
					<button
						onclick={() => (npcQuery = '')}
						aria-label="Clear friendship search"
						title="Clear friendship search"
						class="absolute top-1/2 right-3 -translate-y-1/2 {buttonClass('icon-danger')}"
					>
						<X size={14} />
					</button>
				{/if}
			</div>
			<div class="min-h-0 max-h-48 flex-1 overflow-auto rounded border border-gray-100 dark:border-gray-700">
				{#if npcRows.length === 0}
					<p class="p-2 text-center text-xs text-gray-400">No NPCs match that search.</p>
				{:else}
					<ul class="grid grid-cols-1 gap-x-4 gap-y-1 p-1.5 text-sm sm:grid-cols-3">
						{#each npcRows as [name, level] (name)}
							<li
								class="flex items-center justify-between gap-2 rounded px-1.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-800"
							>
								<span class="flex min-w-0 items-center gap-1.5 truncate" title={name}>
									{#if getNpcImagePath(name)}
										<img
											src={getNpcImagePath(name)}
											alt=""
											width="16"
											height="16"
											class="inline-block shrink-0"
											loading="lazy"
										/>
									{/if}
									<span class="min-w-0 truncate">{name}</span>
								</span>
								<span class="flex shrink-0 items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
									Lvl
									<input
										type="number"
										inputmode="numeric"
										min="0"
										value={level}
										aria-label="{name} friendship level"
										onchange={(e) => updateNpcLevel(name, e.currentTarget.value)}
										class="w-12 rounded border border-gray-300 bg-transparent text-right tabular-nums hover:border-gray-400 focus:border-sky-500 focus:outline-none dark:border-gray-600 dark:hover:border-gray-500"
									/>
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}
	{/if}
</div>
