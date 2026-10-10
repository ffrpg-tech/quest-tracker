/**
 * Robust clipboard helper supporting modern navigator.clipboard with execCommand fallback.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	if (!text) return false;
	try {
		if (navigator.clipboard && window.isSecureContext) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch (e) {
		console.warn('navigator.clipboard.writeText failed, trying fallback:', e);
	}

	try {
		const textArea = document.createElement('textarea');
		textArea.value = text;
		textArea.style.position = 'fixed';
		textArea.style.left = '-999999px';
		textArea.style.top = '-999999px';
		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();
		const successful = document.execCommand('copy');
		document.body.removeChild(textArea);
		return successful;
	} catch (err) {
		console.error('Copy to clipboard failed:', err);
		return false;
	}
}
