<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		initialOpen = false,
		children
	}: {
		title: string;
		initialOpen?: boolean;
		children: Snippet;
	} = $props();

	function handleToggle(e: Event) {
		initialOpen = (e.currentTarget as HTMLDetailsElement).open;
	}
</script>

<details open={initialOpen} ontoggle={handleToggle}>
	<summary
		class="cursor-pointer text-sm font-semibold text-gray-900 select-none dark:text-gray-100"
	>
		{title}
	</summary>

	{#if initialOpen}
		{@render children()}
	{/if}
</details>
