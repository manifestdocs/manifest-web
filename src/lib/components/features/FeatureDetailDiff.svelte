<script lang="ts">
    import type { components } from "$lib/api/schema.js";
    import { DiffView } from "$lib/components/markdown/index.js";

    type FeatureDiff = components["schemas"]["FeatureDiff"];

    interface Props {
        diffData: FeatureDiff | null;
        isLoadingDiff: boolean;
    }

    let { diffData, isLoadingDiff }: Props = $props();
</script>

<div class="details-diff">
    {#if isLoadingDiff}
        <p class="loading-text">Loading diff...</p>
    {:else if diffData}
        <DiffView
            current={diffData.current ?? null}
            desired={diffData.desired ?? null}
        />
    {:else}
        <p class="no-details">No diff data available.</p>
    {/if}
</div>

<style>
    .details-diff {
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    .loading-text {
        color: var(--foreground-subtle);
        text-align: center;
        padding: 40px 0;
    }

    .no-details {
        color: var(--foreground-subtle);
        font-style: italic;
        text-align: center;
        padding: 40px 0;
    }
</style>
