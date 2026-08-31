<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { loadLastSeenChangelogVersion } from '$lib/quest/storage/persistence';
	import { parseChangelog, latestVersion } from '$lib/changelog';
	import changelogRaw from '../../../CHANGELOG.md?raw';

	const LAUNCH_YEAR = 2026;
	const currentYear = new Date().getFullYear();
	const copyrightYears =
		currentYear > LAUNCH_YEAR ? `${LAUNCH_YEAR}-${currentYear}` : `${LAUNCH_YEAR}`;

	const latestChangelogVersion = latestVersion(parseChangelog(changelogRaw));
	let hasUnseenChangelog = $state(false);

	onMount(() => {
		hasUnseenChangelog =
			latestChangelogVersion !== null && loadLastSeenChangelogVersion() !== latestChangelogVersion;
	});
</script>

<footer
	class="mt-12 border-t border-gray-200 pt-6 text-center text-[11px] text-gray-500 dark:border-gray-700 dark:text-gray-400 sm:text-xs"
>
	<p class="mt-2">
		This is a <strong>fan project</strong> and will <em class="text-red-600 dark:text-red-400">never</em> be monetized.
	</p>
	<p class="mt-2">
		FarmRPG and all related names, marks, and materials are trademarks of
		<strong>Magic and Wires, LLC</strong> —
		<a
			href="https://farmrpg.com"
			target="_blank"
			rel="noopener noreferrer"
			class="text-emerald-600 hover:underline dark:text-emerald-400">farmrpg.com</a
		>.
	</p>
	<p class="mt-2">
		This is an <em class="text-red-600 dark:text-red-400">unofficial</em> fan project and is not affiliated with, endorsed by, or
		sponsored by Magic and Wires, LLC.
	</p>
	<p class="mt-2">
		Built with <strong>AI assistance</strong>, reviewed and tested by a human before every release.
	</p>
	<p class="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
		<a href="{resolve('/about')}#why" class="text-emerald-600 hover:underline dark:text-emerald-400"
			>Why did I create this?</a
		>
		<span class="text-gray-300 dark:text-gray-600">&middot;</span>
		<a href={resolve('/credits')} class="text-emerald-600 hover:underline dark:text-emerald-400"
			>Credits</a
		>
		<span class="text-gray-300 dark:text-gray-600">&middot;</span>
		<a
			href={resolve('/changelog')}
			class="inline-flex items-center gap-1 text-emerald-600 hover:underline dark:text-emerald-400"
		>
			Changelog
			{#if hasUnseenChangelog}
				<span
					class="rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
					>New</span
				>
			{/if}
		</a>
	</p>
	<p class="mt-2">
		&copy; {copyrightYears} <span class="text-gray-300 dark:text-gray-600">&middot;</span>
		<span class="group relative inline-block">
			Created by <span class="font-semibold text-emerald-600 dark:text-emerald-400">kodyy</span>
			<span
				class="pointer-events-none absolute top-full left-1/2 mt-0.5 -translate-x-1/2 whitespace-nowrap text-[9px] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
				>(Rkm made me put my name on here)</span
			>
		</span>
	</p>
</footer>
