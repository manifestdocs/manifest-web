<script lang="ts">
  import type { components } from '$lib/api/schema.js';
  import { findFeature } from '$lib/components/features/featureTreeUtils.js';
  import { InfoBanner } from '$lib/components/ui/index.js';
  import CreateVersionDialog from './CreateVersionDialog.svelte';
  import VersionMatrixHeader from './VersionMatrixHeader.svelte';
  import VersionMatrixSubheader from './VersionMatrixSubheader.svelte';
  import VersionColumns from './VersionColumns.svelte';
  import {
    getNextVersionName,
    groupVersions,
    getTotalVersionColumns,
  } from './versionUtils.js';
  import type { FilterableState } from '$lib/stores/featureFilter.svelte.js';

  type FeatureTreeNode = components['schemas']['FeatureTreeNode'];
  type Version = components['schemas']['Version'];

  interface Props {
    features: FeatureTreeNode[];
    versions: Version[];
    projectId: string;
    selectedId: string | null;
    hoveredFeatureId: string | null;
    expandedIds: Set<string>;
    activeFilters: Set<FilterableState>;
    treeScrollTop: number;
    showHeader?: boolean;
    onCreateVersion: (name: string) => Promise<void>;
    onUpdateFeatureVersion?: (
      featureId: string,
      versionId: string | null,
    ) => Promise<void>;
    onCompleteVersion?: (versionId: string) => Promise<void>;
    onScrollSync: (scrollTop: number) => void;
    onHoverFeature: (id: string | null) => void;
  }

  let {
    features,
    versions,
    projectId,
    selectedId,
    hoveredFeatureId,
    expandedIds,
    activeFilters,
    treeScrollTop,
    showHeader = true,
    onCreateVersion,
    onUpdateFeatureVersion,
    onCompleteVersion,
    onScrollSync,
    onHoverFeature,
  }: Props = $props();

  let showCreateDialog = $state(false);
  let isCompleting = $state(false);
  let closingVersionId = $state<string | null>(null);

  // Drag state for version drop zone indicator (versionId null = backlog)
  let dragHover = $state<{
    featureId: string;
    versionId: string | null;
  } | null>(null);

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
</script>

<div class="matrix-container">
  {#if showHeader}
    <VersionMatrixHeader
      {groupedVersions}
      {closingVersionId}
      onAddVersion={() => (showCreateDialog = true)}
    />
  {/if}

  <VersionMatrixSubheader
    {groupedVersions}
    {closingVersionId}
    {isNowFeatureComplete}
    {onCompleteVersion}
    {totalVersionColumns}
  />

  <!-- Feature complete banner -->
  {#if isNowFeatureComplete && onCompleteVersion && nextVersion}
    <InfoBanner class="feature-complete-banner">
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

  <!-- Body - VersionColumns synced with left panel tree -->
  <VersionColumns
    {features}
    {versions}
    {groupedVersions}
    {expandedIds}
    {activeFilters}
    {treeScrollTop}
    {selectedId}
    {hoveredFeatureId}
    {dragHover}
    {closingVersionId}
    onScroll={onScrollSync}
    onDotDrop={handleDotDrop}
    onDotHover={handleDotHover}
    {onHoverFeature}
    {totalVersionColumns}
  />
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
</style>
