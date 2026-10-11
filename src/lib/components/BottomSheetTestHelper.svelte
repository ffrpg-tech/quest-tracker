<script lang="ts">
	import BottomSheet from './BottomSheet.svelte';

	let {
		open = $bindable(true),
		title = 'Test Sheet',
		onClose
	}: {
		open?: boolean;
		title?: string;
		onClose?: () => void;
	} = $props();
</script>

<button id="outside-trigger" type="button">Outside Button</button>
<button id="another-outside" type="button">Another Outside</button>

<BottomSheet bind:open {title} {onClose}>
	<button id="sheet-btn-1" type="button">Inside Button 1</button>
	<button id="sheet-btn-2" type="button">Inside Button 2</button>
</BottomSheet>
