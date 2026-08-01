<script lang="ts">
	import { Save, Upload, X } from '@lucide/svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { buttonClass } from '$lib/ui/buttonClass';
	import { exportProgress, importProgress, savePlayerStats } from '$lib/quest/storage/persistence';
	import { trapFocus } from '$lib/ui/trapFocus';
	import type { PlayerStats } from '$lib/quest/types';

	let {
		open = $bindable(),
		completed,
		inventoryBaseline,
		staleKeys,
		selectedQuestlineNames = $bindable(),
		playerStats = $bindable(),
		onCompletedChanged,
		onStorageWriteFailed
	}: {
		open: boolean;
		completed: SvelteSet<string>;
		inventoryBaseline: SvelteSet<string>;
		staleKeys: SvelteSet<string>;
		selectedQuestlineNames: string[];
		playerStats: PlayerStats | null;
		onCompletedChanged: () => void;
		onStorageWriteFailed: () => void;
	} = $props();

	function handleExport() {
		const json = exportProgress(completed, selectedQuestlineNames, playerStats);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'farmrpg-quest-progress.json';
		a.click();
		URL.revokeObjectURL(url);
	}

	let importInputEl: HTMLInputElement | undefined = $state();
	let importMessage = $state('');

	function handleImportClick() {
		importInputEl?.click();
	}

	async function handleImportFile(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const text = await file.text();
		const imported = importProgress(text);
		if (!imported) {
			importMessage = "That file doesn't look like a progress export.";
			return;
		}
		const statsNote = imported.playerStats ? ' and your player stats' : '';
		if (
			completed.size === 0 ||
			confirm(
				`Replace your current progress (${completed.size} quests marked done) with the imported file (${imported.completed.size} quests${statsNote})?`
			)
		) {
			completed.clear();
			for (const key of imported.completed) completed.add(key);
			staleKeys.clear();
			for (const key of imported.completed) if (!inventoryBaseline.has(key)) staleKeys.add(key);
			onCompletedChanged();
			if (imported.queue) selectedQuestlineNames = imported.queue;
			if (imported.playerStats) {
				playerStats = imported.playerStats;
				if (!savePlayerStats(imported.playerStats)) onStorageWriteFailed();
			}
			const queueNote = imported.queue ? ` and a ${imported.queue.length}-questline queue` : '';
			importMessage = `Imported ${imported.completed.size} completed quests${queueNote}${statsNote}.`;
		}
		(e.target as HTMLInputElement).value = '';
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={(e) => e.target === e.currentTarget && (open = false)}
		role="presentation"
	>
		<div
			class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800 dark:text-gray-100"
			role="dialog"
			aria-modal="true"
			aria-labelledby="backup-modal-title"
			use:trapFocus={() => (open = false)}
		>
			<div class="mb-4 flex items-start justify-between">
				<h2 id="backup-modal-title" class="text-lg font-semibold">Progress backup</h2>
				<button onclick={() => (open = false)} class={buttonClass('icon')} aria-label="Close">
					<X size={16} />
				</button>
			</div>

			<p class="mb-4 text-sm text-gray-600 dark:text-gray-300">
				This backs up which quests you've marked done, your questline queue, and your pasted
				player stats as a JSON file — not your inventory. Export before clearing browser data, or
				import a file to restore progress on another device.
			</p>

			<div class="flex gap-2">
				<button
					onclick={handleExport}
					class="flex flex-1 items-center justify-center gap-1.5 {buttonClass('default')}"
				>
					<Save size={16} class="text-sky-600 dark:text-sky-400" />
					Export
				</button>
				<button
					onclick={handleImportClick}
					class="flex flex-1 items-center justify-center gap-1.5 {buttonClass('default')}"
				>
					<Upload size={16} class="text-sky-600 dark:text-sky-400" />
					Import
				</button>
			</div>
			{#if importMessage}
				<p class="mt-3 text-xs text-gray-500 dark:text-gray-400">{importMessage}</p>
			{/if}
			<input
				bind:this={importInputEl}
				type="file"
				accept="application/json"
				class="hidden"
				onchange={handleImportFile}
			/>
		</div>
	</div>
{/if}
