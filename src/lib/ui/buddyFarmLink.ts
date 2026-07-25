/** buddy.farm's item pages use a slug derived from the item name: lowercase,
 * apostrophes dropped (not hyphenated), everything else non-alphanumeric
 * collapsed to a single hyphen. E.g. "Buddystone" -> "buddystone",
 * "Cursed Effigy Hair" -> "cursed-effigy-hair". */
export function buddyFarmItemUrl(name: string): string {
	const slug = name
		.toLowerCase()
		.replace(/'/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return `https://buddy.farm/i/${slug}/`;
}
