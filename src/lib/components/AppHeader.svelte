<script lang="ts">
	import { Sun, Moon, MessageSquarePlus, Upload, Save, Settings, BookOpen, ScrollText, Menu } from '@lucide/svelte';
	import { buttonClass } from '$lib/ui/buttonClass';
	import BottomSheet from './BottomSheet.svelte';
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

	let menuSheetOpen = $state(false);

	function handleModalAction(action?: () => void) {
		menuSheetOpen = false;
		action?.();
	}
</script>

<header
	class="sticky top-0 z-40 -mx-4 -mt-2 flex h-[50px] items-center justify-between border-b border-gray-100 bg-white/95 px-4 shadow-xs backdrop-blur-sm transition-colors sm:-mx-6 sm:h-auto sm:flex-wrap sm:gap-4 sm:px-6 sm:py-3 dark:border-gray-800 dark:bg-gray-900/95"
>
	<div class="space-y-0.5">
		<h1 class="text-xl font-bold sm:text-2xl">FarmRPG Quest Tracker</h1>
		<p class="hidden text-xs text-gray-500 sm:block sm:text-sm dark:text-gray-400">
			Paste your inventory, pick a questline, and see exactly which quest you'll run dry on.
		</p>
	</div>
	<div class="hidden sm:flex flex-col items-end gap-1.5">
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

<button
	type="button"
	onclick={() => (menuSheetOpen = true)}
	aria-label="Open menu"
	class="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-30 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition-transform active:scale-95 sm:hidden dark:bg-emerald-600"
>
	<Menu size={24} />
</button>

<BottomSheet bind:open={menuSheetOpen} title="Menu">
	{#snippet pinnedTop()}
		<button
			type="button"
			onclick={() => handleModalAction(onOpenImport)}
			class="flex w-full min-h-[44px] items-center justify-center gap-2 {buttonClass('primary')}"
		>
			<Upload size={18} />
			<span>Import data</span>
		</button>
	{/snippet}

	<div class="flex flex-col gap-1">
		<button
			type="button"
			onclick={() => handleModalAction(onOpenBackup)}
			class="flex w-full min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 active:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700/60 dark:active:bg-gray-700 transition-colors"
		>
			<Save size={18} class="shrink-0 text-sky-600 dark:text-sky-400" />
			<span>Progress backup</span>
		</button>
		<button
			type="button"
			onclick={() => handleModalAction(onOpenFeedback)}
			class="flex w-full min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 active:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700/60 dark:active:bg-gray-700 transition-colors"
		>
			<MessageSquarePlus size={18} class="shrink-0 text-sky-600 dark:text-sky-400" />
			<span>Feedback / report an issue</span>
		</button>
		{#if onOpenSettings}
			<button
				type="button"
				onclick={() => handleModalAction(() => onOpenSettings?.('tutorial'))}
				class="flex w-full min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 active:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700/60 dark:active:bg-gray-700 transition-colors"
			>
				<BookOpen size={18} class="shrink-0 text-sky-600 dark:text-sky-400" />
				<span>Tutorial & Guide</span>
			</button>
			<button
				type="button"
				onclick={() => handleModalAction(() => onOpenSettings?.('changelog'))}
				class="flex w-full min-h-[44px] items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 active:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700/60 dark:active:bg-gray-700 transition-colors"
			>
				<div class="flex items-center gap-3">
					<ScrollText size={18} class="shrink-0 text-sky-600 dark:text-sky-400" />
					<span>Changelog</span>
				</div>
				{#if hasUnreadChangelog}
					<span class="relative flex h-2 w-2">
						<span
							class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
						></span>
						<span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
					</span>
				{/if}
			</button>
			<button
				type="button"
				onclick={() => handleModalAction(() => onOpenSettings?.('preferences'))}
				class="flex w-full min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 active:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700/60 dark:active:bg-gray-700 transition-colors"
			>
				<Settings size={18} class="shrink-0 text-sky-600 dark:text-sky-400" />
				<span>Settings & Info</span>
			</button>
		{/if}
		<button
			type="button"
			onclick={onToggleDarkMode}
			class="flex w-full min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 active:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700/60 dark:active:bg-gray-700 transition-colors"
			aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
		>
			{#if darkMode}
				<Sun size={18} class="shrink-0 text-amber-500" />
				<span>Switch to light mode</span>
			{:else}
				<Moon size={18} class="shrink-0 text-indigo-500 dark:text-indigo-300" />
				<span>Switch to dark mode</span>
			{/if}
		</button>
	</div>
</BottomSheet>
