<script lang="ts">
  import { getAuthApiContext } from '$lib/api/auth-context.js';
  import type { components } from '$lib/api/schema.js';
  import { rightSidebarWidth } from '$lib/stores/index.js';
  import type { VersionSummary } from '@manifest/svelte/commands';
  import AiChat from '../features/AiChat.svelte';

  const authApi = getAuthApiContext();

  type Feature = components['schemas']['Feature'];
  type FeatureTreeNode = components['schemas']['FeatureTreeNode'];
  type Version = components['schemas']['Version'];

  interface Props {
    featureTree: FeatureTreeNode[];
    versions: Version[];
    projectId: string;
    selectedFeatureId: string | null;
    acFormat?: 'checkbox' | 'gherkin';
  }

  let { featureTree, versions, projectId, selectedFeatureId, acFormat }: Props = $props();

  let selectedFeature = $state<Feature | null>(null);
  let activeTab = $state<'ai' | 'overview'>('ai');

  // Resize state
  let isResizing = $state(false);

  function handleResizeStart(e: PointerEvent) {
    e.preventDefault();
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const startX = e.clientX;
    const startWidth = rightSidebarWidth.value;

    function handleMove(e: PointerEvent) {
      const delta = startX - e.clientX;
      const newWidth = Math.max(
        rightSidebarWidth.MIN_WIDTH,
        Math.min(rightSidebarWidth.MAX_WIDTH, startWidth + delta),
      );
      rightSidebarWidth.set(newWidth);
    }

    function handleUp() {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    }

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  }

  // Load selected feature details
  $effect(() => {
    if (selectedFeatureId && authApi.isReady()) {
      loadFeature(selectedFeatureId);
    } else {
      selectedFeature = null;
    }
  });

  async function loadFeature(featureId: string) {
    const api = await authApi.getClient();
    const { data, error } = await api.GET('/features/{id}', {
      params: { path: { id: featureId } },
    });
    if (error || !data) {
      selectedFeature = null;
      return;
    }
    selectedFeature = data;
  }

  // Derive version summaries from feature tree + versions
  function collectLeaves(nodes: FeatureTreeNode[]): FeatureTreeNode[] {
    const leaves: FeatureTreeNode[] = [];
    for (const node of nodes) {
      if (node.children.length === 0) {
        leaves.push(node);
      } else {
        leaves.push(...collectLeaves(node.children));
      }
    }
    return leaves;
  }

  const versionSummaries = $derived.by((): VersionSummary[] => {
    const leaves = collectLeaves(featureTree);
    const unreleased = versions.filter((v) => !v.released_at);

    return unreleased.map((v) => {
      const assigned = leaves.filter((f) => f.target_version_id === v.id);
      const implemented = assigned.filter((f) => f.state === 'implemented');
      return {
        id: v.id,
        name: v.name,
        featureCount: assigned.length,
        implementedCount: implemented.length,
      };
    });
  });

  const nextVersion = $derived(
    versions.find((v) => !v.released_at),
  );

  const nextVersionName = $derived(nextVersion?.name);

  const unassignedFeatureCount = $derived.by(() => {
    const leaves = collectLeaves(featureTree);
    return leaves.filter(
      (f) => !f.target_version_id && !f.is_root,
    ).length;
  });

  // Find feature node in tree for isLeaf check
  function findInTree(
    nodes: FeatureTreeNode[],
    id: string,
  ): FeatureTreeNode | null {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = findInTree(node.children, id);
      if (found) return found;
    }
    return null;
  }

  const selectedNode = $derived(
    selectedFeatureId ? findInTree(featureTree, selectedFeatureId) : null,
  );
  const isSelectedLeaf = $derived(
    selectedNode ? selectedNode.children.length === 0 : true,
  );
</script>

<div
  class="plan-sidebar"
  style="width: {rightSidebarWidth.value}px"
>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="resize-handle"
    class:resizing={isResizing}
    onpointerdown={handleResizeStart}
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize sidebar"
    tabindex="0"
  ></div>

  <div class="sidebar-tabs">
    <button
      class="tab-button"
      class:active={activeTab === 'ai'}
      onclick={() => (activeTab = 'ai')}
      type="button"
    >
      AI Assistance
    </button>
    <button
      class="tab-button"
      class:active={activeTab === 'overview'}
      onclick={() => (activeTab = 'overview')}
      type="button"
    >
      Overview
    </button>
  </div>

  <div class="sidebar-section ai-section" class:hidden={activeTab !== 'ai'}>
    <AiChat
      featureId={selectedFeature?.id ?? null}
      featureTitle={selectedFeature?.title ?? ''}
      featureDetails={selectedFeature?.details ?? ''}
      featureState={selectedFeature?.state}
      {projectId}
      isLeaf={isSelectedLeaf}
      versions={versionSummaries}
      {nextVersionName}
      {unassignedFeatureCount}
      isVersionView={true}
      {acFormat}
    />
  </div>

  <div
    class="sidebar-section overview-section"
    class:hidden={activeTab !== 'overview'}
  >
    <div class="overview-content">
      {#if versionSummaries.length === 0}
        <p class="empty-overview">No unreleased versions</p>
      {:else}
        {#each versionSummaries as vs (vs.id)}
          {@const pct =
            vs.featureCount > 0
              ? Math.round((vs.implementedCount / vs.featureCount) * 100)
              : 0}
          <div class="version-card" class:next={vs.name === nextVersionName}>
            <div class="version-header">
              <span class="version-name">{vs.name}</span>
              {#if vs.name === nextVersionName}
                <span class="version-badge">next</span>
              {/if}
            </div>
            <div class="version-stats">
              <span class="stat-count"
                >{vs.implementedCount}/{vs.featureCount} features</span
              >
              <div class="progress-bar">
                <div class="progress-fill" style="width: {pct}%"></div>
              </div>
              <span class="stat-pct">{pct}%</span>
            </div>
          </div>
        {/each}

        {#if unassignedFeatureCount > 0}
          <div class="backlog-card">
            <span class="backlog-label">Backlog</span>
            <span class="backlog-count"
              >{unassignedFeatureCount} unassigned</span
            >
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .plan-sidebar {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 250px;
    max-width: 600px;
    border-left: 1px solid var(--border-default);
    background: var(--background);
  }

  .resize-handle {
    position: absolute;
    left: -3px;
    top: 0;
    bottom: 0;
    width: 6px;
    cursor: col-resize;
    z-index: 10;
  }

  .resize-handle:hover,
  .resize-handle.resizing {
    background: var(--accent-blue);
    opacity: 0.5;
  }

  .resize-handle:focus-visible {
    outline: 2px solid var(--accent-blue);
    outline-offset: -2px;
  }

  .sidebar-tabs {
    display: flex;
    height: 36px;
    border-bottom: 1px solid var(--border-default);
  }

  .tab-button {
    flex: 1;
    height: 100%;
    padding: 0 16px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--foreground-muted);
    background: var(--background-subtle);
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .tab-button:hover {
    color: var(--foreground);
  }

  .tab-button.active {
    color: var(--foreground);
    background: var(--background);
    border-bottom-color: var(--accent-blue);
  }

  .sidebar-section {
    padding: 16px;
    border-bottom: 1px solid var(--border-default);
  }

  .overview-section,
  .ai-section {
    display: flex;
    flex-direction: column;
    border-bottom: none;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .overview-section.hidden,
  .ai-section.hidden {
    display: none;
  }

  .overview-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
  }

  .empty-overview {
    color: var(--foreground-subtle);
    font-size: 13px;
    font-style: italic;
  }

  .version-card {
    padding: 10px 12px;
    background: var(--background-subtle);
    border: 1px solid var(--border-default);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .version-card.next {
    border-color: var(--accent-blue);
  }

  .version-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .version-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--foreground);
  }

  .version-badge {
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 1px 6px;
    background: var(--accent-blue);
    color: var(--background);
    border-radius: 3px;
  }

  .version-stats {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--foreground-muted);
  }

  .stat-count {
    white-space: nowrap;
  }

  .progress-bar {
    flex: 1;
    height: 4px;
    background: var(--background-muted);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--state-implemented);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .stat-pct {
    font-size: 11px;
    font-weight: 500;
    color: var(--foreground-subtle);
    min-width: 28px;
    text-align: right;
  }

  .backlog-card {
    padding: 8px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid var(--border-default);
    margin-top: 4px;
    padding-top: 12px;
  }

  .backlog-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--foreground-muted);
  }

  .backlog-count {
    font-size: 12px;
    color: var(--foreground-subtle);
  }
</style>
