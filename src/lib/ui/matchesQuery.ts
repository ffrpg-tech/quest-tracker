/** Case-insensitive substring match on a trimmed query — the one search predicate shared across the inventory, questline, and shortfall-summary filters. */
export function matchesQuery(target: string, query: string): boolean {
    if (!query) return true;
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return true;
    return target.toLowerCase().includes(cleanQuery);
}
