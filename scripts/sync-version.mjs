import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const changelogPath = path.join(rootDir, 'CHANGELOG.md');
const packageJsonPath = path.join(rootDir, 'package.json');
const packageLockPath = path.join(rootDir, 'package-lock.json');
const staticVersionPath = path.join(rootDir, 'static', 'version.json');

/**
 * Extracts the latest released version from Keep a Changelog-formatted markdown.
 * Skips [Unreleased] and returns the first version heading.
 *
 * @param {string} raw
 * @returns {string | null}
 */
export function extractLatestVersion(raw) {
	const lines = raw.split('\n');
	for (const line of lines) {
		const match = /^##\s+\[([^\]]+)\](?:\s*-\s*(.+))?/.exec(line);
		if (match) {
			const version = match[1].trim();
			if (version.toLowerCase() !== 'unreleased') {
				return version;
			}
		}
	}
	return null;
}

/**
 * Synchronizes the version in package.json, package-lock.json, and static/version.json
 * with the latest version declared in CHANGELOG.md.
 *
 * @param {{ checkOnly?: boolean, quiet?: boolean }} [options]
 * @returns {{ version: string, updated: string[], mismatches: string[] }}
 */
export function syncVersion(options = {}) {
	const { checkOnly = false, quiet = false } = options;

	if (!fs.existsSync(changelogPath)) {
		throw new Error(`CHANGELOG.md not found at ${changelogPath}`);
	}

	const changelogRaw = fs.readFileSync(changelogPath, 'utf8');
	const version = extractLatestVersion(changelogRaw);

	if (!version) {
		throw new Error('Could not find any released version in CHANGELOG.md');
	}

	const updated = [];
	const mismatches = [];

	// 1. package.json
	if (fs.existsSync(packageJsonPath)) {
		const pkgRaw = fs.readFileSync(packageJsonPath, 'utf8');
		const pkg = JSON.parse(pkgRaw);
		if (pkg.version !== version) {
			if (checkOnly) {
				mismatches.push(`package.json (has ${pkg.version}, expected ${version})`);
			} else {
				pkg.version = version;
				fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, '\t') + '\n', 'utf8');
				updated.push('package.json');
			}
		}
	}

	// 2. package-lock.json
	if (fs.existsSync(packageLockPath)) {
		const lockRaw = fs.readFileSync(packageLockPath, 'utf8');
		const lock = JSON.parse(lockRaw);
		const rootPkgVersion = lock.packages?.['']?.version;
		const needsUpdate = lock.version !== version || (rootPkgVersion && rootPkgVersion !== version);

		if (needsUpdate) {
			if (checkOnly) {
				mismatches.push(
					`package-lock.json (has ${lock.version} / pkg: ${rootPkgVersion}, expected ${version})`
				);
			} else {
				lock.version = version;
				if (lock.packages && lock.packages['']) {
					lock.packages[''].version = version;
				}
				fs.writeFileSync(packageLockPath, JSON.stringify(lock, null, '\t') + '\n', 'utf8');
				updated.push('package-lock.json');
			}
		}
	}

	// 3. static/version.json
	const expectedStaticJson = JSON.stringify({ version }, null, 2) + '\n';
	let staticNeedsUpdate = true;
	if (fs.existsSync(staticVersionPath)) {
		const currentStaticRaw = fs.readFileSync(staticVersionPath, 'utf8');
		try {
			const parsed = JSON.parse(currentStaticRaw);
			if (parsed.version === version && currentStaticRaw.trim() === expectedStaticJson.trim()) {
				staticNeedsUpdate = false;
			}
		} catch {
			staticNeedsUpdate = true;
		}
	}

	if (staticNeedsUpdate) {
		if (checkOnly) {
			mismatches.push(`static/version.json (does not match ${version})`);
		} else {
			fs.mkdirSync(path.dirname(staticVersionPath), { recursive: true });
			fs.writeFileSync(staticVersionPath, expectedStaticJson, 'utf8');
			updated.push('static/version.json');
		}
	}

	if (!quiet) {
		if (checkOnly) {
			if (mismatches.length > 0) {
				console.error(
					`[sync-version] Version mismatch detected against CHANGELOG.md (v${version}):`
				);
				for (const m of mismatches) console.error(`  - ${m}`);
			} else {
				console.log(`[sync-version] All version files match CHANGELOG.md (v${version}).`);
			}
		} else {
			if (updated.length > 0) {
				console.log(`[sync-version] Synchronized version ${version} to: ${updated.join(', ')}`);
			}
		}
	}

	return { version, updated, mismatches };
}

// Run immediately if invoked as CLI script
const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFile)) {
	const isCheck = process.argv.includes('--check');
	try {
		const result = syncVersion({ checkOnly: isCheck });
		if (isCheck && result.mismatches.length > 0) {
			process.exit(1);
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`[sync-version] Error: ${message}`);
		process.exit(1);
	}
}
