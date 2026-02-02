<script lang="ts">
  import type { components } from '$lib/api/schema.js';
  import {
    FeatureTree,
    type RowContext,
  } from '$lib/components/features/index.js';
  import { findFeature } from '$lib/components/features/featureTreeUtils.js';
  import { StateIcon } from '$lib/components/icons/index.js';
  import { InfoBanner, ResizeDivider } from '$lib/components/ui/index.js';
  import CreateVersionDialog from './CreateVersionDialog.svelte';
  import VersionMatrixHeader from './VersionMatrixHeader.svelte';
  import VersionMatrixSubheader from './VersionMatrixSubheader.svelte';
  import VersionMatrixRowCells from './VersionMatrixRowCells.svelte';
  import {
    getNextVersionName,
    groupVersions,
    getFlatIndex,
    getTotalVersionColumns,
    type VersionGroup,
  } from './versionUtils.js';

  type FeatureTreeNode = components['schemas']['FeatureTreeNode'];
  type Version = components['schemas']['Version'];

  interface Props {
    features: FeatureTreeNode[];
    versions: Version[];
    selectedId: string | null;
    projectId: string;
    featureColumnWidth?: number;
    onSelect: (id: string) => void;
    onCreateVersion: (name: string) => Promise<void>;
    onUpdateFeatureVersion?: (
      featureId: string,
      versionId: string | null,
    ) => Promise<void>;
    onCompleteVersion?: (versionId: string) => Promise<void>;
    onResize?: (deltaX: number) => void;
    onReparent?: (featureId: string, newParentId: string | null) => void;
    onAddFeature?: (parentId: string | null) => void;
    onArchiveFeature?: (
      id: string,
      title: string,
      isGroup: boolean,
      childCount: number,
      parentId: string | null,
    ) => void;
    onRestoreFeature?: (id: string) => Promise<void>;
    onDeleteFeature?: (id: string) => Promise<void>;
  }

  let {
    features,
    versions,
    selectedId,
    projectId,
    featureColumnWidth = 350,
    onSelect,
    onCreateVersion,
    onUpdateFeatureVersion,
    onCompleteVersion,
    onResize,
    onReparent,
    onAddFeature,
    onArchiveFeature,
    onRestoreFeature,
    onDeleteFeature,
  }: Props = $props();

  // Reference to FeatureTree for controlling state
  let featureTreeRef = $state<ReturnType<typeof FeatureTree> | null>(null);

  let showCreateDialog = $state(false);
  let isCompleting = $state(false);
  let closingVersionId = $state<string | null>(null);

  // Drag state for version drop zone indicator (versionId null = backlog)
  let dragHover = $state<{
    featureId: string;
    versionId: string | null;
  } | null>(null);

  // Track active filters from FeatureTree
  let activeFilters = $state<
    Set<import('$lib/stores/featureFilter.svelte.js').FilterableState>
  >(new Set());

  const suggestedVersionName = $derived(getNextVersionName(versions));
  let groupedVersions = $derived(groupVersions(versions));

  // Total number of flat version columns (for backlog index calculation)
  let totalVersionColumns = $derived(getTotalVersionColumns(groupedVersions));

  // Get the "Next" version (first unreleased)
  let nextVersion = $derived.by(() => {
    const unreleased = versions.filter((v) => !v.released_at);
    return unreleased.length > 0 ? unreleased[0] : null;
  });

  // Get features targeting the "Next" version
  let nextVersionFeatures = $derived.by(() => {
    if (!nextVersion) return [];
    const result: FeatureTreeNode[] = [];

    function collectTargetedFeatures(nodes: FeatureTreeNode[]) {
      for (const node of nodes) {
        const isLeaf = !node.children || node.children.length === 0;
        if (isLeaf && node.target_version_id === nextVersion!.id) {
          result.push(node);
        }
        if (node.children) {
          collectTargetedFeatures(node.children);
        }
      }
    }

    collectTargetedFeatures(features);
    return result;
  });

  // Check if the "Next" version is feature complete
  let isNowFeatureComplete = $derived.by(() => {
    if (!nextVersion || nextVersionFeatures.length === 0) return false;
    return nextVersionFeatures.every((f) => f.state === 'implemented');
  });

  // Handle completing the Next version
  async function handleCompleteNow() {
    if (!nextVersion || isCompleting || closingVersionId) return;

    const versionToClose = nextVersion.id;
    closingVersionId = versionToClose;

    setTimeout(async () => {
      if (onCompleteVersion) {
        isCompleting = true;
        try {
          await onCompleteVersion(versionToClose);
        } catch (error) {
          console.error('Failed to complete version:', error);
          closingVersionId = null;
        } finally {
          isCompleting = false;
        }
      } else {
        closingVersionId = null;
      }
    }, 400);
  }

  // Handle hover during drag for drop zone indicator
  function handleDotHover(featureId: string, versionId: string | null) {
    if (versionId) {
      dragHover = { featureId, versionId };
    } else {
      dragHover = null;
    }
  }

  // Handle dot drop to update feature's target version
  async function handleDotDrop(featureId: string, newVersionId: string | null) {
    dragHover = null;
    const feature = findFeature(features, featureId);
    if (!feature) return;

    // Convert "backlog" sentinel to null
    const resolvedVersionId = newVersionId === 'backlog' ? null : newVersionId;

    if (feature.target_version_id === resolvedVersionId) return;

    if (onUpdateFeatureVersion) {
      try {
        await onUpdateFeatureVersion(featureId, resolvedVersionId);
      } catch (error) {
        console.error('Failed to update feature version:', error);
      }
    }
  }

  function handleAddFeatureFromActions() {
    onAddFeature?.(null);
  }

  function handleToggleFilter(
    state: import('$lib/stores/featureFilter.svelte.js').FilterableState,
  ) {
    featureTreeRef?.toggleFilter(state);
    activeFilters = featureTreeRef?.getActiveFilters() ?? new Set();
  }

  function handleExpandAll() {
    featureTreeRef?.expandAll();
  }

  function handleCollapseAll() {
    featureTreeRef?.collapseAll();
  }
</script>

<div
  class="matrix-container"
  style="--feature-col-width: {featureColumnWidth}px"
>
  {#if onResize}
    <div class="resize-divider-container">
      <ResizeDivider {onResize} />
    </div>
  {/if}

  <VersionMatrixHeader
    {groupedVersions}
    {closingVersionId}
    onAddVersion={() => (showCreateDialog = true)}
  />

  <VersionMatrixSubheader
    {groupedVersions}
    {closingVersionId}
    {isNowFeatureComplete}
    {onCompleteVersion}
    {activeFilters}
    hasAddFeatureAction={!!onAddFeature}
    onAddFeature={handleAddFeatureFromActions}
    onToggleFilter={handleToggleFilter}
    onExpandAll={handleExpandAll}
    onCollapseAll={handleCollapseAll}
    {totalVersionColumns}
  />

  <!-- Feature complete banner -->
  {#if isNowFeatureComplete && onCompleteVersion && nextVersion}
    <InfoBanner
      spacerWidth="{featureColumnWidth}px"
      class="feature-complete-banner"
    >
      {#snippet icon()}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M6 2L6 10M6 2L2 6M6 2L10 6"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      {/snippet}
      <strong>{nextVersion.name}</strong> is feature complete. Close and advance
      planning?
      <button
        type="button"
        class="banner-btn"
        onclick={handleCompleteNow}
        disabled={isCompleting}
      >
        {isCompleting ? 'Closing...' : 'Close'}
      </button>
    </InfoBanner>
  {/if}

  <!-- Body - contains FeatureTree with version cells via rowExtras -->
  <div class="matrix-body">
    <!-- Full-height column backgrounds (sticky to fill viewport) -->
    <div class="column-backgrounds">
      <div class="col-bg feature-col"></div>
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

    <div class="matrix-body-inner">
      <FeatureTree
        bind:this={featureTreeRef}
        {features}
        {selectedId}
        {projectId}
        {featureColumnWidth}
        showHeader={false}
        scrollable={false}
        class="matrix-tree"
        {onSelect}
        {onReparent}
        {onAddFeature}
        {onArchiveFeature}
        {onRestoreFeature}
        {onDeleteFeature}
      >
        {#snippet rowExtras(ctx: RowContext)}
          <VersionMatrixRowCells
            feature={ctx.feature}
            {groupedVersions}
            hasChildren={ctx.hasChildren}
            {dragHover}
            {closingVersionId}
            onDotDrop={handleDotDrop}
            onDotHover={handleDotHover}
          />
        {/snippet}
      </FeatureTree>
    </div>
  </div>

  <div class="matrix-legend">
    <div class="legend-item">
      <StateIcon state="proposed" size={12} />
      <span>Proposed</span>
    </div>
    <div class="legend-item">
      <StateIcon state="in_progress" size={12} />
      <span>In Progress</span>
    </div>
    <div class="legend-item">
      <StateIcon state="implemented" size={12} />
      <span>Implemented</span>
    </div>
  </div>
</div>

<CreateVersionDialog
  open={showCreateDialog}
  onOpenChange={(open) => (showCreateDialog = open)}
  onCreate={onCreateVersion}
  suggestedName={suggestedVersionName}
/>

<style>
  .matrix-container {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    max-width: 100%;
    position: relative;
  }

  .resize-divider-container {
    position: absolute;
    top: 0;
    bottom: 0;
    left: var(--feature-col-width);
    z-index: 20;
    display: flex;
    align-items: stretch;
  }

  :global(.feature-complete-banner .banner-content) {
    max-width: 800px;
    background: var(--state-implemented);
    color: var(--background);
  }

  :global(.feature-complete-banner .banner-icon) {
    color: var(--background);
  }

  .banner-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 500;
    border-radius: 4px;
    border: 1px solid var(--background);
    background: transparent;
    color: var(--background);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .banner-btn:hover:not(:disabled) {
    background: var(--background);
    color: var(--state-implemented);
  }

  .banner-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .matrix-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding-bottom: 48px;
    position: relative;
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

  .matrix-body-inner {
    position: relative;
    z-index: 1;
  }

  .col-bg {
    flex-shrink: 0;
    height: 100%;
  }

  .col-bg.feature-col {
    width: var(--feature-col-width);
    min-width: 200px;
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
    border-left: 1px solid var(--border-default);
  }

  .col-bg.version-col.zebra {
    background: rgba(128, 128, 128, 0.04);
  }

  .col-bg.version-col:last-child {
    border-right: 1px solid var(--border-default);
  }

  /* Style FeatureTree within matrix */
  .matrix-body-inner :global(.matrix-tree) {
    grid-row: 1;
    grid-column: 1;
    z-index: 1;
  }

  .matrix-body :global(.tree-scroll-container) {
    position: static;
    overflow: visible;
  }

  .matrix-body :global(.tree-content) {
    position: static;
    overflow: visible;
  }

  .matrix-body :global(.tree-row) {
    position: relative;
    overflow: hidden;
    height: 28px;
    min-height: 28px;
    flex-shrink: 0;
  }

  .matrix-body :global(.tree-row:hover) {
    background: var(--background-muted);
  }

  .matrix-body :global(.tree-row.selected) {
    background: color-mix(in srgb, var(--background-emphasis) 33%, transparent);
  }

  .matrix-legend {
    display: flex;
    flex-shrink: 0;
    gap: 16px;
    padding: 8px 12px;
    border-top: 1px solid var(--border-default);
    background: var(--background-subtle);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 500;
    color: var(--foreground-muted);
  }
</style>
