// Used for canonical URLs, OG/Twitter tags, JSON-LD, and static/sitemap.xml —
// update all of those together if this ever changes (e.g. a custom domain).
export const SITE_URL = 'https://farm-rpg-quest-tracker.pages.dev';

export const SITE_NAME = 'FarmRPG Quest Tracker';

export const SITE_TITLE = 'FarmRPG Quest Tracker';

export const SITE_AUTHOR = 'kodyy';

export const DEFAULT_DESCRIPTION =
	'Free, unofficial FarmRPG Quest Tracker: paste your inventory, queue questlines with shared inventory, ' +
	'calculate material shortfalls, explore recursive craft trees, and generate 1-click in-game trade request lists.';

export function canonicalUrl(pathname: string): string {
	return new URL(pathname, SITE_URL).toString();
}
