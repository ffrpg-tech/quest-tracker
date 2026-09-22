<script lang="ts">
	import { getItemImagePath, getItemCanMail } from '$lib/quest/storage/itemsStore.svelte';

	let { name, size = 16 }: { name: string; size?: number } = $props();

	const src = $derived(getItemImagePath(name));
	const cannotMail = $derived(getItemCanMail(name) === false);
</script>

{#if src}
	<img {src} alt="" width={size} height={size} class="inline-block shrink-0" loading="lazy" />
{/if}
{#if cannotMail}
	<span
		title="Can't be mailed — you'll need to get this yourself"
		class="inline-block shrink-0 rounded border-l-4 border-red-500 bg-red-500/10 bg-red-100 px-1 text-[9px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300"
		>CAN'T MAIL</span
	>
{/if}
