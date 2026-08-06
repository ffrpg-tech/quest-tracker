<script lang="ts">
	import { Sun, Moon, MessageSquarePlus, Upload, Save, CircleHelp } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { buttonClass } from '$lib/ui/buttonClass';

	let {
		darkMode,
		onToggleDarkMode,
		onOpenImport,
		onOpenBackup,
		onOpenFeedback
	}: {
		darkMode: boolean;
		onToggleDarkMode: () => void;
		onOpenImport: () => void;
		onOpenBackup: () => void;
		onOpenFeedback: () => void;
	} = $props();
</script>

<header class="flex flex-wrap items-start justify-between gap-4">
	<div class="space-y-1">
		<h1 class="text-2xl font-bold">Farm RPG Quest Wall Calculator</h1>
		<p class="text-sm text-gray-500 dark:text-gray-400">
			Paste your inventory, pick a questline, and see exactly which quest you'll run dry on.
		</p>
	</div>
	<div class="flex flex-wrap items-center gap-2">
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
		<a
			href="{resolve('/about')}#tutorial"
			title="Help / Getting started"
			aria-label="Help / Getting started"
			class={buttonClass('icon')}
		>
			<CircleHelp size={16} />
		</a>
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
</header>
