/**
 * One place for the interactive-element treatment (cursor, hover
 * highlight, pressed/active state) so every button/pill/icon in the app
 * behaves consistently instead of each spot hand-rolling its own subset
 * of hover/active classes. `active` marks a toggle-style control (status
 * pills) as currently selected, not the CSS :active pseudo-class.
 */
export function buttonClass(
	variant: 'default' | 'primary' | 'dark' | 'pill' | 'pill-danger' | 'icon' | 'icon-danger' | 'link' = 'default',
	active = false
): string {
	const base = 'cursor-pointer transition-colors disabled:cursor-not-allowed';
	switch (variant) {
		case 'primary':
			return `${base} rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40`;
		case 'dark':
			return `${base} rounded bg-gray-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-900 active:bg-gray-950 disabled:opacity-40 dark:bg-gray-700 dark:hover:bg-gray-600 dark:active:bg-gray-500`;
		case 'pill':
			return active
				? `${base} rounded-full border border-emerald-600 bg-emerald-600 px-2.5 py-1 text-white hover:bg-emerald-700 active:bg-emerald-800`
				: `${base} rounded-full border border-gray-300 px-2.5 py-1 text-gray-600 hover:bg-gray-100 active:bg-gray-200 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:active:bg-gray-700`;
		case 'pill-danger':
			// A pill toggle whose active state warns rather than confirms (e.g. "show
			// expired-season content"), so it gets the icon-danger red instead of pill's emerald.
			return active
				? `${base} rounded-full border border-red-600 bg-red-600 px-2.5 py-1 text-white hover:bg-red-700 active:bg-red-800`
				: `${base} rounded-full border border-gray-300 px-2.5 py-1 text-gray-600 hover:bg-gray-100 active:bg-gray-200 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:active:bg-gray-700`;
		case 'icon':
			// `active` here also covers icon-as-checkbox toggles (e.g. the questline
			// picker's filter icons), not just the plain one-shot icon buttons this
			// variant started as — hence the filled state below.
			return active
				? `${base} rounded bg-emerald-600 p-1.5 text-white hover:bg-emerald-700 active:bg-emerald-800`
				: `${base} rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 active:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 dark:active:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent`;
		case 'icon-danger':
			// Destructive/clearing actions (remove item, clear inventory, clear a search or paste field) get a consistent red tint instead of the neutral icon color, so their intent reads at a glance.
			// `active` covers the same toggle case as 'icon' above, for danger-toned toggles (e.g. "show unavailable").
			return active
				? `${base} rounded bg-red-600 p-1.5 text-white hover:bg-red-700 active:bg-red-800`
				: `${base} rounded p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 active:bg-red-100 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300 dark:active:bg-red-900 disabled:opacity-30 disabled:hover:bg-transparent`;
		case 'link':
			return `${base} text-xs text-emerald-600 hover:text-emerald-700 hover:underline active:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300`;
		default:
			return `${base} rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 active:bg-gray-200 dark:border-gray-600 dark:hover:bg-gray-800 dark:active:bg-gray-700`;
	}
}
