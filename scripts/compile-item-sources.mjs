import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const rawSourcesPath = path.join(ROOT, 'src/lib/data/sources-raw.json');
const itemsPath = path.join(ROOT, 'static/items.json');
const recipesPath = path.join(ROOT, 'static/recipes.json');
const outLocationsPath = path.join(ROOT, 'static/locations.json');
const outItemSourcesPath = path.join(ROOT, 'static/item-sources.json');

const raw = JSON.parse(fs.readFileSync(rawSourcesPath, 'utf8'));
const items = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
const recipes = fs.existsSync(recipesPath) ? JSON.parse(fs.readFileSync(recipesPath, 'utf8')) : {};
const itemNames = new Set(items.map((i) => i.name));

/** Name alias corrections for common minor typos / plural differences */
const ALIASES = {
	'Boards': 'Board',
	'Apples': 'Apple',
	'Oranges': 'Orange',
	'Lemons': 'Lemon',
	'Antlers': 'Antler',
	'Gummies': 'Gummy Worms',
	'Wire': 'Steel Wire',
	'Kabobs': 'Steak Kabob',
	'Kebabs': 'Steak Kabob',
	'Raspberries': 'Raspberry',
	'Cherries': 'Cherry',
	'Blueberries': 'Blueberry',
	'Oddvocado': 'Avocado',
	'Mega Trout': 'Trout',
	'Void Bags': 'Void Bag 01',
	'Witch Hat': 'Witch Hat',
	'Sweet Root': 'Sweet Root'
};

function normalizeItemName(rawName) {
	const trimmed = rawName.trim();
	if (ALIASES[trimmed]) return ALIASES[trimmed];
	if (itemNames.has(trimmed)) return trimmed;
	// Try dropping trailing 's' if singular exists
	if (trimmed.endsWith('s') && itemNames.has(trimmed.slice(0, -1))) {
		return trimmed.slice(0, -1);
	}
	return trimmed;
}

export function slugify(name) {
	return name
		.toLowerCase()
		.replace(/'/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/** Pre-configured location metadata with level gates and verified image paths */
const LOCATION_METADATA = {
	// Exploring (only verified images kept)
	'small-cave': { name: 'Small Cave', type: 'explore', reqSkill: 'exploring', reqLevel: 1, image: '/img/items/cave.png' },
	'small-spring': { name: 'Small Spring', type: 'explore', reqSkill: 'exploring', reqLevel: 10 },
	'highland-hills': { name: 'Highland Hills', type: 'explore', reqSkill: 'exploring', reqLevel: 25 },
	'cane-pole-ridge': { name: 'Cane Pole Ridge', type: 'explore', reqSkill: 'exploring', reqLevel: 40 },
	'misty-forest': { name: 'Misty Forest', type: 'explore', reqSkill: 'exploring', reqLevel: 55 },
	'black-rock-canyon': { name: 'Black Rock Canyon', type: 'explore', reqSkill: 'exploring', reqLevel: 60 },
	'forest': { name: 'Forest', type: 'explore', reqSkill: 'exploring', reqLevel: 1 },
	'mount-banon': { name: 'Mount Banon', type: 'explore', reqSkill: 'exploring', reqLevel: 70 },
	'ember-lagoon': { name: 'Ember Lagoon', type: 'explore', reqSkill: 'exploring', reqLevel: 80 },
	'whispering-creek': { name: 'Whispering Creek', type: 'explore', reqSkill: 'exploring', reqLevel: 90 },
	'santas-workshop': { name: "Santa's Workshop", type: 'explore', season: { startDate: '12-01', endDate: '12-31' }, image: '/img/items/workshop.png' },
	'jundland-desert': { name: 'Jundland Desert', type: 'explore', reqSkill: 'exploring', reqLevel: 99 },
	'haunted-house': { name: 'Haunted House', type: 'explore', season: { startDate: '10-15', endDate: '11-05' } },
	'garys-crushroom': { name: "Gary's Crushroom", type: 'explore', reqSkill: 'exploring', reqLevel: 99 },
	'sinking-swamp-explore': { name: 'Sinking Swamp (Explore)', type: 'explore', reqSkill: 'exploring', reqLevel: 99, image: '/img/items/swamp.png' },

	// Fishing (only verified images kept)
	'small-pond': { name: 'Small Pond', type: 'fish', reqSkill: 'fishing', reqLevel: 1, image: '/img/items/pond.png' },
	'farm-pond': { name: 'Farm Pond', type: 'fish', reqSkill: 'fishing', reqLevel: 1, image: '/img/items/pond.png' },
	'forest-pond': { name: 'Forest Pond', type: 'fish', reqSkill: 'fishing', reqLevel: 10 },
	'lake-tempest': { name: 'Lake Tempest', type: 'fish', reqSkill: 'fishing', reqLevel: 30 },
	'small-island': { name: 'Small Island', type: 'fish', reqSkill: 'fishing', reqLevel: 45 },
	'crystal-river': { name: 'Crystal River', type: 'fish', reqSkill: 'fishing', reqLevel: 60 },
	'emerald-beach': { name: 'Emerald Beach', type: 'fish', reqSkill: 'fishing', reqLevel: 70 },
	'vast-ocean': { name: 'Vast Ocean', type: 'fish', reqSkill: 'fishing', reqLevel: 80 },
	'lake-minerva': { name: 'Lake Minerva', type: 'fish', reqSkill: 'fishing', reqLevel: 90 },
	'large-island': { name: 'Large Island', type: 'fish', reqSkill: 'fishing', reqLevel: 95, image: '/img/items/largeisland.png' },
	'pirates-cove': { name: "Pirate's Cove", type: 'fish', reqSkill: 'fishing', reqLevel: 99 },
	'glacier-lake': { name: 'Glacier Lake', type: 'fish', reqSkill: 'fishing', reqLevel: 99 },
	'apple-bobbing': { name: 'Apple Bobbing', type: 'fish', season: { startDate: '09-15', endDate: '10-31' } },
	'sinking-swamp-fish': { name: 'Sinking Swamp (Fishing)', type: 'fish', reqSkill: 'fishing', reqLevel: 99 },

	// Farm & Store (only verified images kept)
	'crops': { name: 'Farm Crops', type: 'farm' },
	'country-store': { name: 'Country Store', type: 'store' },
	'steak-market': { name: 'Steak Market', type: 'store', image: '/img/items/steak.png' },
	'wishing-well': { name: 'Wishing Well', type: 'well', image: '/img/items/well.png' },
	'exchange-center': { name: 'Exchange Center', type: 'exchange', image: '/img/items/exchange.png' },
	'temple': { name: 'Temples', type: 'temple', image: '/img/items/temple.png' },

	// Workshop / Crafting
	'workshop': { name: 'Workshop', type: 'workshop', image: '/img/items/hammer.png?2' }
};

const locations = { ...LOCATION_METADATA };
const itemSourcesMap = new Map(); // ItemName -> Array of SourceRefs

function addSource(itemName, sourceRef) {
	if (!itemSourcesMap.has(itemName)) {
		itemSourcesMap.set(itemName, []);
	}
	const list = itemSourcesMap.get(itemName);
	// Avoid duplicates for same location ID and tier
	if (!list.some((s) => s.locId === sourceRef.locId && s.tier === sourceRef.tier)) {
		list.push(sourceRef);
	}
}

// 1. Process Exploring
for (const [locName, itemList] of Object.entries(raw.Exploring || {})) {
	const locId = locName === 'Sinking Swamp' ? 'sinking-swamp-explore' : slugify(locName);
	if (!locations[locId]) {
		locations[locId] = { name: locName, type: 'explore' };
	}
	for (const rawItem of itemList) {
		const item = normalizeItemName(rawItem);
		addSource(item, { locId });
	}
}

// 2. Process Fishing
for (const [locName, itemList] of Object.entries(raw.Fishing || {})) {
	const locId = locName === 'Sinking Swamp' ? 'sinking-swamp-fish' : slugify(locName);
	if (!locations[locId]) {
		locations[locId] = { name: locName, type: 'fish' };
	}
	for (const rawItem of itemList) {
		const item = normalizeItemName(rawItem);
		addSource(item, { locId });
	}
}

// 3. Process Farm
for (const [farmSection, itemList] of Object.entries(raw.Farm || {})) {
	if (farmSection === 'Crops') {
		for (const rawItem of itemList) {
			const item = normalizeItemName(rawItem);
			addSource(item, { locId: 'crops' });
		}
	} else {
		// Farm buildings / facilities
		const buildingId = `building-${slugify(farmSection)}`;
		if (!locations[buildingId]) {
			locations[buildingId] = {
				name: farmSection,
				type: 'building'
			};
		}
		for (const rawItem of itemList) {
			const item = normalizeItemName(rawItem);
			addSource(item, { locId: buildingId });
		}
	}
}

// 4. Process Town & Markets
for (const [marketName, itemList] of Object.entries(raw['Town & Markets'] || {})) {
	const locId = marketName === 'Country Store' ? 'country-store' : 'steak-market';
	for (const rawItem of itemList) {
		const item = normalizeItemName(rawItem);
		addSource(item, { locId });
	}
}

// 5. Process Wishing Well
for (const [tierName, itemList] of Object.entries(raw['Wishing Well'] || {})) {
	for (const rawItem of itemList) {
		const item = normalizeItemName(rawItem);
		addSource(item, { locId: 'wishing-well', tier: tierName });
	}
}

// 6. Process Exchange Center
for (const [tierName, itemList] of Object.entries(raw['Exchange Center'] || {})) {
	for (const rawItem of itemList) {
		const item = normalizeItemName(rawItem);
		addSource(item, { locId: 'exchange-center', tier: tierName });
	}
}

// 7. Process Temples
for (const [tierName, itemList] of Object.entries(raw.Temples || {})) {
	for (const rawItem of itemList) {
		const item = normalizeItemName(rawItem);
		addSource(item, { locId: 'temple', tier: tierName });
	}
}

// 8. Process Pets (only verified images kept for cat, dog, spider)
const VERIFIED_PET_IMAGES = new Set(['cat', 'dog', 'spider']);
for (const [petName, levels] of Object.entries(raw.Pets || {})) {
	const petId = `pet-${slugify(petName)}`;
	if (!locations[petId]) {
		const petSlug = slugify(petName);
		const petImage = VERIFIED_PET_IMAGES.has(petSlug) ? `/img/pets/pet_${petSlug}1.png` : undefined;
		locations[petId] = {
			name: petName,
			type: 'pet',
			...(petImage ? { image: petImage } : {})
		};
	}
	for (const [lvl, itemList] of Object.entries(levels)) {
		for (const rawItem of itemList) {
			const item = normalizeItemName(rawItem);
			addSource(item, { locId: petId, tier: lvl });
		}
	}
}

// 9. Process Workshop Recipes
for (const craftableItem of Object.keys(recipes)) {
	const item = normalizeItemName(craftableItem);
	addSource(item, { locId: 'workshop' });
}

/** Subjective primary overrides for items best known for a specific farm building */
const PRIMARY_OVERRIDES = {
	'Bacon': 'building-pig-pen',
	'Milk': 'building-cow-pasture',
	'Egg': 'building-chicken-coop',
	'Eggs': 'building-chicken-coop',
	'Black Truffle': 'building-pig-pen',
	'White Truffle': 'building-pig-pen'
};

/**
 * 5-tier scoring function:
 * 0: Primary Override
 * Tier 1 (1000..1999): Permanent Active Locations (Explore, Fish, Farm Crops), ordered by level gate
 * Tier 2 (2000): Permanent Workshop (Crafting)
 * Tier 3 (3000..3999): Permanent Passives (Farm buildings first, then Pets L1 < L3 < L6)
 * Tier 4 (4000..4999): Permanent Markets, Temples, Exchange Center, Wishing Well
 * Tier 5 (5000..5999): Seasonal Sources (never primary unless sole source)
 */
function getSourceScore(itemName, sourceRef) {
	if (PRIMARY_OVERRIDES[itemName] && sourceRef.locId === PRIMARY_OVERRIDES[itemName]) {
		return 0;
	}

	const loc = locations[sourceRef.locId];
	const isSeasonal = Boolean(loc?.season || sourceRef.season);
	const type = loc?.type || 'other';

	if (!isSeasonal) {
		// Tier 1: Permanent Active Locations
		if (type === 'explore' || type === 'fish' || type === 'farm') {
			const reqLevel = loc?.reqLevel ?? 1;
			return 1000 + reqLevel;
		}

		// Tier 2: Permanent Workshop
		if (type === 'workshop') {
			return 2000;
		}

		// Tier 3: Permanent Passives
		if (type === 'building') {
			return 3000;
		}
		if (type === 'pet') {
			const lvlMatch = sourceRef.tier?.match(/\d+/);
			const petLvl = lvlMatch ? parseInt(lvlMatch[0], 10) : 1;
			return 3500 + petLvl;
		}

		// Tier 4: Permanent Markets, Temples, Exchange Center, Wishing Well
		if (type === 'store') return 4100;
		if (type === 'well') return 4200;
		if (type === 'exchange') return 4300;
		if (type === 'temple') return 4400;

		return 4900;
	} else {
		// Tier 5: Seasonals
		if (type === 'explore' || type === 'fish' || type === 'farm') return 5100;
		if (type === 'workshop') return 5200;
		if (type === 'building') return 5300;
		if (type === 'pet') return 5400;
		if (type === 'well' || type === 'exchange' || type === 'temple' || type === 'store') return 5500;
		return 5900;
	}
}

// Validate uncataloged items against items.json
const uncataloged = [];
for (const itemName of itemSourcesMap.keys()) {
	if (!itemNames.has(itemName)) {
		uncataloged.push(itemName);
	}
}

// Output item-sources dictionary with ranked sources
const itemSourcesOutput = {};
for (const [name, sources] of itemSourcesMap.entries()) {
	sources.sort((a, b) => {
		const scoreA = getSourceScore(name, a);
		const scoreB = getSourceScore(name, b);
		return scoreA - scoreB;
	});
	itemSourcesOutput[name] = sources;
}

const outLocationsSamplePath = path.join(ROOT, 'static/locations.sample.json');
const outItemSourcesSamplePath = path.join(ROOT, 'static/item-sources.sample.json');
const outItemSourcesMetaPath = path.join(ROOT, 'static/item-sources-meta.json');
const outItemSourcesMetaSamplePath = path.join(ROOT, 'static/item-sources-meta.sample.json');

const metaPayload = {
	lastUpdated: new Date().toISOString()
};

fs.writeFileSync(outLocationsPath, JSON.stringify(locations, null, 2));
fs.writeFileSync(outLocationsSamplePath, JSON.stringify(locations, null, 2));
fs.writeFileSync(outItemSourcesPath, JSON.stringify(itemSourcesOutput, null, 2));
fs.writeFileSync(outItemSourcesSamplePath, JSON.stringify(itemSourcesOutput, null, 2));
fs.writeFileSync(outItemSourcesMetaPath, JSON.stringify(metaPayload, null, 2));
fs.writeFileSync(outItemSourcesMetaSamplePath, JSON.stringify(metaPayload, null, 2));

console.log(`Successfully compiled:`);
console.log(`  - ${Object.keys(locations).length} locations -> ${outLocationsPath}`);
console.log(`  - ${Object.keys(itemSourcesOutput).length} item source entries -> ${outItemSourcesPath}`);
console.log(`  - Metadata -> ${outItemSourcesMetaPath}`);

if (uncataloged.length > 0) {
	console.warn(`\nWarning: Found ${uncataloged.length} uncataloged item names (not in static/items.json):`);
	console.warn(uncataloged.join(', '));
}
