<script lang="ts">
	import { Upload, Trash2, X, ChevronDown } from '@lucide/svelte';
	import { buttonClass } from '$lib/ui/buttonClass';
	import { matchesQuery } from '$lib/ui/matchesQuery';
	import {
		getNpcImagePath,
		getNpcsState,
		getNpcNames,
		retryNpcs
	} from '$lib/quest/storage/npcsStore.svelte';
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

	let isSkillsOpen = $state(true);
	let isNpcsOpen = $state(false);
	let npcQuery = $state('');

	const allNpcNames = $derived.by(() => {
		const set = new Set<string>();
		for (const n of getNpcNames()) set.add(n);
		if (playerStats?.npcLevels) {
			for (const n of Object.keys(playerStats.npcLevels)) set.add(n);
		}
		return Array.from(set).sort((a, b) => a.localeCompare(b));
	});

	const npcRows = $derived(
		allNpcNames
			.filter((name) => matchesQuery(name, npcQuery))
			.map((name) => [name, playerStats?.npcLevels[name] ?? 0] as [string, number])
	);

	function clearStats() {
		if (confirm('Clear your player stats? This also resets the eligibility filter.')) {
			onClear();
		}
	}

	function parseLevel(raw: string): number {
		const n = Number(raw);
		return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
	}

	function getBaseStats(): PlayerStats {
		return (
			playerStats ?? {
				farming: 0,
				fishing: 0,
				crafting: 0,
				exploring: 0,
				tower: 0,
				cooking: 0,
				mining: 0,
				npcLevels: {}
			}
		);
	}

	function updateSkill(key: keyof Omit<PlayerStats, 'npcLevels'>, raw: string) {
		const base = getBaseStats();
		onUpdate({ ...base, [key]: parseLevel(raw) });
	}

	function updateNpcLevel(name: string, raw: string) {
		const base = getBaseStats();
		onUpdate({ ...base, npcLevels: { ...base.npcLevels, [name]: parseLevel(raw) } });
	}
</script>

<div
	class="flex h-full min-h-0 flex-col space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
>
	<div class="flex items-center justify-between">
		<h2 class="font-semibold">Player Stats</h2>
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
		<p
			class="flex items-center justify-center gap-2 text-center text-xs text-red-600 dark:text-red-400"
		>
			NPC data failed to load — friendship names/images may be missing or incomplete.
			<button onclick={() => retryNpcs()} class={buttonClass('link')}>Retry</button>
		</p>
	{/if}

	<!-- Section 1: Skills Accordion -->
	<div class="rounded border border-gray-100 dark:border-gray-700">
		<button
			type="button"
			onclick={() => (isSkillsOpen = !isSkillsOpen)}
			aria-expanded={isSkillsOpen}
			class="flex w-full items-center justify-between bg-gray-50/80 px-3 py-1.5 text-left text-xs font-medium hover:bg-gray-100 dark:bg-gray-800/80 dark:hover:bg-gray-800"
		>
			<span>Skills & Tower ({SKILLS.length})</span>
			<ChevronDown
				size={14}
				class="transition-transform duration-200 {isSkillsOpen ? 'rotate-180' : ''}"
			/>
		</button>

		{#if isSkillsOpen}
			<div class="p-2">
				<div class="grid grid-cols-4 gap-2 text-center text-xs sm:grid-cols-7">
					{#each SKILLS as skill (skill.key)}
						<div class="rounded border border-gray-100 p-1.5 dark:border-gray-700">
							<label class="text-gray-500 dark:text-gray-400" for="stat-{skill.key}"
								>{skill.label}</label
							>
							<input
								id="stat-{skill.key}"
								type="number"
								inputmode="numeric"
								min="0"
								value={playerStats?.[skill.key] ?? 0}
								onchange={(e) => updateSkill(skill.key, e.currentTarget.value)}
								class="w-full rounded border border-gray-300 bg-transparent text-center tabular-nums font-semibold hover:border-gray-400 focus:border-sky-500 focus:outline-none dark:border-gray-600 dark:hover:border-gray-500"
							/>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<!-- Section 2: NPC Friendship Levels Accordion -->
	<div class="rounded border border-gray-100 dark:border-gray-700">
		<button
			type="button"
			onclick={() => (isNpcsOpen = !isNpcsOpen)}
			aria-expanded={isNpcsOpen}
			class="flex w-full items-center justify-between bg-gray-50/80 px-3 py-1.5 text-left text-xs font-medium hover:bg-gray-100 dark:bg-gray-800/80 dark:hover:bg-gray-800"
		>
			<span>NPC Friendships ({allNpcNames.length})</span>
			<ChevronDown
				size={14}
				class="transition-transform duration-200 {isNpcsOpen ? 'rotate-180' : ''}"
			/>
		</button>

		{#if isNpcsOpen}
			<div class="space-y-2 p-2">
				<div class="relative">
					<input
						bind:value={npcQuery}
						placeholder="Search NPC..."
						aria-label="Search NPC"
						class="w-full rounded border border-gray-300 p-1.5 pr-9 text-xs transition-colors hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500"
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
				<div
					class="min-h-0 max-h-48 overflow-auto rounded border border-gray-100 dark:border-gray-700"
				>
					{#if npcRows.length === 0}
						<p class="p-2 text-center text-xs text-gray-400">No NPCs match that search.</p>
					{:else}
						<ul class="grid grid-cols-1 gap-x-4 gap-y-1 p-1.5 text-xs sm:grid-cols-3">
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
									<span
										class="flex shrink-0 items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400"
									>
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
			</div>
		{/if}
	</div>
</div>
