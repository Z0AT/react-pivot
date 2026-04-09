<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Desire Cache</title>
	<meta
		name="description"
		content="Desire Cache staging app. SvelteKit frontend scaffold against the canonical /api/items backend."
	/>
</svelte:head>

{@render children()}
