<script lang="ts">
	import { resolve } from '$app/paths';
	import { canonicalUrl, SITE_NAME } from '$lib/seo';
	import { faqItems } from '$lib/faq';
	import { tutorialSteps } from '$lib/tutorial';
	import TutorialContent from '$lib/components/content/TutorialContent.svelte';
	import WhyContent from '$lib/components/content/WhyContent.svelte';

	const title = `About — ${SITE_NAME}`;
	const description =
		'Why the FarmRPG Quest Tracker exists, a step-by-step tutorial for getting started, and frequently asked questions about how it works.';

	const faqJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: faqItems.map((f) => ({
			'@type': 'Question',
			name: f.question,
			acceptedAnswer: { '@type': 'Answer', text: f.answer }
		}))
	};

	const tutorialJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'HowTo',
		name: `Getting started with ${SITE_NAME}`,
		step: tutorialSteps.map((s) => ({
			'@type': 'HowToStep',
			position: s.step,
			name: s.title,
			text: s.details
		}))
	};
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonicalUrl('/about')} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonicalUrl('/about')} />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />

	<!-- eslint-disable svelte/no-at-html-tags -- JSON-LD script tags: content is
	     JSON.stringify of static, developer-authored objects above (faqItems
	     from $lib/faq, tutorialSteps from $lib/tutorial), not user input, so
	     there's no injection surface. {@html} is the only way to emit a
	     literal <script> tag from svelte:head. -->
	{@html `<script type="application/ld+json">${JSON.stringify(faqJsonLd)}</` + 'script>'}
	{@html `<script type="application/ld+json">${JSON.stringify(tutorialJsonLd)}</` + 'script>'}
	<!-- eslint-enable svelte/no-at-html-tags -->
</svelte:head>

<div class="mx-auto max-w-3xl space-y-10 p-6 dark:text-gray-100">
	<a href={resolve('/')} class="text-sm text-emerald-600 hover:underline dark:text-emerald-400"
		>&larr; Back to the calculator</a
	>

	<section id="tutorial" class="scroll-mt-6 space-y-4">
		<header>
			<h1 class="text-2xl font-bold">Getting started</h1>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
				A quick walkthrough of the setup, then the loop you'll repeat while you play. Tap a step
				for more detail.
			</p>
		</header>

		<TutorialContent collapsible={true} />
	</section>

	<section id="why" class="scroll-mt-6 space-y-4">
		<header>
			<h2 class="text-xl font-bold">Why did I create this?</h2>
		</header>

		<WhyContent />
	</section>

	<section id="faq" class="scroll-mt-6 space-y-4">
		<header>
			<h2 class="text-xl font-bold">Frequently asked questions</h2>
		</header>

		<div class="divide-y divide-gray-100 dark:divide-gray-700">
			{#each faqItems as item (item.question)}
				<details class="group py-2">
					<summary class="cursor-pointer list-none text-sm font-medium">
						{item.question}
					</summary>
					<p class="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{item.answer}</p>
				</details>
			{/each}
		</div>
	</section>
</div>
