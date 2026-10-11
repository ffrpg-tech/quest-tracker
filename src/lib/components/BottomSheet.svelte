<script lang="ts">
	import type { Snippet } from 'svelte';
	import { portal } from '$lib/ui/portal';
	import { trapFocus } from '$lib/ui/trapFocus';

	let {
		open = $bindable(false),
		title = '',
		onClose,
		pinnedTop,
		children
	}: {
		open?: boolean;
		title?: string;
		onClose?: () => void;
		pinnedTop?: Snippet;
		children: Snippet;
	} = $props();

	function handleClose() {
		open = false;
		onClose?.();
	}

	$effect(() => {
		if (open) {
			const originalOverflow = document.body.style.overflow;
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = originalOverflow;
			};
		}
	});
</script>

{#if open}
	<div use:portal>
		<!-- Scrim with click-to-close -->
		<div
			class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs"
			onclick={handleClose}
			role="presentation"
		></div>

		<!-- Sheet modal dialog -->
		<div
			role="dialog"
			aria-modal="true"
			aria-label={title || 'Menu'}
			use:trapFocus={handleClose}
			class="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl bg-white pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-2xl dark:bg-gray-800 dark:text-gray-100"
		>
			<!-- Grip indicator -->
			<div class="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600"></div>

			{#if pinnedTop}
				<div class="shrink-0 border-b border-gray-100 p-4 dark:border-gray-700">
					{@render pinnedTop()}
				</div>
			{/if}

			<!-- Scrollable body content -->
			<div class="flex-1 overflow-y-auto overscroll-contain p-4">
				{@render children()}
			</div>
		</div>
	</div>
{/if}
