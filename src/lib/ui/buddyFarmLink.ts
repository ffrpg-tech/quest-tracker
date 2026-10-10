/**
 * Slug generator for buddy.farm URLs:
 * lowercase, apostrophes dropped (not hyphenated), everything else non-alphanumeric
 * collapsed to a single hyphen. E.g. "Buddystone" -> "buddystone",
 * "Cursed Effigy Hair" -> "cursed-effigy-hair", "Santa's Workshop" -> "santas-workshop".
 */
export function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/'/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export function buddyFarmItemUrl(name: string): string {
	return `https://buddy.farm/i/${slugify(name)}/`;
}

export function buddyFarmLocationUrl(name: string): string {
	return `https://buddy.farm/l/${slugify(name)}/`;
}

export function buddyFarmPetUrl(name: string): string {
	return `https://buddy.farm/p/${slugify(name)}/`;
}

/**
 * Resolves buddy.farm outbound URLs for item sources based on category.
 * Only Exploring and Fishing zones have valid /l/{slug}/ pages on buddy.farm.
 * Pets have valid /p/{slug}/ pages.
 * All other categories (Workshop, Farm, Buildings, Well, Shops, Exchange, Temples)
 * do not have location pages on buddy.farm and return null to prevent 404 links.
 */
export function getSourceUrl(name: string, category: string): string | null {
	if (
		category === 'explore' ||
		category === 'fish' ||
		category === 'mining' ||
		category === 'exploring' ||
		category === 'fishing'
	) {
		const cleanName = name.replace(/\s*\((Explore|Fishing|Mining)\)$/i, '').trim();
		return buddyFarmLocationUrl(cleanName);
	}
	if (category === 'pet' || category === 'pets') {
		const cleanName = name.replace(/\s*\(Level\s*\d+\)$/i, '').trim();
		return buddyFarmPetUrl(cleanName);
	}
	return null;
}
