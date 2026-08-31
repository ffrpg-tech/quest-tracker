<script lang="ts">
	import { X } from '@lucide/svelte';
	import { buttonClass } from '$lib/ui/buttonClass';
	import { trapFocus } from '$lib/ui/trapFocus';

	let { open = $bindable() }: { open: boolean } = $props();
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={(e) => e.target === e.currentTarget && (open = false)}
		role="presentation"
	>
		<div
			class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800 dark:text-gray-100"
			role="dialog"
			aria-modal="true"
			aria-labelledby="feedback-modal-title"
			use:trapFocus={() => (open = false)}
		>
			<div class="mb-4 flex items-start justify-between">
				<h2 id="feedback-modal-title" class="text-lg font-semibold">Feedback / report a bug</h2>
				<button onclick={() => (open = false)} class={buttonClass('icon')} aria-label="Close">
					<X size={16} />
				</button>
			</div>

			<p class="text-sm text-gray-600 dark:text-gray-300">
				Please contact <span class="font-semibold text-emerald-600 dark:text-emerald-400">kodyy</span> in-game and explain what happened — what you were
				doing, what you expected, and what actually happened.
			</p>

			<a
				href="https://farmrpg.com/#!/sendmessage.php?to=kodyy"
				target="_blank"
				rel="noopener noreferrer"
				class="{buttonClass('primary')} mt-4 inline-block"
			>
				Message kodyy in-game
			</a>
		</div>
	</div>
{/if}
