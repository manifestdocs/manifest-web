<script lang="ts">
    // Docs landing page - redirects to install for now
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';

    onMount(() => {
        goto('/docs/install');
    });
</script>

<div class="docs-page">
    <p>Redirecting to installation...</p>
</div>

<style>
    .docs-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--foreground-muted);
    }
</style>
