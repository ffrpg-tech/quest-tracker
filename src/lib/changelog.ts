export interface ChangelogSection {
	heading: string;
	items: string[];
}

export interface ChangelogEntry {
	version: string;
	date: string | null;
	sections: ChangelogSection[];
}

/**
 * Parses a Keep a Changelog-style markdown file (see CHANGELOG.md) into
 * structured entries. Only understands the subset this project's file
 * actually uses: `## [version] - date` (or `## [Unreleased]`) entry headings
 * with `### Section` subheadings and `- item` bullet lists under each.
 * Anything else (prose, links at the bottom) is ignored.
 */
export function parseChangelog(raw: string): ChangelogEntry[] {
	const entries: ChangelogEntry[] = [];
	const lines = raw.split('\n');

	let current: ChangelogEntry | null = null;
	let currentSection: ChangelogSection | null = null;

	for (const line of lines) {
		const entryMatch = /^##\s+\[([^\]]+)\](?:\s*-\s*(.+))?/.exec(line);
		if (entryMatch) {
			current = { version: entryMatch[1], date: entryMatch[2]?.trim() ?? null, sections: [] };
			entries.push(current);
			currentSection = null;
			continue;
		}

		const sectionMatch = /^###\s+(.+)/.exec(line);
		if (sectionMatch && current) {
			currentSection = { heading: sectionMatch[1].trim(), items: [] };
			current.sections.push(currentSection);
			continue;
		}

		const itemMatch = /^-\s+(.+)/.exec(line);
		if (itemMatch && currentSection) {
			currentSection.items.push(itemMatch[1].trim());
		}
	}

	return entries;
}

/** Skips "Unreleased" and any entry with no items yet, since those have nothing to show. */
export function releasedEntries(entries: ChangelogEntry[]): ChangelogEntry[] {
	return entries.filter(
		(e) => e.version.toLowerCase() !== 'unreleased' && e.sections.some((s) => s.items.length > 0)
	);
}

export function latestVersion(entries: ChangelogEntry[]): string | null {
	return releasedEntries(entries)[0]?.version ?? null;
}

export interface ChangelogGroup {
	/** The shared "major.minor" prefix (e.g. "0.2" for 0.2.5, 0.2.4, ...). */
	minor: string;
	entries: ChangelogEntry[];
}

/**
 * Groups entries by their "major.minor" version (0.2.5 and 0.2.4 both land
 * under "0.2"), preserving the newest-first order `entries` already comes
 * in. Used to collapse older minor versions in the changelog page as the
 * release list keeps growing, without needing separate pages/routes per
 * version — a version string that doesn't match the expected shape falls
 * back to grouping under itself rather than being dropped.
 */
export function groupByMinor(entries: ChangelogEntry[]): ChangelogGroup[] {
	const groups: ChangelogGroup[] = [];
	const byMinor = new Map<string, ChangelogGroup>();

	for (const entry of entries) {
		const match = /^(\d+\.\d+)\./.exec(entry.version);
		const minor = match ? match[1] : entry.version;

		let group = byMinor.get(minor);
		if (!group) {
			group = { minor, entries: [] };
			byMinor.set(minor, group);
			groups.push(group);
		}
		group.entries.push(entry);
	}

	return groups;
}
