<script lang="ts">
	import { X, Sun, Moon, Settings } from '@lucide/svelte';
	import { buttonClass } from '$lib/ui/buttonClass';
	import { trapFocus } from '$lib/ui/trapFocus';
	import { tutorialSteps } from '$lib/tutorial';
	import { parseChangelog } from '$lib/changelog';
	import changelogRaw from '../../../CHANGELOG.md?raw';
	import { APP_VERSION } from '$lib/version';

	let {
		open = $bindable(false),
		showAllItems = $bindable(false),
		showCraftable = $bindable(true),
		maxCapacity = $bindable<number | null>(null),
		darkMode = $bindable(false),
		onToggleDarkMode
	}: {
		open: boolean;
		showAllItems: boolean;
		showCraftable: boolean;
		maxCapacity: number | null;
		darkMode: boolean;
		onToggleDarkMode: () => void;
	} = $props();

	type SettingsTab = 'preferences' | 'about' | 'tutorial' | 'credits' | 'changelog';
	let activeTab = $state<SettingsTab>('preferences');

	const changelogEntries = $derived(parseChangelog(changelogRaw));

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
			class="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-800 dark:text-gray-100"
			role="dialog"
			aria-modal="true"
			aria-labelledby="settings-modal-title"
			use:trapFocus={() => (open = false)}
		>
			<!-- Modal Header -->
			<div
				class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700"
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
				class="flex flex-wrap gap-1 border-b border-gray-200 bg-gray-50/80 px-6 py-2 text-xs font-medium dark:border-gray-700 dark:bg-gray-900/50"
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
			<div class="flex-1 overflow-y-auto p-6 text-sm">
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
						<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">
							Why did I create this?
						</h3>
						<p>
							Farm RPG has no shortage of quest data — <a
								href="https://buddy.farm"
								target="_blank"
								rel="noopener noreferrer"
								class="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
								>buddy.farm</a
							>
							already covers every questline and item. What it doesn't have is a checklist. So people
							make their own: <strong>Quest Wall</strong> sheets, one questline at a time. However, it
							is mainly focused on main quests, leaving other quests without their own dedicated sheets.
						</p>
						<p>
							Additionally, because sheets only cover one questline at a time, it is difficult to
							see the bigger picture. While we need to focus on one chain at a time, we also need to
							plan ahead. If you have two sheets tackling different questlines, you end up syncing
							the same inventory into both by hand and manually calculating materials.
						</p>
						<p>
							That's exactly what happened while working on my ATI questline, and I realized it
							wouldn't stop being a problem once ATI was finished. So I built this tracker to plan
							out entire queues of questlines and pinpoint exactly where materials run dry.
						</p>
						<p>It is an open, non-commercial fan project built for the community.</p>
					</div>
				{:else if activeTab === 'tutorial'}
					<div class="space-y-4">
						<div>
							<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">Getting started</h3>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								A quick walkthrough of the initial setup and everyday workflow loop.
							</p>
						</div>

						<ol class="divide-y divide-gray-100 dark:divide-gray-700">
							{#each tutorialSteps as s (s.step)}
								<li class="py-3">
									<div class="font-semibold text-gray-900 dark:text-gray-100">
										{s.step}. {s.title}
									</div>
									<div class="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
										{s.summary}
									</div>
									<p class="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
										{s.details}
									</p>
								</li>
							{/each}
						</ol>
					</div>
				{:else if activeTab === 'credits'}
					<div class="space-y-4 leading-relaxed text-gray-700 dark:text-gray-300">
						<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">
							Credits & Acknowledgments
						</h3>
						<div>
							<h4 class="font-semibold text-gray-900 dark:text-gray-100">
								FarmRPG and its community
							</h4>
							<p class="mt-1 text-xs">
								FarmRPG and all related marks and materials are trademarks of <strong
									>Magic and Wires, LLC</strong
								> (farmrpg.com). This is an unofficial fan project and is not affiliated with Magic and
								Wires, LLC.
							</p>
							<ul class="mt-2 list-disc pl-5 space-y-1 text-xs">
								<li>
									<strong class="text-emerald-600 dark:text-emerald-400">Erisere</strong> — shared initial
									quest data CSV.
								</li>
								<li>
									<strong class="text-emerald-600 dark:text-emerald-400">Natsulus</strong> — early insights
									on client-side inventory collection.
								</li>
								<li>
									FarmRPG Staff <strong class="text-emerald-600 dark:text-emerald-400"
										>coderanger</strong
									> — technical assistance and data pipeline guidance.
								</li>
								<li>
									<strong class="text-emerald-600 dark:text-emerald-400">Lex 26</strong> — testing feedback
									& inspiration from their CraftTree website.
								</li>
								<li>
									FarmRPG Staff <strong class="text-emerald-600 dark:text-emerald-400">Rkm13</strong
									> — clarifications and adding this tool to Community Guides!
								</li>
								<li>
									<strong class="text-emerald-600 dark:text-emerald-400">You</strong> — for using the
									application!
								</li>
							</ul>
						</div>

						<div class="border-t border-gray-100 pt-3 dark:border-gray-700">
							<h4 class="font-semibold text-gray-900 dark:text-gray-100">
								Sheet creators & maintainers
							</h4>
							<p class="mt-1 text-xs">
								Special thanks to the authors of <em>A Towering Investment Checklist & Strategy</em>
								and <em>Compare Completed Quests</em> spreadsheets whose groundwork made this calculator
								possible.
							</p>
						</div>
					</div>
				{:else if activeTab === 'changelog'}
					<div class="space-y-4">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">Changelog</h3>
								<p class="text-xs text-gray-500 dark:text-gray-400">
									Current Active Version: <strong>v{APP_VERSION}</strong>
								</p>
							</div>
						</div>

						<div class="space-y-6">
							{#each changelogEntries as release (release.version)}
								<div class="border-l-2 border-sky-500 pl-3">
									<div class="flex items-center gap-2">
										<span class="font-bold text-gray-900 dark:text-gray-100"
											>v{release.version}</span
										>
										{#if release.date}
											<span class="text-xs text-gray-400">{release.date}</span>
										{/if}
									</div>
									<div class="mt-2 space-y-2 text-xs">
										{#each release.sections as section (section.heading)}
											<div>
												<span
													class="font-semibold uppercase tracking-wider text-[10px] text-gray-500 dark:text-gray-400"
												>
													{section.heading}
												</span>
												<ul
													class="mt-1 list-disc pl-4 space-y-0.5 text-gray-600 dark:text-gray-300"
												>
													{#each section.items as item (item)}
														<li>{item}</li>
													{/each}
												</ul>
											</div>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
