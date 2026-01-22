<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { ClerkProvider } from 'svelte-clerk';
	import { PUBLIC_CLERK_PUBLISHABLE_KEY, PUBLIC_MANIFEST_MODE } from '$env/static/public';

	let { children } = $props();

	// Only enable Clerk in cloud mode with a valid publishable key
	const isCloudMode = PUBLIC_MANIFEST_MODE === 'cloud' && !!PUBLIC_CLERK_PUBLISHABLE_KEY;
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Manifest</title>
</svelte:head>

{#if isCloudMode}
	<ClerkProvider publishableKey={PUBLIC_CLERK_PUBLISHABLE_KEY}>
		{@render children()}
	</ClerkProvider>
{:else}
	{@render children()}
{/if}
