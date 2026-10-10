<script lang="ts">
	import { Sun, Moon, MessageSquarePlus, Upload, Save, Settings, BookOpen, ScrollText } from '@lucide/svelte';
	import { buttonClass } from '$lib/ui/buttonClass';
	import type { SettingsTab } from './SettingsModal.svelte';

	let {
		darkMode,
		hasUnreadChangelog = false,
		onToggleDarkMode,
		onOpenImport,
		onOpenBackup,
		onOpenFeedback,
		onOpenSettings
	}: {
		darkMode: boolean;
		hasUnreadChangelog?: boolean;
		onToggleDarkMode: () => void;
		onOpenImport: () => void;
		onOpenBackup: () => void;
		onOpenFeedback: () => void;
		onOpenSettings?: (tab?: SettingsTab) => void;
	} = $props();
</script>

<header
	class="sticky top-0 z-40 -mx-4 -mt-2 flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 bg-white/95 px-4 py-3 shadow-xs backdrop-blur-sm transition-colors sm:-mx-6 sm:px-6 dark:border-gray-800 dark:bg-gray-900/95"
>
	<div class="space-y-0.5">
		<h1 class="text-xl font-bold sm:text-2xl">FarmRPG Quest Tracker</h1>
		<p class="hidden text-xs text-gray-500 sm:block sm:text-sm dark:text-gray-400">
			Paste your inventory, pick a questline, and see exactly which quest you'll run dry on.
		</p>
	</div>
	<div class="flex flex-col items-end gap-1.5">
		<div class="flex flex-wrap items-center justify-end gap-2">
			<button
				onclick={onOpenFeedback}
				title="Feedback / report an issue"
				aria-label="Feedback / report an issue"
				class="flex items-center gap-1.5 {buttonClass('default')}"
			>
				<MessageSquarePlus size={16} class="text-sky-600 dark:text-sky-400" />
				<span class="hidden sm:inline">Feedback / report an issue</span>
			</button>
			<button onclick={onOpenImport} class="flex items-center gap-1.5 {buttonClass('primary')}">
				<Upload size={16} />
				Import data
			</button>
			<button
				onclick={onOpenBackup}
				title="Progress backup"
				aria-label="Progress backup"
				class="flex items-center gap-1.5 {buttonClass('default')}"
			>
				<Save size={16} class="text-sky-600 dark:text-sky-400" />
				<span class="hidden sm:inline">Progress backup</span>
			</button>
		</div>
		<div class="flex items-center gap-2">
			{#if onOpenSettings}
				<button
					onclick={() => onOpenSettings?.('tutorial')}
					title="Tutorial & Guide"
					aria-label="Tutorial & Guide"
					class={buttonClass('icon')}
				>
					<BookOpen size={16} class="text-sky-600 dark:text-sky-400" />
				</button>
				<button
					onclick={() => onOpenSettings?.('changelog')}
					title="Changelog"
					aria-label="Changelog"
					class="relative {buttonClass('icon')}"
				>
					<ScrollText size={16} class="text-sky-600 dark:text-sky-400" />
					{#if hasUnreadChangelog}
						<span class="absolute top-1 right-1 flex h-2 w-2">
							<span
								class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
							></span>
							<span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
						</span>
					{/if}
				</button>
				<button
					onclick={() => onOpenSettings?.('preferences')}
					title="Settings & Info"
					aria-label="Settings & Info"
					class={buttonClass('icon')}
				>
					<Settings size={16} class="text-sky-600 dark:text-sky-400" />
				</button>
			{/if}
			<button
				onclick={onToggleDarkMode}
				aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
				class={buttonClass('icon')}
			>
				{#if darkMode}
					<Sun size={16} class="text-amber-500" />
				{:else}
					<Moon size={16} class="text-indigo-500 dark:text-indigo-300" />
				{/if}
			</button>
		</div>
	</div>
</header>
