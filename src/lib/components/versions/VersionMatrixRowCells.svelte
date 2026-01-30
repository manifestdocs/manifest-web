<script lang="ts">
    import type { components } from "$lib/api/schema.js";
    import { StateIcon } from "$lib/components/icons/index.js";
    import DraggableDot from "./DraggableDot.svelte";
    import {
        getVersionFlatIndex,
        getFlatIndex,
        type VersionGroup,
    } from "./versionUtils.js";

    type FeatureTreeNode = components["schemas"]["FeatureTreeNode"];

    interface Props {
        feature: FeatureTreeNode;
        groupedVersions: VersionGroup[];
        hasChildren: boolean;
        dragHover: { featureId: string; versionId: string | null } | null;
        closingVersionId: string | null;
        onDotDrop: (featureId: string, versionId: string | null) => void;
        onDotHover: (featureId: string, versionId: string | null) => void;
    }

    let {
        feature,
        groupedVersions,
        hasChildren,
        dragHover,
        closingVersionId,
        onDotDrop,
        onDotHover,
    }: Props = $props();

    const isBacklog = $derived(!feature.target_version_id);
    const isBacklogDropZone = $derived(
        dragHover?.featureId === feature.id &&
            dragHover?.versionId === "backlog" &&
            !isBacklog,
    );
</script>

{#each groupedVersions as group, groupIndex}
    {#each group.versions as version, versionIndex}
        {@const isTarget = feature.target_version_id === version.id}
        {@const targetIdx = getVersionFlatIndex(
            feature.target_version_id,
            groupedVersions,
        )}
        {@const currentIdx = getFlatIndex(
            groupIndex,
            versionIndex,
            groupedVersions,
        )}
        {@const showTrack =
            !hasChildren && targetIdx >= 0 && currentIdx < targetIdx}
        {@const isVersionDropZone =
            dragHover?.featureId === feature.id &&
            dragHover?.versionId === version.id &&
            !isTarget}
        <div
            class="version-cell"
            class:show-track={showTrack}
            class:has-dot={isTarget && !hasChildren}
            class:drop-zone={isVersionDropZone}
            class:closing={version.id === closingVersionId}
            data-version-id={version.id}
        >
            {#if isTarget && !hasChildren}
                <DraggableDot
                    featureId={feature.id}
                    featureState={feature.state}
                    onDrop={onDotDrop}
                    onHover={onDotHover}
                />
            {/if}
            {#if isVersionDropZone}
                <span class="drop-indicator">
                    <StateIcon state={feature.state} size={14} />
                </span>
            {/if}
        </div>
    {/each}
{/each}

<!-- Backlog column -->
<div
    class="version-cell backlog-cell"
    class:has-dot={isBacklog && !hasChildren}
    class:drop-zone={isBacklogDropZone}
    data-version-id="backlog"
>
    {#if isBacklog && !hasChildren}
        <DraggableDot
            featureId={feature.id}
            featureState={feature.state}
            onDrop={onDotDrop}
            onHover={onDotHover}
        />
    {/if}
    {#if isBacklogDropZone}
        <span class="drop-indicator">
            <StateIcon state={feature.state} size={14} />
        </span>
    {/if}
</div>

<style>
    .version-cell {
        flex: 0 0 80px;
        min-height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: hidden;
        transition:
            flex-basis 0.4s cubic-bezier(0.4, 0, 0.2, 1),
            opacity 0.3s ease;
    }

    .version-cell.closing {
        flex-basis: 0;
        opacity: 0;
    }

    .version-cell.show-track::before,
    .version-cell.has-dot::before {
        content: "";
        position: absolute;
        top: 50%;
        left: 0;
        border-top: 1px dashed var(--border-default);
    }

    .version-cell.show-track::before {
        right: 0;
    }

    .version-cell.has-dot::before {
        right: 50%;
    }

    .drop-indicator {
        opacity: 0.5;
    }

    .version-cell.drop-zone {
        background: rgba(59, 130, 246, 0.08);
    }
</style>
