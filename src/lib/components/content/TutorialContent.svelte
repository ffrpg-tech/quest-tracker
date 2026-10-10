<script lang="ts">
	import { tutorialSteps } from '$lib/tutorial';

	// Single source of truth for Tutorial rendering across /about and SettingsModal.
	let { collapsible = false }: { collapsible?: boolean } = $props();
</script>

<ol class="divide-y divide-gray-100 dark:divide-gray-700">
	{#each tutorialSteps as s (s.step)}
		<li class={collapsible ? '' : 'py-3'}>
			{#if collapsible}
				<details class="group py-2">
					<summary class="cursor-pointer list-none text-sm font-medium">
						{s.step}. {s.title}
						<span class="block font-normal text-gray-600 dark:text-gray-300">{s.summary}</span>
					</summary>
					<p class="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
						{s.details}
					</p>
				</details>
			{:else}
				<div class="font-semibold text-sm text-gray-900 dark:text-gray-100">
					{s.step}. {s.title}
				</div>
				<div class="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
					{s.summary}
				</div>
				<p class="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
					{s.details}
				</p>
			{/if}
		</li>
	{/each}
</ol>
