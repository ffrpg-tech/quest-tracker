// Copies static/*.sample.json -> static/*.json for any target that doesn't
// already exist, so a fresh clone has fake-but-shaped data to run against
// without needing the gitignored api/ fetch pipeline. Never overwrites a
// real (fetched) file that's already there.
import { copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const staticDir = fileURLToPath(new URL('../static', import.meta.url));

const targets = [
	['questlines.sample.json', 'questlines.json'],
	['items.sample.json', 'items.json'],
	['npc.sample.json', 'npc.json'],
	['locations.sample.json', 'locations.json'],
	['item-sources.sample.json', 'item-sources.json']
];

for (const [sample, target] of targets) {
	const targetPath = path.join(staticDir, target);
	if (existsSync(targetPath)) continue;
	copyFileSync(path.join(staticDir, sample), targetPath);
	console.log(`[seed-data] wrote static/${target} from ${sample}`);
}
