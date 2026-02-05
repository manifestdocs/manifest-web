<script lang="ts">
  import type { components } from '$lib/api/schema.js';
  import VersionMatrixRowCells from './VersionMatrixRowCells.svelte';
  import {
    getFlatIndex,
    getTotalVersionColumns,
    type VersionGroup,
  } from './versionUtils.js';
  import {
    filterByStates,
    sortFeatures,
  } from '$lib/components/features/featureTreeUtils.js';
  import type { FilterableState } from '$lib/stores/featureFilter.svelte.js';

  type FeatureTreeNode = components['schemas']['FeatureTreeNode'];
  type Version = components['schemas']['Version'];

  interface Props {
    features: FeatureTreeNode[];
    versions: Version[];
    groupedVersions: VersionGroup[];
    expandedIds: Set<string>;
    activeFilters: Set<FilterableState>;
    treeScrollTop: number;
    selectedId: string | null;
    hoveredFeatureId: string | null;
    dragHover: { featureId: string; versionId: string | null } | null;
    closingVersionId: string | null;
    onScroll: (scrollTop: number) => void;
    onDotDrop: (featureId: string, versionId: string | null) => void;
    onDotHover: (featureId: string, versionId: string | null) => void;
    onHoverFeature: (id: string | null) => void;
    totalVersionColumns: number;
  }

  let {
    features,
    versions,
    groupedVersions,
    expandedIds,
    activeFilters,
    treeScrollTop,
    selectedId,
    hoveredFeatureId,
    dragHover,
    closingVersionId,
    onScroll,
    onDotDrop,
    onDotHover,
    onHoverFeature,
    totalVersionColumns,
  }: Props = $props();

  let scrollRef = $state<HTMLElement | null>(null);
  let syncing = false;

  // Apply filter if any state filters are active
  const displayFeatures = $derived(
    activeFilters.size > 0 ? filterByStates(features, activeFilters) : features,
  );

  // Sync scroll from tree → columns
  $effect(() => {
    const top = treeScrollTop;
    if (scrollRef && !syncing) {
      syncing = true;
      scrollRef.scrollTop = top;
      // Use rAF to clear syncing after the scroll event fires
      requestAnimationFrame(() => {
        syncing = false;
      });
    }
  });

  function handleScroll() {
    if (scrollRef && !syncing) {
      syncing = true;
      onScroll(scrollRef.scrollTop);
      requestAnimationFrame(() => {
        syncing = false;
      });
    }
  }

  function handleMouseOver(e: MouseEvent) {
    const target = (e.target as HTMLElement).closest('[data-feature-id]');
    if (target) {
      onHoverFeature((target as HTMLElement).dataset.featureId!);
    }
  }

  function handleMouseLeave() {
    onHoverFeature(null);
  }
</script>

{#snippet renderNode(feature: FeatureTreeNode, depth: number)}
  {@const hasChildren = feature.children.length > 0}
  {@const isRoot = feature.is_root ?? false}
  {@const isGroup = hasChildren || isRoot}
  {@const isExpanded = isRoot || expandedIds.has(feature.id)}

  <div
    class="version-row"
    class:selected={selectedId === feature.id}
    class:hovered={hoveredFeatureId === feature.id}
    data-feature-id={feature.id}
  >
    <VersionMatrixRowCells
      {feature}
      {groupedVersions}
      {hasChildren}
      {dragHover}
      {closingVersionId}
      {onDotDrop}
      {onDotHover}
    />
  </div>

  {#if isGroup && isExpanded}
    {#each sortFeatures(feature.children) as child (child.id)}
      {@render renderNode(child, depth + 1)}
    {/each}
  {/if}
{/snippet}

<div class="version-columns-wrapper">
  <!-- Full-height column backgrounds -->
  <div class="column-backgrounds">
    {#each groupedVersions as group, groupIndex}
      {#each group.versions as version, versionIndex}
        {@const colIndex = getFlatIndex(
          groupIndex,
          versionIndex,
          groupedVersions,
        )}
        <div
          class="col-bg version-col"
          class:group-start={versionIndex === 0}
          class:zebra={colIndex % 2 === 0}
          class:closing={version.id === closingVersionId}
        ></div>
      {/each}
    {/each}
    <div
      class="col-bg version-col group-start"
      class:zebra={totalVersionColumns % 2 === 0}
    ></div>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="version-columns-scroll"
    bind:this={scrollRef}
    onscroll={handleScroll}
    onmouseover={handleMouseOver}
    onmouseleave={handleMouseLeave}
  >
    <div class="version-columns-inner">
      {#if features.length === 0}
        <div class="empty-spacer"></div>
      {:else}
        {#each sortFeatures(displayFeatures) as node (node.id)}
          {@render renderNode(node, 0)}
        {/each}
      {/if}
    </div>
  </div>
</div>

<style>
  .version-columns-wrapper {
    flex: 1;
    min-height: 0;
    position: relative;
    overflow: hidden;
  }

  .column-backgrounds {
    position: sticky;
    top: 0;
    height: 100vh;
    margin-bottom: -100vh;
    display: flex;
    pointer-events: none;
    overflow: hidden;
    z-index: 0;
  }

  .col-bg {
    flex-shrink: 0;
    height: 100%;
  }

  .col-bg.version-col {
    width: 80px;
    border-left: 1px solid
      color-mix(in srgb, var(--border-subtle) 40%, transparent);
    transition:
      width 0.4s cubic-bezier(0.4, 0, 0.2, 1),
      opacity 0.3s ease;
  }

  .col-bg.version-col.closing {
    width: 0;
    opacity: 0;
  }

  .col-bg.version-col.group-start {
    border-left: 1px solid var(--border-subtle);
  }

  .col-bg.version-col.zebra {
    background: rgba(128, 128, 128, 0.04);
  }

  .col-bg.version-col:last-child {
    border-right: 1px solid var(--border-subtle);
  }

  .version-columns-scroll {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding-bottom: 48px;
    z-index: 1;
  }

  .version-columns-inner {
    position: relative;
  }

  .version-row {
    display: flex;
    height: 28px;
    min-height: 28px;
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
  }

  .version-row:hover,
  .version-row.hovered {
    background: var(--row-hover-bg, var(--background-muted));
  }

  .version-row.selected {
    background: color-mix(in srgb, var(--background-emphasis) 33%, transparent);
  }

  .empty-spacer {
    height: 48px;
  }
</style>
