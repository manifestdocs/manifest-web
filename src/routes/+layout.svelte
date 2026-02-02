<script lang="ts">
  import '../app.css';
  import favicon from '$lib/assets/favicon.svg';
  import faviconDark from '$lib/assets/favicon-dark.svg';

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} media="(prefers-color-scheme: light)" />
  <link rel="icon" href={faviconDark} media="(prefers-color-scheme: dark)" />
  <title>Manifest</title>
</svelte:head>

{@render children()}
