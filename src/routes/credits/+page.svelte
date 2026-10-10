<script lang="ts">
	import { resolve } from '$app/paths';
	import { canonicalUrl, SITE_NAME } from '$lib/seo';
	import CreditsContent from '$lib/components/content/CreditsContent.svelte';

	const title = `Credits — ${SITE_NAME}`;
	const description =
		'Credits for the FarmRPG Quest Tracker: the FarmRPG developers and Discord community, spreadsheet maintainers, and community wiki contributors whose work made this tool possible.';
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonicalUrl('/credits')} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonicalUrl('/credits')} />
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
		<h1 class="text-2xl font-bold">Credits</h1>
	</header>

	<section class="space-y-5 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
		<CreditsContent />

		<p class="pt-2 text-xs text-gray-500 dark:text-gray-400">
			Curious about the motivation behind this project? Read
			<a
				href={resolve('/about')}
				class="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
				>why I created this</a
			>.
		</p>
	</section>
</div>
