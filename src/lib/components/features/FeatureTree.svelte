<script lang="ts">
  import type { components } from '$lib/api/schema.js';
  import type { Snippet } from 'svelte';
  import FeatureRow from './FeatureRow.svelte';
  import FeatureDragPreview from './FeatureDragPreview.svelte';
  import FeatureContextMenu from './FeatureContextMenu.svelte';
  import CreateGroupDialog from './CreateGroupDialog.svelte';
  import FeatureTreeActions from './FeatureTreeActions.svelte';
  import { featureExpansion, featureFilter } from '$lib/stores/index.js';
  import {
    findFeature,
    filterByStates,
    computeFeatureVersion,
    sortFeatures,
  } from './featureTreeUtils.js';
  import type { FilterableState } from '$lib/stores/featureFilter.svelte.js';
  import { useDragAndDrop } from '$lib/composables/useDragAndDrop.svelte.js';

  type FeatureTreeNode = components['schemas']['FeatureTreeNode'];
  type GroupMetadata = {
    hasFutureWork: boolean;
    hasProposed: boolean;
    hasBlocked: boolean;
    hasInProgress: boolean;
  };

  // Row context passed to rowExtras snippet
  export type RowContext = {
    feature: FeatureTreeNode;
    depth: number;
    isExpanded: boolean;
    hasChildren: boolean;
    isGroup: boolean;
    isLeaf: boolean;
    isRoot: boolean;
    groupMeta: GroupMetadata | null;
  };

  interface Props {
    features: FeatureTreeNode[];
    selectedId: string | null;
    projectId: string;
    featureColumnWidth?: number;
    showHeader?: boolean;
    showFilterButton?: boolean;
    scrollable?: boolean;
    class?: string;
    rowExtras?: Snippet<[RowContext]>;
    onSelect: (id: string) => void;
    onAddFeature?: (parentId: string | null) => void;
    onReparent?: (featureId: string, newParentId: string | null) => void;
    onCreateGroup?: (
      title: string,
      childIds: [string, string],
      parentId: string | null,
    ) => Promise<void>;
    onWrapInGroup?: (
      featureId: string,
      featureTitle: string,
      parentId: string | null,
    ) => void;
    onArchiveFeature?: (
      id: string,
      title: string,
      isGroup: boolean,
      childCount: number,
      parentId: string | null,
    ) => void;
    onRestoreFeature?: (id: string) => Promise<void>;
    onDeleteFeature?: (id: string) => Promise<void>;
    onImplementFeature?: (id: string, title: string) => void;
    onScroll?: (scrollTop: number) => void;
    hoveredFeatureId?: string | null;
    onHoverFeature?: (id: string | null) => void;
    showBannerSpacer?: boolean;
  }

  let {
    features,
    selectedId,
    projectId,
    featureColumnWidth = 350,
    showHeader = true,
    showFilterButton = true,
    scrollable = true,
    class: className = '',
    rowExtras,
    onSelect,
    onAddFeature,
    onReparent,
    onCreateGroup,
    onWrapInGroup,
    onArchiveFeature,
    onRestoreFeature,
    onDeleteFeature,
    onImplementFeature,
    onScroll,
    hoveredFeatureId = null,
    onHoverFeature,
    showBannerSpacer = false,
  }: Props = $props();

  // Layout constant (matches CSS)
  const ROW_HEIGHT = 28;

  // Drag and Drop (extracted)

  // Context menu state
  let contextMenuOpen = $state(false);
  let contextMenuX = $state(0);
  let contextMenuY = $state(0);
  let contextMenuFeatureId = $state<string | null>(null);

  // Measure container height with ResizeObserver
  $effect(() => {
    if (treeContentRef) {
      const observer = new ResizeObserver((entries) => {
        containerHeight = entries[0]?.contentRect.height ?? 0;
      });
      observer.observe(treeContentRef);
      return () => observer.disconnect();
    }
  });

  // Group creation dialog state
  let groupDialogOpen = $state(false);
  let pendingGroupData = $state<{
    childIds: [string, string];
    childTitles: [string, string];
    parentId: string | null;
  } | null>(null);

  // Expansion state
  let expandedIds = $state(new Set<string>());
  let treeContentRef = $state<HTMLElement | null>(null);
  let containerHeight = $state(0);
  let initialized = $state(false);
  let previousFeatureVersion = $state(0);
  let activeFilters = $state<Set<FilterableState>>(new Set());
  let lastExpandedToId = $state<string | null>(null);

  // Initialize filter state from store when projectId is available
  $effect(() => {
    if (projectId) {
      activeFilters = featureFilter.init(projectId);
    }
  });

  // Apply filter if any state filters are active
  const displayFeatures = $derived(
    activeFilters.size > 0 ? filterByStates(features, activeFilters) : features,
  );

  // Drag and Drop (extracted)
  const dnd = useDragAndDrop({
    features: () => displayFeatures,
    expandedIds: () => expandedIds,
    treeContentRef: () => treeContentRef,
    rowHeight: ROW_HEIGHT,
    onReparent: (featureId: string, newParentId: string | null) =>
      onReparent?.(featureId, newParentId),
    onCreateGroupRequest: (data) => {
      pendingGroupData = data;
      groupDialogOpen = true;
    },
    onExpandOnDrop: (id) => {
      if (!expandedIds.has(id)) {
        expandedIds = new Set([...expandedIds, id]);
      }
    },
  });
  $effect(() => {
    if (
      projectId &&
      features.length > 0 &&
      containerHeight > 0 &&
      !initialized
    ) {
      expandedIds = featureExpansion.init(projectId, features, containerHeight);
      previousFeatureVersion = computeFeatureVersion(features);
      initialized = true;
    }
  });

  // Reset initialized flag when project changes
  $effect(() => {
    projectId;
    initialized = false;
  });

  // Handle tree updates (e.g., from SSE) - detect newly-complete groups
  $effect(() => {
    if (!initialized) return;
    const currentVersion = computeFeatureVersion(features);
    if (currentVersion !== previousFeatureVersion) {
      expandedIds = featureExpansion.handleTreeUpdate(features, expandedIds);
      previousFeatureVersion = currentVersion;
    }
  });

  // Ensure selected feature is visible by expanding its ancestors (only when selection changes)
  $effect(() => {
    if (!initialized || !selectedId || features.length === 0) return;
    if (selectedId === lastExpandedToId) return;

    const newExpanded = featureExpansion.expandToFeature(
      features,
      selectedId,
      expandedIds,
    );
    if (newExpanded && newExpanded !== expandedIds) {
      expandedIds = newExpanded;
    }
    lastExpandedToId = selectedId;
  });

  function handleToggle(id: string) {
    expandedIds = featureExpansion.toggle(id, expandedIds);
  }

  export function expandAll() {
    expandedIds = featureExpansion.expandAll(features);
  }

  export function collapseAll() {
    expandedIds = featureExpansion.collapseAll();
  }

  export function expandForVersion(versionId: string | null) {
    expandedIds = featureExpansion.expandForVersion(features, versionId);
  }

  function handleAddFeature() {
    onAddFeature?.(selectedId);
  }

  // Handle group creation from dialog
  async function handleCreateGroup(title: string) {
    if (!pendingGroupData || !onCreateGroup) return;
    await onCreateGroup(
      title,
      pendingGroupData.childIds,
      pendingGroupData.parentId,
    );
    pendingGroupData = null;
  }

  // Context menu handlers
  const contextMenuFeature = $derived(
    contextMenuFeatureId ? findFeature(features, contextMenuFeatureId) : null,
  );
  const contextMenuFeatureTitle = $derived(contextMenuFeature?.title ?? null);
  const contextMenuFeatureIsRoot = $derived(
    contextMenuFeature?.is_root ?? false,
  );
  const contextMenuFeatureIsGroup = $derived(
    contextMenuFeature ? contextMenuFeature.children.length > 0 : false,
  );
  const contextMenuFeatureState = $derived(contextMenuFeature?.state ?? null);

  function handleRowContextMenu(id: string, x: number, y: number) {
    contextMenuFeatureId = id;
    contextMenuX = x;
    contextMenuY = y;
    contextMenuOpen = true;
  }

  function handleContextMenuClose() {
    contextMenuOpen = false;
  }

  function handleContextMenuAddChild() {
    onAddFeature?.(contextMenuFeatureId);
  }

  function handleContextMenuWrapInGroup() {
    if (!contextMenuFeature || !onWrapInGroup) return;
    if (contextMenuFeature.is_root) return;

    onWrapInGroup(
      contextMenuFeature.id,
      contextMenuFeature.title,
      contextMenuFeature.parent_id ?? null,
    );
  }

  function handleContextMenuArchive() {
    if (!contextMenuFeature || !onArchiveFeature) return;
    if (contextMenuFeature.is_root) return;

    onArchiveFeature(
      contextMenuFeature.id,
      contextMenuFeature.title,
      contextMenuFeature.children.length > 0,
      contextMenuFeature.children.length,
      contextMenuFeature.parent_id ?? null,
    );
  }

  function handleContextMenuRestore() {
    if (!contextMenuFeature || !onRestoreFeature) return;
    onRestoreFeature(contextMenuFeature.id);
  }

  function handleContextMenuDelete() {
    if (!contextMenuFeature || !onDeleteFeature) return;
    onDeleteFeature(contextMenuFeature.id);
  }

  function handleContextMenuImplement() {
    if (!contextMenuFeature || !onImplementFeature) return;
    onImplementFeature(contextMenuFeature.id, contextMenuFeature.title);
  }

  function handleTreeContextMenu(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      e.preventDefault();
      contextMenuFeatureId = null;
      contextMenuX = e.clientX;
      contextMenuY = e.clientY;
      contextMenuOpen = true;
    }
  }

  // Export state and functions for parent components to use
  export function getExpandedIds(): Set<string> {
    return expandedIds;
  }

  export function setExpandedIds(ids: Set<string>): void {
    expandedIds = ids;
  }

  export function isFilterActive(state: FilterableState): boolean {
    return activeFilters.has(state);
  }

  export function getActiveFilters(): Set<FilterableState> {
    return new Set(activeFilters);
  }

  // Export methods for external control
  export { activeFilters };

  export function toggleFilter(state: FilterableState): void {
    activeFilters = featureFilter.toggle(state);
  }

  export function scrollTo(top: number): void {
    if (treeContentRef) {
      treeContentRef.scrollTop = top;
    }
  }

  function handleScroll() {
    if (treeContentRef && onScroll) {
      onScroll(treeContentRef.scrollTop);
    }
  }

  function handleMouseOver(e: MouseEvent) {
    if (!onHoverFeature) return;
    const target = (e.target as HTMLElement).closest('[data-feature-id]');
    if (target) {
      const id = (target as HTMLElement).dataset.featureId!;
      onHoverFeature(id);
    }
  }

  function handleMouseLeave() {
    onHoverFeature?.(null);
  }
</script>

<div
  class="feature-tree {className}"
  style="--feature-col-width: {featureColumnWidth}px"
>
  {#if showHeader}
    <div class="tree-header">
      <span class="tree-title">Feature Tree</span>
    </div>
    <div class="tree-subheader">
      <FeatureTreeActions
        {activeFilters}
        showAddButton={!!onAddFeature}
        {showFilterButton}
        onAddFeature={handleAddFeature}
        onToggleFilter={(state) =>
          (activeFilters = featureFilter.toggle(state))}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
      />
    </div>
  {/if}

  {#if showBannerSpacer}
    <div class="banner-spacer"></div>
  {/if}

  <div class="tree-scroll-container">
    <div
      class="tree-content"
      class:scrollable
      role="tree"
      tabindex="-1"
      aria-label="Feature tree"
      bind:this={treeContentRef}
      onscroll={handleScroll}
      onmouseover={handleMouseOver}
      onmouseleave={handleMouseLeave}
      oncontextmenu={handleTreeContextMenu}
      onpointermove={dnd.handlePointerMove}
      onpointerup={dnd.handlePointerUp}
      onpointercancel={dnd.handlePointerCancel}
    >
      {#if features.length === 0}
        <div class="empty-state">No features yet</div>
      {:else}
        {#each sortFeatures(displayFeatures) as node (node.id)}
          {@render renderNode(node, 0)}
        {/each}
      {/if}
    </div>
  </div>
</div>

{#snippet renderNode(feature: FeatureTreeNode, depth: number)}
  {@const hasChildren = feature.children.length > 0}
  {@const isRoot = feature.is_root ?? false}
  {@const isLeaf = !hasChildren && !isRoot}
  {@const isGroup = hasChildren || isRoot}
  {@const groupMeta = isGroup
    ? featureExpansion.getGroupMetadata(feature)
    : null}
  {@const isDragging = dnd.dragState?.featureId === feature.id}
  {@const isDropHovered =
    dnd.dropTarget?.id === feature.id && !dnd.dropTarget?.isLeafTarget}
  {@const isLeafDropTarget =
    dnd.dropTarget?.id === feature.id && dnd.dropTarget?.isLeafTarget}
  {@const isExpanded = isRoot || expandedIds.has(feature.id)}
  {@const rowContext: RowContext = { feature, depth, isExpanded, hasChildren, isGroup, isLeaf, isRoot, groupMeta }}

  {@const isSelectedRow = selectedId === feature.id}
  <div
    class="tree-row"
    class:is-group={isGroup}
    class:is-leaf={isLeaf}
    class:selected={isSelectedRow}
    class:drop-hover={isDropHovered}
    class:leaf-drop-hover={isLeafDropTarget}
    class:is-dragging={isDragging}
    data-feature-id={feature.id}
  >
    <FeatureRow
      {feature}
      {depth}
      isSelected={selectedId === feature.id}
      isHovered={hoveredFeatureId === feature.id}
      {isExpanded}
      showTrack={!hasChildren && !isRoot}
      hasProposed={groupMeta?.hasProposed ?? false}
      hasBlocked={groupMeta?.hasBlocked ?? false}
      hasInProgress={groupMeta?.hasInProgress ?? false}
      isDraggable={!!(onReparent || onCreateGroup) && !isRoot}
      {isDragging}
      isLongPressActive={dnd.longPressFeatureId === feature.id}
      {onSelect}
      onToggle={handleToggle}
      onContextMenu={handleRowContextMenu}
      onRowPointerDown={dnd.handleRowPointerDown}
      shouldSuppressClick={dnd.shouldSuppressClick}
    />
    {#if rowExtras}
      {@render rowExtras(rowContext)}
    {/if}
  </div>

  {#if isGroup && isExpanded}
    {#each sortFeatures(feature.children) as child (child.id)}
      {@render renderNode(child, depth + 1)}
    {/each}
  {/if}
{/snippet}

{#if dnd.dragState}
  <FeatureDragPreview
    feature={dnd.dragState.feature}
    x={dnd.dragPosition.x}
    y={dnd.dragPosition.y}
  />
{/if}

<FeatureContextMenu
  open={contextMenuOpen}
  x={contextMenuX}
  y={contextMenuY}
  featureTitle={contextMenuFeatureTitle}
  featureState={contextMenuFeatureState}
  isRoot={contextMenuFeatureIsRoot}
  isGroup={contextMenuFeatureIsGroup}
  isArchived={contextMenuFeature?.state === 'archived'}
  onClose={handleContextMenuClose}
  onAddChild={handleContextMenuAddChild}
  onWrapInGroup={onWrapInGroup ? handleContextMenuWrapInGroup : undefined}
  onArchive={onArchiveFeature ? handleContextMenuArchive : undefined}
  onRestore={onRestoreFeature ? handleContextMenuRestore : undefined}
  onDelete={onDeleteFeature ? handleContextMenuDelete : undefined}
  onImplement={onImplementFeature ? handleContextMenuImplement : undefined}
/>

{#if pendingGroupData}
  <CreateGroupDialog
    open={groupDialogOpen}
    onOpenChange={(open) => {
      groupDialogOpen = open;
      if (!open) pendingGroupData = null;
    }}
    onCreate={handleCreateGroup}
    featureTitles={pendingGroupData.childTitles}
  />
{/if}

<style>
  .feature-tree {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .tree-header {
    display: flex;
    align-items: center;
    height: 36px;
    padding: 0 14px;
    background: var(--background-subtle);
    border-bottom: 1px solid var(--border-default);
    flex-shrink: 0;
  }

  .tree-title {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--foreground-muted);
  }

  .tree-subheader {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    height: 27px;
    padding: 0 12px;
    background: var(--background);
    border-bottom: 1px solid var(--border-default);
  }

  /* Matches feature-complete-bar height in VersionMatrixView */
  .banner-spacer {
    height: 37px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--border-default);
  }

  .tree-scroll-container {
    flex: 1;
    position: relative;
    min-height: 0;
    overflow: hidden;
  }

  .tree-content {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
  }

  .tree-content.scrollable {
    overflow-y: auto;
    overflow-x: hidden;
    padding-bottom: 48px;
  }

  .tree-row {
    display: flex;
    height: 28px;
    min-height: 28px;
    flex-shrink: 0;
    transition: background-color 0.1s ease;
  }

  .tree-row.is-dragging {
    opacity: 0.5;
  }

  .tree-row.is-group.drop-hover {
    background: rgba(107, 142, 95, 0.25);
  }

  .tree-row.is-leaf.leaf-drop-hover {
    background: rgba(59, 130, 246, 0.2);
  }

  .empty-state {
    padding: 24px 16px;
    text-align: center;
    color: var(--foreground-subtle);
    font-size: 13px;
  }
</style>
