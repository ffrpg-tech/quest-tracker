<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { canonicalUrl, SITE_NAME } from '$lib/seo';
	import { parseChangelog, releasedEntries, latestVersion, groupByMinor } from '$lib/changelog';
	import { saveLastSeenChangelogVersion } from '$lib/quest/storage/persistence';
	import changelogRaw from '../../../CHANGELOG.md?raw';

	const title = `Changelog — ${SITE_NAME}`;
	const description = 'What changed in the Farm RPG Quest Wall Calculator, release by release.';

	const entries = releasedEntries(parseChangelog(changelogRaw));
	const groups = groupByMinor(entries);

	onMount(() => {
		const latest = latestVersion(entries);
		if (latest) saveLastSeenChangelogVersion(latest);
	});
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonicalUrl('/changelog')} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonicalUrl('/changelog')} />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
</svelte:head>

<div class="mx-auto max-w-3xl space-y-6 p-6 dark:text-gray-100">
	<a href={resolve('/')} class="text-sm text-emerald-600 hover:underline dark:text-emerald-400"
		>&larr; Back to the calculator</a
	>

	<header>
		<h1 class="text-2xl font-bold">Changelog</h1>
	</header>

	<section class="space-y-4">
		{#each groups as group, i (group.minor)}
			<details open={i === 0}>
				<summary
					class="cursor-pointer text-sm font-semibold text-gray-900 select-none dark:text-gray-100"
				>
					{group.minor}.x
				</summary>
				<div class="mt-4 space-y-8 pl-1">
					{#each group.entries as entry (entry.version)}
						<div>
							<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
								{entry.version}
								{#if entry.date}
									<span class="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400"
										>{entry.date}</span
									>
								{/if}
							</h2>
							{#each entry.sections as section (section.heading)}
								<div class="mt-2">
									<h3 class="text-sm font-medium text-emerald-600 dark:text-emerald-400">
										{section.heading}
									</h3>
									<ul class="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
										{#each section.items as item (item)}
											<li>{item}</li>
										{/each}
									</ul>
								</div>
							{/each}
						</div>
					{/each}
				</div>
			</details>
		{/each}
	</section>
</div>
