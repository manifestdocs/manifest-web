<script lang="ts">
    import type { components } from "$lib/api/schema.js";
    import { MarkdownView } from "$lib/components/markdown/index.js";
    import { InfoBanner } from "$lib/components/ui/index.js";

    type Feature = components["schemas"]["Feature"];

    interface Props {
        feature: Feature & { is_root?: boolean };
        isRoot: boolean;
        isGroup: boolean;
        hasPendingChanges: boolean;
        showHighlight: boolean;
        onViewDiff: () => void;
    }

    let {
        feature,
        isRoot,
        isGroup,
        hasPendingChanges,
        showHighlight,
        onViewDiff,
    }: Props = $props();
</script>

{#if isRoot}
    <InfoBanner class="content-banner">
        Context here applies project-wide.
    </InfoBanner>
{:else if isGroup}
    <InfoBanner class="content-banner">
        Context here applies to all features in this set.
    </InfoBanner>
{/if}

{#if hasPendingChanges}
    <InfoBanner variant="warning" class="content-banner">
        This feature has proposed changes. <button
            class="banner-link"
            onclick={onViewDiff}
            type="button">Review changes</button
        > to apply or discard them.
    </InfoBanner>
{/if}

<div class="details-view" class:highlight={showHighlight}>
    {#if feature.details}
        <MarkdownView content={feature.details} />
    {:else}
        <p class="no-details">
            {isRoot
                ? "No project instructions yet. Click Edit to add guidelines for AI agents."
                : "No details yet. Click Edit to add a description."}
        </p>
    {/if}
</div>

<style>
    :global(.content-banner) {
        margin-bottom: 24px;
    }

    .banner-link {
        background: none;
        border: none;
        padding: 0;
        font: inherit;
        text-decoration: underline;
        cursor: pointer;
        color: inherit;
    }

    .details-view {
        font-size: 15px;
        line-height: 1.6;
        color: var(--foreground);
        transition: background-color 0.3s ease;
        border-radius: 8px;
        padding: 4px;
        margin: -4px;
    }

    .details-view.highlight {
        background-color: rgba(210, 153, 34, 0.1);
    }

    .no-details {
        color: var(--foreground-subtle);
        font-style: italic;
        text-align: center;
        padding: 40px 0;
    }
</style>
