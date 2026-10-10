<script lang="ts">
	import { fade } from 'svelte/transition';

	let {
		message = 'Loading Farm RPG Quest Tracker...',
		stages
	}: {
		message?: string;
		stages?: { label: string; done: boolean }[];
	} = $props();
</script>

<div
	class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/50 backdrop-blur-sm"
	transition:fade={{ duration: 150 }}
>
	<div
		class="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-emerald-400"
		role="status"
		aria-label="Loading"
	></div>
	<p class="text-sm font-medium text-white">{message}</p>
</div>
