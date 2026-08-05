/** Adds thousands separators (e.g. 1000000 -> "1,000,000"). */
export function formatNumber(n: number): string {
	return n.toLocaleString('en-US');
}
