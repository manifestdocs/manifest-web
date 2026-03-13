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
  import TutorialOverlay from '$lib/components/ui/TutorialOverlay.svelte';
  import InfoBanner from '$lib/components/ui/InfoBanner.svelte';
  import { StateIcon } from '$lib/components/icons/index.js';
  import type { VersionSummary } from '@manifest/svelte/commands';
  import {
    sidebarWidth,
    debugEmptyState,
    serverConnection,
    notifications,
    tutorial,
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
  import { isDisplayId, toDisplayId } from '$lib/features/display-id.js';

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

  const projectSlug = $derived(page.params.projectSlug);
  const project = $derived(
    projectsContext.projects.find((p) => p.slug === projectSlug),
  );
  const projectId = $derived(project?.id);
  const featureParam = $derived(page.url.searchParams.get('feature'));
  // --- Display ID ↔ UUID maps (built from feature tree + project prefix) ---
  const displayIdToUuid = $derived.by(() => {
    const prefix = project?.key_prefix;
    if (!prefix) return new Map<string, string>();
    const map = new Map<string, string>();
    function walk(nodes: FeatureTreeNode[]) {
      for (const node of nodes) {
        if (node.feature_number != null) {
          map.set(`${prefix}-${node.feature_number}`, node.id);
        }
        walk(node.children);
      }
    }
    walk(featureTree);
    return map;
  });

  const uuidToDisplayId = $derived.by(() => {
    const prefix = project?.key_prefix;
    if (!prefix) return new Map<string, string>();
    const map = new Map<string, string>();
    function walk(nodes: FeatureTreeNode[]) {
      for (const node of nodes) {
        if (node.feature_number != null) {
          map.set(node.id, `${prefix}-${node.feature_number}`);
        }
        walk(node.children);
      }
    }
    walk(featureTree);
    return map;
  });

  function getDisplayId(uuid: string): string {
    return uuidToDisplayId.get(uuid) ?? uuid;
  }

  // Resolve URL param (display ID or UUID) to a UUID
  const selectedFeatureId = $derived.by(() => {
    if (!featureParam) return null;
    // If it's a display ID, resolve via map
    if (isDisplayId(featureParam)) {
      return displayIdToUuid.get(featureParam.toUpperCase()) ?? displayIdToUuid.get(featureParam) ?? null;
    }
    // Otherwise treat as UUID
    return featureParam;
  });

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
      const active = assigned.filter((f) => f.state !== 'archived');
      const implemented = active.filter((f) => f.state === 'implemented');
      return {
        id: v.id,
        name: v.name,
        featureCount: active.length,
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
    const active = nextVersionFeatures.filter((f) => f.state !== 'archived');
    if (active.length === 0) return false;
    return active.every((f) => f.state === 'implemented');
  });

  const unassignedFeatureCount = $derived.by(() => {
    const leaves = collectLeaves(featureTree);
    return leaves.filter((f) => !f.target_version_id && !f.is_root).length;
  });

  // --- Data loading ---

  // Reset state when project changes.
  let prevProjectId: string | undefined = undefined;
  $effect(() => {
    const pid = projectId;
    if (prevProjectId !== undefined && pid !== prevProjectId) {
      hasDirectories = null;
      primaryDirectoryPath = undefined;
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
    } else if (!selectedFeatureId && !featureParam) {
      selectedFeature = null;
    }
  });

  // Rewrite UUID URLs to display IDs when the tree loads
  $effect(() => {
    if (!featureParam || !selectedFeatureId) return;
    // If URL has a UUID but we know the display ID, silently rewrite
    if (!isDisplayId(featureParam)) {
      const displayId = uuidToDisplayId.get(featureParam);
      if (displayId) {
        const url = new URL(page.url);
        url.searchParams.set('feature', displayId);
        goto(url.pathname + url.search, { replaceState: true });
      }
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

      // Track feature states for browser notification detection.
      // First call seeds the baseline; subsequent calls detect transitions
      // to 'implemented' and fire notifications when appropriate.
      if (projectSlug) {
        notifications.processTreeUpdate(pid, projectSlug, result.data);
      }

      if (!featureParam && result.data.length > 0) {
        const firstFeature = result.data[0];
        const prefix = project?.key_prefix;
        const displayId = prefix && firstFeature.feature_number != null
          ? `${prefix}-${firstFeature.feature_number}`
          : firstFeature.id;
        const url = new URL(page.url);
        url.searchParams.set('feature', displayId);
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
    getDefaultAgent: () => rightPanel.defaultAgent,
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
    // No-op: terminal has been removed. Planning is done via the CLI agent.
  }

  function handleSelectFeature(id: string) {
    const currentPath = page.url.pathname;
    const displayId = getDisplayId(id);
    goto(`${currentPath}?feature=${displayId}`);
  }

  function handleResize(deltaX: number) {
    sidebarWidth.resize(deltaX);
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
    getDisplayId,
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
            activeVersionId={activeVersionFilter?.versionId}
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
        <div class="legend-item">
          <StateIcon state="blocked" size={12} />
          <span>Blocked</span>
        </div>
        <div class="legend-item">
          <span class="legend-diff">+</span>
          <span>Pending Changes</span>
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

{#if !tutorial.projectCompleted && !isProjectEmpty && !needsOnboarding}
  <TutorialOverlay mode="project" onComplete={() => tutorial.completeProject()} />
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

  /* Hide feature tree scrollbar in plan view — VersionColumns provides the scrollbar */
  .project-layout.plan-view :global(.tree-content) {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .project-layout.plan-view :global(.tree-content::-webkit-scrollbar) {
    display: none;
  }

  /* Disable elastic overscroll on both synced scroll containers so they
     don't bounce independently when reaching the top/bottom edge. */
  .project-layout.plan-view :global(.tree-content),
  .project-layout.plan-view :global(.version-columns-scroll) {
    overscroll-behavior-y: none;
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

  .legend-diff {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 11px;
    height: 11px;
    font-size: 0.85rem;
    font-weight: 700;
    line-height: 1;
    border: 1px solid var(--accent-purple);
    border-radius: 0;
    color: var(--accent-purple);
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
