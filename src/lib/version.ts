import changelogRaw from '../../CHANGELOG.md?raw';
import { parseChangelog, latestVersion } from './changelog';
import { loadCachedAppVersion, saveCachedAppVersion } from './quest/storage/persistence';

export const APP_VERSION = latestVersion(parseChangelog(changelogRaw)) ?? '0.0.0';

/**
 * Compares two semantic version strings (e.g. '0.4.2' and '0.4.1').
 * Returns 1 if v1 > v2, -1 if v1 < v2, and 0 if equal.
 */
export function compareSemver(v1: string, v2: string): number {
	const p1 = v1
		.replace(/^v/, '')
		.split('.')
		.map((n) => parseInt(n, 10) || 0);
	const p2 = v2
		.replace(/^v/, '')
		.split('.')
		.map((n) => parseInt(n, 10) || 0);
	const len = Math.max(p1.length, p2.length);
	for (let i = 0; i < len; i++) {
		const a = p1[i] ?? 0;
		const b = p2[i] ?? 0;
		if (a > b) return 1;
		if (a < b) return -1;
	}
	return 0;
}

/**
 * Fetches the deployed version from /version.json with cache-busting.
 */
export async function fetchDeployedVersion(): Promise<string | null> {
	if (typeof window === 'undefined') return null;
	try {
		const res = await fetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' });
		if (!res.ok) return null;
		const data = await res.json();
		return typeof data.version === 'string' ? data.version : null;
	} catch {
		return null;
	}
}

/**
 * Checks if a newer version is available by comparing either the deployed version
 * or current client version against the cached version in localStorage.
 */
export async function checkForUpdate(): Promise<{
	hasUpdate: boolean;
	latestVersion: string | null;
}> {
	if (typeof window === 'undefined') return { hasUpdate: false, latestVersion: null };

	const cachedVersion = loadCachedAppVersion();
	// If never cached before, save the current client version
	if (!cachedVersion) {
		saveCachedAppVersion(APP_VERSION);
	}

	const deployed = await fetchDeployedVersion();
	const referenceVersion = deployed ?? APP_VERSION;

	if (cachedVersion && compareSemver(referenceVersion, cachedVersion) > 0) {
		return { hasUpdate: true, latestVersion: referenceVersion };
	}

	return { hasUpdate: false, latestVersion: null };
}

/**
 * Purges CacheStorage and ServiceWorker registrations, updates the cached version,
 * and triggers a cache-busting hard reload.
 */
export async function purgeCachesAndHardReload(targetVersion: string = APP_VERSION): Promise<void> {
	if (typeof window === 'undefined') return;

	try {
		saveCachedAppVersion(targetVersion);

		if ('caches' in window) {
			const keys = await caches.keys();
			await Promise.all(keys.map((k) => caches.delete(k)));
		}

		if ('serviceWorker' in navigator) {
			const registrations = await navigator.serviceWorker.getRegistrations();
			await Promise.all(registrations.map((r) => r.unregister()));
		}
	} catch {
		// Proceed with reload even if cache clearing encounters an error
	}

	const url = new URL(window.location.href);
	url.searchParams.set('_v', Date.now().toString());
	window.location.href = url.toString();
}
