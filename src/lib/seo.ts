// Used for canonical URLs, OG/Twitter tags, JSON-LD, and static/sitemap.xml —
// update all of those together if this ever changes (e.g. a custom domain).
export const SITE_URL = 'https://farm-rpg-quest-tracker.pages.dev';

export const SITE_NAME = 'FarmRPG Quest Tracker';

export const DEFAULT_DESCRIPTION =
	'Free FarmRPG tool for tracking your inventory for quests: paste your inventory, queue Quest Wall questlines that share one ' +
	"inventory, and see the first quest you can't complete in each.";

export function canonicalUrl(pathname: string): string {
	return new URL(pathname, SITE_URL).toString();
}
