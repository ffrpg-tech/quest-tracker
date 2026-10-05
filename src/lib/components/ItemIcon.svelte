<script lang="ts">
	import { MailX } from '@lucide/svelte';
	import { getItemImagePath, getItemCanMail } from '$lib/quest/storage/itemsStore.svelte';

	let {
		name,
		size = 16,
		hideCannotMail = false,
		cannotMailFormat = 'badge'
	}: {
		name: string;
		size?: number;
		hideCannotMail?: boolean;
		cannotMailFormat?: 'badge' | 'icon';
	} = $props();

	const src = $derived(getItemImagePath(name));
	const cannotMail = $derived(getItemCanMail(name) === false);
</script>

{#if src}
	<img {src} alt="" width={size} height={size} class="inline-block shrink-0" loading="lazy" />
{/if}
{#if cannotMail && !hideCannotMail}
	{#if cannotMailFormat === 'icon'}
		<span
			title="Can't be mailed — you'll need to get this yourself"
			class="inline-flex shrink-0 items-center rounded bg-red-100 p-0.5 text-red-700 dark:bg-red-950 dark:text-red-300"
		>
			<MailX size={11} aria-label="Can't be mailed" />
		</span>
	{:else}
		<span
			title="Can't be mailed — you'll need to get this yourself"
			class="inline-block shrink-0 rounded border-l-4 border-red-500 bg-red-500/10 bg-red-100 px-1 text-[9px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300"
			>CAN'T MAIL</span
		>
	{/if}
{/if}
