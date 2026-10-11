/**
 * Svelte action that moves a DOM element to document.body on mount and cleans
 * it up on destroy. Used by modals and sheets that need to escape ancestor
 * stacking contexts, overflow clipping, or transform containers.
 */
export function portal(node: HTMLElement) {
	if (typeof document !== 'undefined' && document.body) {
		document.body.appendChild(node);
	}

	return {
		destroy() {
			if (node.parentNode) {
				node.parentNode.removeChild(node);
			}
		}
	};
}
