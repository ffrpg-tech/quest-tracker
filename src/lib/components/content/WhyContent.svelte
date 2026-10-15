<script lang="ts">
	import { resolve } from '$app/paths';

	// Single source of truth for "Why did I create this?" across /about and SettingsModal.
	let {
		onNavigateToCredits
	}: {
		onNavigateToCredits?: () => void;
	} = $props();
</script>

<div class="space-y-4 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
	<p>
		Farm RPG has no shortage of quest data — <a
			href="https://buddy.farm"
			target="_blank"
			rel="noopener noreferrer"
			class="font-medium text-emerald-600 hover:underline dark:text-emerald-400">buddy.farm</a
		>
		already covers every questline and item. What it doesn't have is a checklist. So people make their
		own: <strong>Quest Wall</strong> sheets, one questline at a time. However, it is mainly focused on
		main quests, and not the rest of the questlines. So the other quests are left without getting its
		own sheet.
	</p>
	<p>
		Additionally, because the sheets only cover one questline at a time, it is hard to see the
		bigger picture. While it is true that we must focus on one at a time, it is also true that we
		need to plan ahead. Say you have two sheets tackling different questlines — you end up syncing
		the same inventory into both by hand, and still have to manually check whether you have enough
		items to clear the next quest on either one.
	</p>
	<p>
		That's exactly what happened to me while working on my ATI quest, and I could tell it wouldn't
		stop being a problem once ATI was done. So I decided to build a tool that could plan out
		questlines and show where I — and anyone else — would wall. I wanted it to be usable by anyone
		too, so with my knowledge towards software development, I made it as a web application,
		accessible from desktop and mobile.
	</p>
	<p>
		The premise is: paste your inventory and your finished questlines, then pick your next
		questlines — it walks the chain and shows you exactly where you run dry.
	</p>
	<p>
		It's a fan project, made for the community. See the
		{#if onNavigateToCredits}
			<button
				type="button"
				onclick={onNavigateToCredits}
				class="cursor-pointer font-medium text-emerald-600 underline hover:no-underline dark:text-emerald-400"
				>credits tab</button
			>
		{:else}
			<a
				href={resolve('/credits')}
				class="font-medium text-emerald-600 hover:underline dark:text-emerald-400">credits page</a
			>
		{/if} for who made that possible.
	</p>
	<p>
		This project is built with <strong>AI assistance</strong>, reviewed and tested by a human before
		every release.
	</p>
</div>
