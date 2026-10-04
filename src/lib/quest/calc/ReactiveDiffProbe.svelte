<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { diffQuestlineQueue } from './diff';
	import type { Questline } from '../types';

	let { selectedQuestlines }: { selectedQuestlines: Questline[] } = $props();
	let inventory = new Map<string, number>();
	let completed = new SvelteSet<string>();
	let diffCalls = 0;
	let displayedDiffCalls = $state(0);
	let questlinesHydrated = $state(false);
	let hydrated = $state(false);
	let playerStats = $state<{} | null>(null);
	let statsHydrated = $state(false);
	let eligibilityRebuilds = 0;
	let displayedEligibilityRebuilds = $state(0);

	const results = $derived.by(() => {
		diffCalls++;
		return diffQuestlineQueue(selectedQuestlines, inventory, completed);
	});

	$effect(() => {
		results;
		untrack(() => (displayedDiffCalls = diffCalls));
	});

	$effect(() => {
		const deps = { questlinesHydrated, hydrated, playerStats, statsHydrated };
		if (deps.questlinesHydrated && deps.hydrated && deps.statsHydrated) {
			eligibilityRebuilds++;
			untrack(() => (displayedEligibilityRebuilds = eligibilityRebuilds));
		}
	});

	async function settleStartup() {
		questlinesHydrated = true;
		await tick();
		hydrated = true;
		await tick();
		playerStats = {};
		statsHydrated = true;
	}

	function toggleUnselectedQuest() {
		completed.add('Unselected::Quest I');
	}
</script>

<output data-testid="diff-calls">{displayedDiffCalls}</output>
<output data-testid="eligibility-rebuilds">{displayedEligibilityRebuilds}</output>
<output data-testid="result-count">{results.length}</output>
<button onclick={toggleUnselectedQuest}>Toggle unselected quest</button>
<button onclick={settleStartup}>Settle startup</button>
