<script lang="ts">
	let {
		onOpenSettings
	}: {
		onOpenSettings?: () => void;
	} = $props();

	const LAUNCH_YEAR = 2026;
	const currentYear = new Date().getFullYear();
	const copyrightYears =
		currentYear > LAUNCH_YEAR ? `${LAUNCH_YEAR}-${currentYear}` : `${LAUNCH_YEAR}`;
</script>

<footer
	class="mt-12 border-t border-gray-200 pt-6 text-center text-[11px] text-gray-500 dark:border-gray-700 dark:text-gray-400 sm:text-xs"
>
	<p class="mt-2">
		This is a <strong>fan project</strong> and will
		<em class="text-red-600 dark:text-red-400">never</em> be monetized.
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
		This is an <em class="text-red-600 dark:text-red-400">unofficial</em> fan project and is not affiliated
		with, endorsed by, or sponsored by Magic and Wires, LLC.
	</p>
	<p class="mt-2">
		Built with <strong>AI assistance</strong>, reviewed and tested by a human before every release.
	</p>
	{#if onOpenSettings}
		<p class="mt-2">
			<button
				type="button"
				onclick={onOpenSettings}
				class="text-emerald-600 hover:underline dark:text-emerald-400 cursor-pointer font-medium"
			>
				Settings, Guides & Credits
			</button>
		</p>
	{/if}
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
