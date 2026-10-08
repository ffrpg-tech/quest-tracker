<script lang="ts">
	import { onMount } from 'svelte';
	import { RefreshCw, X, Sparkles } from '@lucide/svelte';
	import { checkForUpdate, purgeCachesAndHardReload } from '$lib/version';

	let hasUpdate = $state(false);
	let newVersion = $state<string | null>(null);
	let dismissed = $state(false);
	let updating = $state(false);

	async function runCheck() {
		if (dismissed) return;
		const result = await checkForUpdate();
		if (result.hasUpdate && result.latestVersion) {
			hasUpdate = true;
			newVersion = result.latestVersion;
		}
	}

	onMount(() => {
		runCheck();

		// Check on window focus as well
		const handleFocus = () => runCheck();
		window.addEventListener('focus', handleFocus);

		return () => {
			window.removeEventListener('focus', handleFocus);
		};
	});

	async function handleUpdateClick() {
		updating = true;
		await purgeCachesAndHardReload(newVersion ?? undefined);
	}
</script>

{#if hasUpdate && !dismissed}
	<div
		class="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-sky-300 bg-sky-50 px-4 py-2.5 text-xs text-sky-950 shadow-sm dark:border-sky-800 dark:bg-sky-950/90 dark:text-sky-100"
		role="alert"
	>
		<div class="flex items-center gap-2">
			<Sparkles size={16} class="shrink-0 text-sky-600 dark:text-sky-400" />
			<span>
				A new version <strong>(v{newVersion})</strong> is available!
			</span>
		</div>

		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={handleUpdateClick}
				disabled={updating}
				class="inline-flex items-center gap-1.5 rounded bg-sky-600 px-3 py-1 font-semibold text-white shadow-xs hover:bg-sky-700 disabled:opacity-50 dark:bg-sky-500 dark:hover:bg-sky-600"
			>
				<RefreshCw size={12} class={updating ? 'animate-spin' : ''} />
				<span>{updating ? 'Updating...' : 'Update now'}</span>
			</button>
			<button
				type="button"
				onclick={() => (dismissed = true)}
				aria-label="Dismiss update notification"
				class="rounded p-1 text-sky-700 hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-sky-900"
			>
				<X size={14} />
			</button>
		</div>
	</div>
{/if}
