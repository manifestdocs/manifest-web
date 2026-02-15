<script lang="ts">
  import { subscribeToProject } from '$lib/api/client.js';
  import { getAuthApiContext } from '$lib/api/auth-context.js';
  import type { components } from '$lib/api/schema.js';
  import {
    FeatureTree,
    CreateFeatureDialog,
    ArchiveFeatureDialog,
    WrapInGroupDialog,
  } from '$lib/components/features/index.js';
  import { findFeature } from '$lib/components/features/featureTreeUtils.js';
  import {
    EmptyProjectGuide,
    OnboardingGuide,
    WelcomeScreen,
  } from '$lib/components/projects/index.js';
  import ResizeDivider from '$lib/components/ui/ResizeDivider.svelte';
  import InfoBanner from '$lib/components/ui/InfoBanner.svelte';
  import { StateIcon } from '$lib/components/icons/index.js';
  import TerminalTabs from '$lib/components/terminal/TerminalTabs.svelte';
  import type { VersionSummary } from '@manifest/svelte/commands';
  import {
    sidebarWidth,
    rightSidebarWidth,
    debugEmptyState,
    serverConnection,
    type DebugEmptyState,
  } from '$lib/stores/index.js';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import {
    getProjectsContext,
    getRightPanelContext,
    setProjectDataContext,
  } from '$lib/contexts/types.js';
  import { createFeatureMutations } from '$lib/features/mutations.svelte.js';
  import {
    fetchFeatureTree,
    fetchFeature,
    fetchVersions,
    fetchDirectories,
  } from '$lib/features/loader.js';

  const authApi = getAuthApiContext();

  type Feature = components['schemas']['Feature'];
  type FeatureTreeNode = components['schemas']['FeatureTreeNode'];
  type Version = components['schemas']['Version'];

  let { children } = $props();

  const projectsContext = getProjectsContext();
  const rightPanel = getRightPanelContext();

  // --- Shared data state ---
  let featureTree = $state<FeatureTreeNode[]>([]);
  let selectedFeature = $state<Feature | null>(null);
  let versions = $state<Version[]>([]);
  let gitRemote = $state<string | undefined>(undefined);
  let primaryDirectoryPath = $state<string | undefined>(undefined);
  let hasDirectories = $state<boolean | null>(null);
  let isLoadingFeatures = $state(false);
  let isLoadingFeature = $state(false);
  let loadError = $state<string | null>(null);

  // FeatureTree ref for scroll sync and tree control
  let featureTreeRef = $state<ReturnType<typeof FeatureTree> | null>(null);
  let treeScrollTop = $state(0);
  let hoveredFeatureId = $state<string | null>(null);
  let activeVersionFilter = $state<{ versionId: string | null; versionName: string } | null>(null);

  function handleTreeScroll(scrollTop: number) {
    treeScrollTop = scrollTop;
  }

  function handleScrollSync(scrollTop: number) {
    treeScrollTop = scrollTop;
    featureTreeRef?.scrollTo(scrollTop);
  }

  function handleHoverFeature(id: string | null) {
    hoveredFeatureId = id;
  }

  // Right sidebar resize
  let isResizingRight = $state(false);

  const projectSlug = $derived(page.params.projectSlug);
  const project = $derived(
    projectsContext.projects.find((p) => p.slug === projectSlug),
  );
  const projectId = $derived(project?.id);
  const selectedFeatureId = $derived(page.url.searchParams.get('feature'));
  const acFormat = $derived(
    (project as any)?.ac_format as 'checkbox' | 'gherkin' | undefined,
  );

  // Derive whether we're on the versions (plan) route
  const isVersionView = $derived(page.url.pathname.endsWith('/versions'));

  // Derive feature node info from tree
  const selectedNode = $derived(
    selectedFeatureId ? findFeature(featureTree, selectedFeatureId) : null,
  );

  const selectedFeatureIsGroup = $derived(
    selectedNode ? selectedNode.children.length > 0 : false,
  );

  const selectedFeatureChildCount = $derived(
    selectedNode ? selectedNode.children.length : 0,
  );

  const selectedFeatureParentId = $derived(selectedNode?.parent_id ?? null);

  const isSelectedLeaf = $derived(
    selectedNode ? selectedNode.children.length === 0 : true,
  );

  const isSelectedRoot = $derived(selectedNode?.is_root ?? false);

  // Merge is_root from tree node into selectedFeature
  const selectedFeatureWithRoot = $derived.by(() => {
    if (!selectedFeature || !selectedFeatureId) return selectedFeature;
    const node = findFeature(featureTree, selectedFeatureId);
    if (node?.is_root) {
      return { ...selectedFeature, is_root: true };
    }
    return selectedFeature;
  });

  // Dialog parent title
  const createDialogParentTitle = $derived.by(() => {
    if (!mutations.createDialogParentId) return null;
    const node = findFeature(featureTree, mutations.createDialogParentId);
    return node?.title ?? null;
  });

  // Onboarding / empty states
  const showNoProjects = $derived(debugEmptyState.value === 'no-projects');
  const isProjectEmpty = $derived(
    debugEmptyState.value === 'no-features' ||
      (!isLoadingFeatures && featureTree.length === 0),
  );
  const hasInstructionsToBreakDown = $derived.by(() => {
    if (featureTree.length !== 1) return false;
    const root = featureTree[0];
    return root.is_root && root.children.length === 0 && !!root.details?.trim();
  });

  const needsOnboarding = $derived(
    debugEmptyState.value === 'no-directory' || hasDirectories === false,
  );

  // --- Version summaries (derived from tree + versions) ---
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

  const nextVersion = $derived(versions.find((v) => !v.released_at));
  const nextVersionName = $derived(nextVersion?.name);

  // Check if "Next" version is feature complete (all targeted leaves are implemented)
  const isNowFeatureComplete = $derived.by(() => {
    if (!nextVersion) return false;
    const leaves = collectLeaves(featureTree);
    const nextVersionFeatures = leaves.filter(
      (f) => f.target_version_id === nextVersion.id,
    );
    if (nextVersionFeatures.length === 0) return false;
    return nextVersionFeatures.every((f) => f.state === 'implemented');
  });

  const unassignedFeatureCount = $derived.by(() => {
    const leaves = collectLeaves(featureTree);
    return leaves.filter((f) => !f.target_version_id && !f.is_root).length;
  });

  // --- Data loading ---

  // Reset terminals when project changes.
  // Setting hasDirectories=null unmounts TerminalTabs (closing all WebSockets),
  // then resetTerminals() creates a single fresh tab. When loadDirectories()
  // completes, TerminalTabs remounts with the new project's CWD.
  let prevProjectId: string | undefined = undefined;
  $effect(() => {
    const pid = projectId;
    if (prevProjectId !== undefined && pid !== prevProjectId) {
      hasDirectories = null;
      primaryDirectoryPath = undefined;
      rightPanel.resetTerminals();
    }
    prevProjectId = pid;
  });

  $effect(() => {
    if (projectId && authApi.isReady()) {
      loadFeatureTree(projectId);
      loadVersions(projectId);
      loadDirectories(projectId);
    }
  });

  // SSE subscription with exponential backoff reconnection
  function connectSSE(pid: string) {
    let retryDelay = 1000;
    const MAX_DELAY = 30_000;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let source: EventSource | null = null;
    let closed = false;

    function connect() {
      if (closed) return;
      source = subscribeToProject(pid);

      source.onopen = () => {
        retryDelay = 1000;
        serverConnection.setConnected();
        loadFeatureTree(pid);
        if (selectedFeatureId) {
          loadFeature(selectedFeatureId, true);
        }
      };

      source.addEventListener('change', () => {
        loadFeatureTree(pid);
        if (selectedFeatureId) {
          loadFeature(selectedFeatureId, true);
        }
      });

      source.onerror = () => {
        source?.close();
        serverConnection.setDisconnected();
        if (!closed) {
          retryTimer = setTimeout(connect, retryDelay);
          retryDelay = Math.min(retryDelay * 2, MAX_DELAY);
        }
      };
    }

    connect();

    return () => {
      closed = true;
      source?.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }

  $effect(() => {
    if (!projectId || !authApi.isReady()) return;
    return connectSSE(projectId);
  });

  // Load feature details when selection changes
  $effect(() => {
    if (selectedFeatureId && authApi.isReady()) {
      loadFeature(selectedFeatureId);
    } else if (!selectedFeatureId) {
      selectedFeature = null;
    }
  });

  // Notify server of focused feature (for MCP agents to query)
  $effect(() => {
    const featureId = selectedFeatureId ?? null;
    if (projectId && authApi.isReady()) {
      authApi.getClient().then((api) => {
        api.PUT('/projects/{id}/focus', {
          params: { path: { id: projectId! } },
          body: { feature_id: featureId },
        });
      });
    }
  });

  let lastLoadedFeatureId: string | null = null;

  async function loadFeatureTree(pid: string) {
    isLoadingFeatures = true;
    try {
      const result = await fetchFeatureTree(authApi, pid);
      loadError = result.error;
      featureTree = result.data;

      if (!selectedFeatureId && result.data.length > 0) {
        const url = new URL(page.url);
        url.searchParams.set('feature', result.data[0].id);
        goto(url.pathname + url.search, {
          replaceState: true,
        });
      }
    } finally {
      isLoadingFeatures = false;
    }
  }

  async function loadFeature(featureId: string, force = false) {
    if (
      !force &&
      selectedFeature?.id === featureId &&
      lastLoadedFeatureId === featureId
    ) {
      return;
    }

    const isRefresh = selectedFeature?.id === featureId;
    if (!isRefresh) {
      isLoadingFeature = true;
    }
    try {
      const data = await fetchFeature(authApi, featureId);
      if (!data) {
        selectedFeature = null;
        lastLoadedFeatureId = null;
        return;
      }
      selectedFeature = data;
      lastLoadedFeatureId = featureId;
    } finally {
      if (!isRefresh) {
        isLoadingFeature = false;
      }
    }
  }

  async function loadVersions(pid: string) {
    versions = await fetchVersions(authApi, pid);
  }

  async function loadDirectories(pid: string) {
    const info = await fetchDirectories(authApi, pid);
    hasDirectories = info.hasDirectories;
    primaryDirectoryPath = info.primaryDirectoryPath;
    gitRemote = info.gitRemote;
  }

  // --- Mutation handlers (extracted to composable) ---
  const mutations = createFeatureMutations({
    authApi,
    getProjectId: () => projectId,
    getProjectSlug: () => projectSlug,
    getFeatureTree: () => featureTree,
    getSelectedFeature: () => selectedFeature,
    getSelectedFeatureId: () => selectedFeatureId,
    getSelectedFeatureIsGroup: () => selectedFeatureIsGroup,
    getSelectedFeatureChildCount: () => selectedFeatureChildCount,
    getSelectedFeatureParentId: () => selectedFeatureParentId,
    getIsSelectedRoot: () => isSelectedRoot,
    setSelectedFeature: (f) => { selectedFeature = f; },
    loadFeatureTree,
    loadFeature,
    navigateTo: (path, opts) => goto(path, opts),
    createTerminalTab: rightPanel.createTerminalTab,
    getDefaultAgent: () => rightPanel.defaultAgent,
  });

  // Sync feature states to terminal tabs when tree changes
  $effect(() => {
    const tree = featureTree;
    for (const tab of rightPanel.terminalTabs) {
      if (!tab.featureId) continue;
      const node = findFeature(tree, tab.featureId);
      const state = node?.state ?? undefined;
      if (state && tab.featureState !== state) {
        rightPanel.updateTerminalTabState(tab.id, state);
      }
    }
  });

  // Auto-launch breakdown when arriving from wizard with instructions
  let autoBreakdownFired = false;
  $effect(() => {
    if (
      !autoBreakdownFired &&
      page.url.searchParams.get('autoBreakdown') === 'true' &&
      project &&
      hasDirectories !== null
    ) {
      autoBreakdownFired = true;
      const url = new URL(page.url);
      url.searchParams.delete('autoBreakdown');
      goto(url.pathname + (url.search || ''), { replaceState: true });
      sendPlanPrompt();
    }
  });

  function sendPlanPrompt() {
    const name = project?.name ?? 'this project';
    const safeName = name.replace(/'/g, "'\\''");
    const agentCmd = rightPanel.defaultAgent;
    rightPanel.createTerminalTab({
      label: `Plan: ${name}`.slice(0, 40),
      initialInput: `${agentCmd} 'Read the project instructions for "${safeName}" using get_project_instructions and break them down into a feature tree using the plan tool. After creating features, assign them across versions to define an implementation roadmap — foundational features in the first version, dependent features in later versions. Create additional versions with create_version and use set_feature_version to distribute features.'\r`,
    });
  }

  function handleSelectFeature(id: string) {
    const currentPath = page.url.pathname;
    goto(`${currentPath}?feature=${id}`);
  }

  function handleResize(deltaX: number) {
    sidebarWidth.resize(deltaX);
  }

  // Right sidebar resize handler
  function handleRightResizeStart(e: PointerEvent) {
    e.preventDefault();
    isResizingRight = true;
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
      isResizingRight = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    }

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  }

  // --- Provide context to child routes ---
  setProjectDataContext({
    get featureTree() {
      return featureTree;
    },
    get selectedFeature() {
      return selectedFeatureWithRoot;
    },
    get selectedFeatureId() {
      return selectedFeatureId;
    },
    get selectedFeatureIsGroup() {
      return selectedFeatureIsGroup;
    },
    get versions() {
      return versions;
    },
    get projectId() {
      return projectId;
    },
    get projectSlug() {
      return projectSlug;
    },
    get gitRemote() {
      return gitRemote;
    },
    get isLoadingFeatures() {
      return isLoadingFeatures;
    },
    get isLoadingFeature() {
      return isLoadingFeature;
    },
    get isProjectEmpty() {
      return isProjectEmpty;
    },
    get hasInstructionsToBreakDown() {
      return hasInstructionsToBreakDown;
    },
    get acFormat() {
      return acFormat;
    },
    get treeScrollTop() {
      return treeScrollTop;
    },
    get expandedIds() {
      return featureTreeRef?.getExpandedIds() ?? new Set<string>();
    },
    get activeFilters() {
      return featureTreeRef?.getActiveFilters() ?? new Set();
    },
    get hoveredFeatureId() {
      return hoveredFeatureId;
    },
    get activeVersionFilter() {
      return activeVersionFilter;
    },
    loadFeatureTree: () =>
      projectId ? loadFeatureTree(projectId) : Promise.resolve(),
    loadVersions: () =>
      projectId ? loadVersions(projectId) : Promise.resolve(),
    handleSelectFeature,
    handleSaveFeature: mutations.handleSaveFeature,
    handleVersionChange: mutations.handleVersionChange,
    handleReparentFeature: mutations.handleReparentFeature,
    handleOpenCreateDialog: mutations.handleOpenCreateDialog,
    handleOpenArchiveDialog: mutations.handleOpenArchiveDialog,
    handleArchiveFromDetail: mutations.handleArchiveFromDetail,
    handleRestoreFeature: mutations.handleRestoreFeature,
    handleRestoreFromDetail: mutations.handleRestoreFromDetail,
    handleDeleteFeature: mutations.handleDeleteFeature,
    handleDeleteFromDetail: mutations.handleDeleteFromDetail,
    handleStartWorking: mutations.handleStartWorking,
    handleScrollSync,
    handleHoverFeature,
    handleExpandForVersion: (versionId: string | null) => {
      // Toggle: if same version is active, clear filter + expand all
      if (activeVersionFilter && activeVersionFilter.versionId === versionId) {
        activeVersionFilter = null;
        featureTreeRef?.expandAll();
        return;
      }
      // Look up version name
      const ver = versions.find((v) => v.id === versionId);
      const name = ver ? ver.name : 'Backlog';
      activeVersionFilter = { versionId, versionName: name };
      featureTreeRef?.expandForVersion(versionId);
    },
    handleExpandAll: () => {
      activeVersionFilter = null;
      featureTreeRef?.expandAll();
    },
    handleCollapseAll: () => {
      activeVersionFilter = null;
      featureTreeRef?.collapseAll();
    },
    handleToggleFilter: (
      state: import('$lib/stores/featureFilter.svelte.js').FilterableState,
    ) => featureTreeRef?.toggleFilter(state),
    sendPlanPrompt,
  });
</script>

{#if showNoProjects}
  <WelcomeScreen />
{:else if needsOnboarding}
  <div class="onboarding-container">
    <OnboardingGuide scenario="no-directory" projectName={project?.name} />
  </div>
{:else}
  <div class="project-layout" class:plan-view={isVersionView}>
    <div class="project-columns">
      <!-- Left panel: FeatureTree (always visible) -->
      <aside class="left-panel" style="width: {sidebarWidth.value}px">
        {#if loadError}
          <div class="error-state">
            <p class="error-message">{loadError}</p>
            <button class="btn btn-secondary" onclick={() => projectId && loadFeatureTree(projectId)}>Retry</button>
          </div>
        {:else if isLoadingFeatures && featureTree.length === 0}
          <div class="loading-state">
            <div class="spinner"></div>
            <span>Loading features...</span>
          </div>
        {:else}
          <FeatureTree
            bind:this={featureTreeRef}
            features={featureTree}
            selectedId={selectedFeatureId}
            projectId={projectId!}
            featureColumnWidth={sidebarWidth.value}
            showBannerSpacer={isVersionView && isNowFeatureComplete}
            onSelect={handleSelectFeature}
            onAddFeature={mutations.handleOpenCreateDialog}
            onReparent={mutations.handleReparentFeature}
            onCreateGroup={mutations.handleCreateGroup}
            onWrapInGroup={mutations.handleOpenWrapDialog}
            onArchiveFeature={mutations.handleOpenArchiveDialog}
            onRestoreFeature={mutations.handleRestoreFeature}
            onDeleteFeature={mutations.handleDeleteFeature}
            onImplementFeature={mutations.handleImplementFeature}
            onScroll={handleTreeScroll}
            {hoveredFeatureId}
            onHoverFeature={handleHoverFeature}
          />
        {/if}
      </aside>

      <ResizeDivider onResize={handleResize} />

      <!-- Center column: content -->
      <div class="center-column">
        {@render children()}
      </div>

      <!-- Right panel: Terminal -->
      <aside class="right-panel" style="width: {rightSidebarWidth.value}px">
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
          class="right-resize-handle"
          class:resizing={isResizingRight}
          onpointerdown={handleRightResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize right panel"
          tabindex="0"
        ></div>
        <div class="tab-content">
          {#if hasDirectories !== null}
            <TerminalTabs cwd={primaryDirectoryPath} />
          {/if}
        </div>
      </aside>
    </div>

    <footer class="app-footer">
      <div class="footer-left">
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
      <div class="footer-right">
        {#if import.meta.env.DEV}
          <select
            class="debug-select"
            class:active={debugEmptyState.isActive}
            value={debugEmptyState.value}
            onchange={(e: Event) =>
              debugEmptyState.set(
                (e.target as HTMLSelectElement).value as DebugEmptyState,
              )}
            title="Debug: Test empty states"
          >
            <option value="none">Debug</option>
            <option value="no-projects">No Projects</option>
            <option value="no-directory">No Directory</option>
            <option value="no-features">No Features</option>
          </select>
        {/if}
        <span
          class="status-dot"
          class:disconnected={!serverConnection.connected}
        ></span>
        <span class="status-text"
          >{serverConnection.connected
            ? 'Server running'
            : 'Disconnected'}</span
        >
      </div>
    </footer>
  </div>
{/if}

<!-- Shared dialogs -->
<CreateFeatureDialog
  open={mutations.createDialogOpen}
  onOpenChange={(open) => (mutations.createDialogOpen = open)}
  onCreate={mutations.handleCreateFeature}
  parentTitle={createDialogParentTitle}
/>

{#if mutations.archiveTarget}
  <ArchiveFeatureDialog
    open={mutations.archiveDialogOpen}
    onOpenChange={(open) => {
      mutations.archiveDialogOpen = open;
      if (!open) mutations.archiveTarget = null;
    }}
    featureTitle={mutations.archiveTarget.title}
    isGroup={mutations.archiveTarget.isGroup}
    childCount={mutations.archiveTarget.childCount}
    onArchive={mutations.handleArchiveFeature}
  />
{/if}

{#if mutations.wrapTarget}
  <WrapInGroupDialog
    open={mutations.wrapDialogOpen}
    onOpenChange={(open) => {
      mutations.wrapDialogOpen = open;
      if (!open) mutations.wrapTarget = null;
    }}
    featureTitle={mutations.wrapTarget.title}
    onCreate={mutations.handleWrapInGroup}
  />
{/if}

<style>
  .onboarding-container {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    background: var(--background);
  }

  .project-layout {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    --row-hover-bg: var(--background-muted);
  }

  .project-columns {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .project-layout.plan-view {
    --row-hover-bg: color-mix(
      in srgb,
      var(--background-emphasis) 50%,
      transparent
    );
  }

  /* Panel header (right panel) */
  /* Hide feature tree scrollbar in plan view — VersionColumns provides the scrollbar */
  .project-layout.plan-view :global(.tree-content) {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .project-layout.plan-view :global(.tree-content::-webkit-scrollbar) {
    display: none;
  }

  .left-panel {
    background: var(--background);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    min-height: 0;
    overflow: hidden;
  }

  .center-column {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  /* Right panel: Terminal */
  .right-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    min-width: 250px;
    max-width: 1200px;
    border-left: 1px solid var(--border-default);
    background: var(--background);
    min-height: 0;
    overflow: hidden;
  }

  .right-resize-handle {
    position: absolute;
    left: -3px;
    top: 0;
    bottom: 0;
    width: 6px;
    cursor: col-resize;
    z-index: 10;
  }

  .right-resize-handle:hover,
  .right-resize-handle.resizing {
    background: var(--accent-blue);
    opacity: 0.5;
  }

  .tab-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* Footer */
  .app-footer {
    display: flex;
    align-items: center;
    height: 26px;
    padding: 0 8px;
    background: var(--background-subtle);
    border-top: 1px solid var(--border-default);
    flex-shrink: 0;
    gap: 8px;
  }

  .footer-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .footer-right {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--foreground-subtle);
    margin-left: auto;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent-green);
  }

  .status-dot.disconnected {
    background: var(--accent-red, #f85149);
  }

  .status-text {
    font-weight: 500;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--foreground-subtle);
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    color: var(--foreground-subtle);
    font-size: 14px;
  }

  .loading-state .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-default);
    border-top-color: var(--accent-blue);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    padding: 24px;
    text-align: center;
  }

  .error-message {
    color: var(--accent-red);
    font-size: 13px;
    margin: 0;
  }

  .debug-select {
    padding: 2px 20px 2px 6px;
    font-size: 11px;
    font-weight: 500;
    background: var(--background);
    border: 1px solid var(--border-default);
    border-radius: 4px;
    color: var(--foreground-muted);
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6L8 10L12 6' stroke='%238b949e' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 4px center;
  }

  .debug-select:hover {
    border-color: var(--foreground-subtle);
    color: var(--foreground);
  }

  .debug-select.active {
    background-color: #f59e0b;
    border-color: #f59e0b;
    color: black;
  }
</style>
