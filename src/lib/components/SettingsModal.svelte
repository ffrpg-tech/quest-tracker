<script lang="ts">
	import { X, Sun, Moon, Settings } from '@lucide/svelte';
	import { buttonClass } from '$lib/ui/buttonClass';
	import { trapFocus } from '$lib/ui/trapFocus';
	import CreditsContent from '$lib/components/content/CreditsContent.svelte';
	import WhyContent from '$lib/components/content/WhyContent.svelte';
	import TutorialContent from '$lib/components/content/TutorialContent.svelte';
	import { parseChangelog, releasedEntries, groupByMinor } from '$lib/changelog';
	import changelogRaw from '../../../CHANGELOG.md?raw';
	import { APP_VERSION } from '$lib/version';

	import { saveLastSeenChangelogVersion } from '$lib/quest/storage/persistence';

	export type SettingsTab = 'preferences' | 'about' | 'tutorial' | 'credits' | 'changelog';

	let {
		open = $bindable(false),
		activeTab = $bindable<SettingsTab>('preferences'),
		showAllItems = $bindable(false),
		showCraftable = $bindable(true),
		showLocationSources = $bindable(true),
		showAlternativeSources = $bindable(true),
		maxCapacity = $bindable<number | null>(null),
		darkMode = $bindable(false),
		onToggleDarkMode
	}: {
		open: boolean;
		activeTab?: SettingsTab;
		showAllItems: boolean;
		showCraftable: boolean;
		showLocationSources?: boolean;
		showAlternativeSources?: boolean;
		maxCapacity: number | null;
		darkMode: boolean;
		onToggleDarkMode: () => void;
	} = $props();

	const changelogEntries = $derived(releasedEntries(parseChangelog(changelogRaw)));
	const changelogGroups = $derived(groupByMinor(changelogEntries));
	let openChangelogGroups = $state<{ [key: string]: boolean }>({});

	$effect(() => {
		if (open && activeTab === 'changelog') {
			saveLastSeenChangelogVersion(APP_VERSION);
		}
	});

	$effect(() => {
		if (changelogGroups.length > 0 && Object.keys(openChangelogGroups).length === 0) {
			openChangelogGroups[changelogGroups[0].minor] = true;
		}
	});

	function toggleChangelogGroup(minor: string, event: Event) {
		openChangelogGroups[minor] = (event.currentTarget as HTMLDetailsElement).open;
	}

	function formatToUserDate(rawDate: string): string {
		const parsed = new Date(rawDate);
		if (isNaN(parsed.getTime())) return rawDate;
		return new Intl.DateTimeFormat(undefined, {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		}).format(parsed);
	}

	function handleMaxCapacityInput(e: Event) {
		const raw = (e.currentTarget as HTMLInputElement).value.trim();
		if (!raw) {
			maxCapacity = null;
			return;
		}
		const n = parseInt(raw, 10);
		maxCapacity = Number.isFinite(n) && n > 0 ? n : null;
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={(e) => e.target === e.currentTarget && (open = false)}
		role="presentation"
	>
		<div
			class="relative flex h-[85vh] max-h-[700px] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-800 dark:text-gray-100"
			role="dialog"
			aria-modal="true"
			aria-labelledby="settings-modal-title"
			use:trapFocus={() => (open = false)}
		>
			<!-- Modal Header -->
			<div
				class="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700"
			>
				<div class="flex items-center gap-2">
					<Settings size={20} class="text-sky-600 dark:text-sky-400" />
					<h2 id="settings-modal-title" class="text-lg font-semibold">Settings & Information</h2>
					<span
						class="rounded bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-200"
					>
						v{APP_VERSION}
					</span>
				</div>
				<button onclick={() => (open = false)} class={buttonClass('icon')} aria-label="Close">
					<X size={16} />
				</button>
			</div>

			<!-- Tab Navigation -->
			<div
				class="flex shrink-0 flex-wrap gap-1 border-b border-gray-200 bg-gray-50/80 px-6 py-2 text-xs font-medium dark:border-gray-700 dark:bg-gray-900/50"
			>
				<button
					type="button"
					onclick={() => (activeTab = 'preferences')}
					class={buttonClass('pill', activeTab === 'preferences')}
				>
					Preferences
				</button>
				<button
					type="button"
					onclick={() => (activeTab = 'about')}
					class={buttonClass('pill', activeTab === 'about')}
				>
					Why I Created This
				</button>
				<button
					type="button"
					onclick={() => (activeTab = 'tutorial')}
					class={buttonClass('pill', activeTab === 'tutorial')}
				>
					Tutorial & Guide
				</button>
				<button
					type="button"
					onclick={() => (activeTab = 'credits')}
					class={buttonClass('pill', activeTab === 'credits')}
				>
					Credits
				</button>
				<button
					type="button"
					onclick={() => (activeTab = 'changelog')}
					class={buttonClass('pill', activeTab === 'changelog')}
				>
					Changelog
				</button>
			</div>

			<!-- Modal Body (Scrollable) -->
			<div class="flex-1 overflow-y-auto p-6 text-sm min-h-0">
				{#if activeTab === 'preferences'}
					<div class="space-y-6">
						<div>
							<h3 class="text-base font-semibold">Display & Results Options</h3>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								Customize what details appear on your Results and shortfall breakdown.
							</p>
						</div>

						<div class="space-y-4 rounded-lg border border-gray-100 p-4 dark:border-gray-700">
							<div class="flex items-center justify-between gap-4">
								<div>
									<label for="show-all-items" class="font-medium">Show all items</label>
									<p class="text-xs text-gray-500 dark:text-gray-400">
										Displays satisfied items alongside missing requirements in the results view.
									</p>
								</div>
								<button
									id="show-all-items"
									type="button"
									onclick={() => (showAllItems = !showAllItems)}
									role="switch"
									aria-checked={showAllItems}
									aria-label="Show all items"
									class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none {showAllItems
										? 'bg-sky-600'
										: 'bg-gray-300 dark:bg-gray-600'}"
								>
									<span
										class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out {showAllItems
											? 'translate-x-5'
											: 'translate-x-0'}"
									></span>
								</button>
							</div>

							<div
								class="border-t border-gray-100 pt-4 dark:border-gray-700 flex items-center justify-between gap-4"
							>
								<div>
									<label for="show-craftable" class="font-medium">Show craftable amounts</label>
									<p class="text-xs text-gray-500 dark:text-gray-400">
										Displays purple (+N) indicator for items you can craft immediately from on-hand
										materials.
									</p>
								</div>
								<button
									id="show-craftable"
									type="button"
									onclick={() => (showCraftable = !showCraftable)}
									role="switch"
									aria-checked={showCraftable}
									aria-label="Show craftable amounts"
									class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none {showCraftable
										? 'bg-sky-600'
										: 'bg-gray-300 dark:bg-gray-600'}"
								>
									<span
										class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out {showCraftable
											? 'translate-x-5'
											: 'translate-x-0'}"
									></span>
								</button>
							</div>

							<div
								class="border-t border-gray-100 pt-4 dark:border-gray-700 flex items-center justify-between gap-4"
							>
								<div>
									<label for="show-location-sources" class="font-medium"
										>Show location sources</label
									>
									<p class="text-xs text-gray-500 dark:text-gray-400">
										Displays primary gathering or crafting sources next to needed items.
									</p>
								</div>
								<button
									id="show-location-sources"
									type="button"
									onclick={() => (showLocationSources = !showLocationSources)}
									role="switch"
									aria-checked={showLocationSources}
									aria-label="Show location sources"
									class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none {showLocationSources
										? 'bg-sky-600'
										: 'bg-gray-300 dark:bg-gray-600'}"
								>
									<span
										class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out {showLocationSources
											? 'translate-x-5'
											: 'translate-x-0'}"
									></span>
								</button>
							</div>

							{#if showLocationSources}
								<div
									class="ml-4 border-l-2 border-gray-100 pl-4 dark:border-gray-700 flex items-center justify-between gap-4"
								>
									<div>
										<label for="show-alternative-sources" class="font-medium text-xs"
											>Show alternative sources</label
										>
										<p class="text-xs text-gray-500 dark:text-gray-400">
											Displays (+N more) button and popup for items with multiple obtainable
											methods.
										</p>
									</div>
									<button
										id="show-alternative-sources"
										type="button"
										onclick={() => (showAlternativeSources = !showAlternativeSources)}
										role="switch"
										aria-checked={showAlternativeSources}
										aria-label="Show alternative sources"
										class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none {showAlternativeSources
											? 'bg-sky-600'
											: 'bg-gray-300 dark:bg-gray-600'}"
									>
										<span
											class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out {showAlternativeSources
												? 'translate-x-4'
												: 'translate-x-0'}"
										></span>
									</button>
								</div>
							{/if}

							<div
								class="border-t border-gray-100 pt-4 dark:border-gray-700 flex items-center justify-between gap-4"
							>
								<div>
									<span class="font-medium">Theme</span>
									<p class="text-xs text-gray-500 dark:text-gray-400">
										Toggle between light and dark visual mode.
									</p>
								</div>
								<button
									type="button"
									onclick={onToggleDarkMode}
									class="flex items-center gap-1.5 {buttonClass('default')}"
								>
									{#if darkMode}
										<Sun size={14} class="text-amber-500" />
										<span>Light Mode</span>
									{:else}
										<Moon size={14} class="text-indigo-500 dark:text-indigo-300" />
										<span>Dark Mode</span>
									{/if}
								</button>
							</div>
						</div>

						<div>
							<h3 class="text-base font-semibold">Inventory Capacity Forecasting</h3>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								Configure your bag capacity so the calculator flags quest batches that exceed your
								max storage.
							</p>
						</div>

						<div class="rounded-lg border border-gray-100 p-4 dark:border-gray-700 space-y-3">
							<div>
								<label for="max-capacity-input" class="block font-medium text-xs">
									Max Inventory Capacity
								</label>
								<div class="mt-1 flex items-center gap-2">
									<input
										id="max-capacity-input"
										type="number"
										min="1"
										step="1"
										placeholder="e.g. 1000"
										value={maxCapacity ?? ''}
										oninput={handleMaxCapacityInput}
										class="w-48 rounded border border-gray-300 px-3 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 focus:border-sky-500 focus:outline-none"
									/>
									{#if maxCapacity !== null}
										<button
											type="button"
											onclick={() => (maxCapacity = null)}
											class={buttonClass('default')}
										>
											Clear
										</button>
									{/if}
								</div>
								<p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
									Automatically detected when you paste your inventory, or customize it manually
									here. When a quest batch needs more than this amount of any item, a bottleneck
									badge will highlight the exact quest.
								</p>
							</div>
						</div>
					</div>
				{:else if activeTab === 'about'}
					<div class="space-y-4 leading-relaxed text-gray-700 dark:text-gray-300">
						<div class="flex items-center justify-between">
							<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">
								Why did I create this?
							</h3>
							<a
								href="/about#why"
								target="_blank"
								rel="noopener noreferrer"
								class="text-xs text-emerald-600 hover:underline dark:text-emerald-400"
							>
								Open full page &nearr;
							</a>
						</div>
						<WhyContent onNavigateToCredits={() => (activeTab = 'credits')} />
					</div>
				{:else if activeTab === 'tutorial'}
					<div class="space-y-4">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">Getting started</h3>
								<p class="text-xs text-gray-500 dark:text-gray-400">
									A quick walkthrough of the initial setup and everyday workflow loop.
								</p>
							</div>
							<a
								href="/about#tutorial"
								target="_blank"
								rel="noopener noreferrer"
								class="text-xs text-emerald-600 hover:underline dark:text-emerald-400"
							>
								Open full page &nearr;
							</a>
						</div>

						<TutorialContent collapsible={false} />
					</div>
				{:else if activeTab === 'credits'}
					<div class="space-y-5 leading-relaxed text-gray-700 dark:text-gray-300">
						<header class="flex items-center justify-between">
							<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">Credits</h3>
							<a
								href="/credits"
								target="_blank"
								rel="noopener noreferrer"
								class="text-xs text-emerald-600 hover:underline dark:text-emerald-400"
							>
								Open full page &nearr;
							</a>
						</header>

						<CreditsContent />
					</div>
				{:else if activeTab === 'changelog'}
					<div class="space-y-4">
						<div
							class="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-700"
						>
							<div>
								<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">Changelog</h3>
								<p class="text-xs text-gray-500 dark:text-gray-400">
									What changed release by release &middot; Active: <strong>v{APP_VERSION}</strong>
								</p>
							</div>
							<a
								href="/changelog"
								target="_blank"
								rel="noopener noreferrer"
								class="text-xs text-emerald-600 hover:underline dark:text-emerald-400"
							>
								Open full page &nearr;
							</a>
						</div>

						<section class="space-y-4">
							{#each changelogGroups as group (group.minor)}
								<details
									open={openChangelogGroups[group.minor]}
									ontoggle={(e) => toggleChangelogGroup(group.minor, e)}
								>
									<summary
										class="cursor-pointer text-sm font-semibold text-gray-900 select-none dark:text-gray-100"
									>
										{group.minor}.x
									</summary>
									{#if openChangelogGroups[group.minor]}
										<div class="mt-4 space-y-6 pl-1">
											{#each group.entries as entry (entry.version)}
												<div>
													<h4 class="text-base font-semibold text-gray-900 dark:text-gray-100">
														{entry.version}
														{#if entry.date}
															<span
																class="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400"
															>
																{formatToUserDate(entry.date)}
															</span>
														{/if}
													</h4>
													{#each entry.sections as section (section.heading)}
														<div class="mt-2">
															<h5
																class="text-sm font-medium text-emerald-600 dark:text-emerald-400"
															>
																{section.heading}
															</h5>
															<ul
																class="mt-1 list-disc space-y-1 pl-5 text-xs text-gray-700 dark:text-gray-300"
															>
																{#each section.items as item (item)}
																	<li>{item}</li>
																{/each}
															</ul>
														</div>
													{/each}
												</div>
											{/each}
										</div>
									{/if}
								</details>
							{/each}
						</section>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
