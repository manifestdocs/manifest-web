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
  import { StateIcon } from '$lib/components/icons/index.js';
  import AiChat from '$lib/components/features/AiChat.svelte';
  import Terminal from '$lib/components/terminal/Terminal.svelte';
  import { groupVersions } from '$lib/components/versions/versionUtils.js';
  import type { VersionSummary } from '@manifest/svelte/commands';
  import {
    sidebarWidth,
    rightSidebarWidth,
    debugEmptyState,
    serverConnection,
  } from '$lib/stores/index.js';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { getContext, setContext } from 'svelte';

  const authApi = getAuthApiContext();

  type Project = components['schemas']['Project'];
  type Feature = components['schemas']['Feature'];
  type FeatureTreeNode = components['schemas']['FeatureTreeNode'];
  type FeatureState = components['schemas']['FeatureState'];
  type Version = components['schemas']['Version'];

  interface ProjectsContext {
    readonly projects: Project[];
    readonly isLoading: boolean;
    refresh: () => Promise<void>;
  }

  let { children } = $props();

  const projectsContext = getContext<ProjectsContext>('projects');

  // Right panel tab context — state lives in app layout
  interface RightPanelContext {
    readonly activeTab: 'chat' | 'terminal';
    readonly terminalMounted: boolean;
    setActiveTab(tab: 'chat' | 'terminal'): void;
    setTerminalMounted(v: boolean): void;
    toggleTab(): void;
    resetToChat(): void;
  }

  const rightPanel = getContext<RightPanelContext>('rightPanel');

  // --- Shared data state ---
  let featureTree = $state<FeatureTreeNode[]>([]);
  let selectedFeature = $state<Feature | null>(null);
  let versions = $state<Version[]>([]);
  let gitRemote = $state<string | undefined>(undefined);
  let primaryDirectoryPath = $state<string | undefined>(undefined);
  let hasDirectories = $state<boolean | null>(null);
  let isLoadingFeatures = $state(false);
  let isLoadingFeature = $state(false);

  // Dialog state
  let createDialogOpen = $state(false);
  let createDialogParentId = $state<string | null>(null);
  let archiveDialogOpen = $state(false);
  let archiveTarget = $state<{
    id: string;
    title: string;
    isGroup: boolean;
    childCount: number;
    parentId: string | null;
  } | null>(null);
  let wrapDialogOpen = $state(false);
  let wrapTarget = $state<{
    id: string;
    title: string;
    parentId: string | null;
  } | null>(null);

  // FeatureTree ref for scroll sync and tree control
  let featureTreeRef = $state<ReturnType<typeof FeatureTree> | null>(null);
  let treeScrollTop = $state(0);
  let hoveredFeatureId = $state<string | null>(null);

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
  const acFormat = $derived((project as any)?.ac_format as 'checkbox' | 'gherkin' | undefined);

  // Derive whether we're on the versions (plan) route
  const isVersionView = $derived(
    page.url.pathname.endsWith('/versions'),
  );

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

  const selectedFeatureParentId = $derived(
    selectedNode?.parent_id ?? null,
  );

  const isSelectedLeaf = $derived(
    selectedNode ? selectedNode.children.length === 0 : true,
  );

  const isSelectedRoot = $derived(
    selectedNode?.is_root ?? false,
  );

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
    if (!createDialogParentId) return null;
    const node = findFeature(featureTree, createDialogParentId);
    return node?.title ?? null;
  });

  // Onboarding / empty states
  const showNoProjects = $derived(debugEmptyState.value === 'no-projects');
  const isProjectEmpty = $derived(
    debugEmptyState.value === 'no-features' ||
      (!isLoadingFeatures && featureTree.length === 0),
  );
  const needsOnboarding = $derived(
    debugEmptyState.value === 'no-directory' || hasDirectories === false,
  );

  // --- Version summaries for AiChat (derived from tree + versions) ---
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

  const unassignedFeatureCount = $derived.by(() => {
    const leaves = collectLeaves(featureTree);
    return leaves.filter((f) => !f.target_version_id && !f.is_root).length;
  });

  // Grouped versions for secondary header
  const groupedVersions = $derived(groupVersions(versions));

  // --- Data loading ---

  // Reset right panel to chat when project changes (terminal remounts with new CWD)
  let prevProjectId: string | undefined = undefined;
  $effect(() => {
    const pid = projectId;
    if (prevProjectId !== undefined && pid !== prevProjectId) {
      rightPanel.resetToChat();
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

  async function loadFeatureTree(pid: string) {
    isLoadingFeatures = true;
    try {
      const api = await authApi.getClient();
      const { data, error } = await api.GET('/projects/{id}/features/tree', {
        params: { path: { id: pid } },
      });
      if (error || !data) {
        console.error('Failed to load features:', error);
        featureTree = [];
        return;
      }
      featureTree = data;

      // Auto-select first feature if none selected
      if (!selectedFeatureId && data.length > 0) {
        goto(`/app/${projectSlug}?feature=${data[0].id}`, {
          replaceState: true,
        });
      }
    } finally {
      isLoadingFeatures = false;
    }
  }

  let lastLoadedFeatureId: string | null = null;

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
      const api = await authApi.getClient();
      const { data, error } = await api.GET('/features/{id}', {
        params: { path: { id: featureId } },
      });
      if (error || !data) {
        console.error('Failed to load feature:', error);
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
    try {
      const api = await authApi.getClient();
      const { data, error } = await api.GET('/projects/{id}/versions', {
        params: { path: { id: pid } },
      });
      if (error || !data) {
        console.error('Failed to load versions:', error);
        versions = [];
        return;
      }
      versions = data;
    } catch (e) {
      console.error('Failed to load versions:', e);
      versions = [];
    }
  }

  async function loadDirectories(pid: string) {
    try {
      const api = await authApi.getClient();
      const { data, error } = await api.GET('/projects/{id}/directories', {
        params: { path: { id: pid } },
      });
      if (error || !data) {
        gitRemote = undefined;
        hasDirectories = false;
        return;
      }
      hasDirectories = data.length > 0;
      const primary = data.find((d) => d.is_primary);
      primaryDirectoryPath = primary?.path ?? data[0]?.path ?? undefined;
      gitRemote =
        primary?.git_remote ??
        data.find((d) => d.git_remote)?.git_remote ??
        undefined;
    } catch (e) {
      gitRemote = undefined;
      primaryDirectoryPath = undefined;
      hasDirectories = false;
    }
  }

  // --- Mutation handlers ---
  async function handleSaveFeature(
    id: string,
    updates: {
      title?: string;
      details?: string | null;
      desired_details?: string | null;
      state?: FeatureState;
    },
  ) {
    const api = await authApi.getClient();
    const { data, error } = await api.PUT('/features/{id}', {
      params: { path: { id } },
      body: updates,
    });
    if (error || !data) {
      console.error('Failed to save feature:', error);
      throw new Error('Failed to save');
    }
    selectedFeature = data;
    if (projectId) {
      await loadFeatureTree(projectId);
    }
  }

  async function handleVersionChange(
    featureId: string,
    versionId: string | null,
  ) {
    const api = await authApi.getClient();
    const { error } = await api.PUT('/features/{id}', {
      params: { path: { id: featureId } },
      body: { target_version_id: versionId },
    });
    if (error) {
      console.error('Failed to update version:', error);
      throw new Error('Failed to update version');
    }
    await loadFeature(featureId);
  }

  function handleSelectFeature(id: string) {
    // Preserve the current route path when selecting a feature
    const currentPath = page.url.pathname;
    goto(`${currentPath}?feature=${id}`);
  }

  function handleResize(deltaX: number) {
    sidebarWidth.resize(deltaX);
  }

  function handleOpenCreateDialog(parentId: string | null) {
    createDialogParentId = parentId;
    createDialogOpen = true;
  }

  async function handleCreateFeature(title: string, details: string | null) {
    if (!projectId) return;

    const api = await authApi.getClient();
    const { data, error } = await api.POST('/projects/{id}/features', {
      params: { path: { id: projectId } },
      body: {
        title,
        details,
        parent_id: createDialogParentId,
      },
    });

    if (error || !data) {
      console.error('Failed to create feature:', error);
      throw new Error('Failed to create feature');
    }

    await loadFeatureTree(projectId);
    const currentPath = page.url.pathname;
    goto(`${currentPath}?feature=${data.id}`);
  }

  async function handleReparentFeature(
    featureId: string,
    newParentId: string | null,
  ) {
    const api = await authApi.getClient();
    const { error } = await api.PUT('/features/{id}', {
      params: { path: { id: featureId } },
      body: { parent_id: newParentId },
    });

    if (error) {
      console.error('Failed to reparent feature:', error);
      return;
    }

    if (projectId) {
      await loadFeatureTree(projectId);
    }
  }

  async function handleCreateGroup(
    title: string,
    childIds: [string, string],
    parentId: string | null,
  ) {
    if (!projectId) return;

    const api = await authApi.getClient();
    const { data: newGroup, error: createError } = await api.POST(
      '/projects/{id}/features',
      {
        params: { path: { id: projectId } },
        body: { title, parent_id: parentId },
      },
    );

    if (createError || !newGroup) {
      console.error('Failed to create group:', createError);
      return;
    }

    const reparentResults = await Promise.all(
      childIds.map((childId) =>
        api.PUT('/features/{id}', {
          params: { path: { id: childId } },
          body: { parent_id: newGroup.id },
        }),
      ),
    );

    const hasError = reparentResults.some((r) => r.error);
    if (hasError) {
      console.error('Failed to reparent some features');
    }

    await loadFeatureTree(projectId);
    const currentPath = page.url.pathname;
    goto(`${currentPath}?feature=${newGroup.id}`);
  }

  function handleOpenArchiveDialog(
    id: string,
    title: string,
    isGroup: boolean,
    childCount: number,
    parentId: string | null,
  ) {
    archiveTarget = { id, title, isGroup, childCount, parentId };
    archiveDialogOpen = true;
  }

  function handleOpenWrapDialog(
    featureId: string,
    featureTitle: string,
    parentId: string | null,
  ) {
    wrapTarget = { id: featureId, title: featureTitle, parentId };
    wrapDialogOpen = true;
  }

  async function handleWrapInGroup(title: string) {
    if (!wrapTarget || !projectId) return;

    const api = await authApi.getClient();
    const { data: newGroup, error: createError } = await api.POST(
      '/projects/{id}/features',
      {
        params: { path: { id: projectId } },
        body: { title, parent_id: wrapTarget.parentId },
      },
    );

    if (createError || !newGroup) {
      console.error('Failed to create group:', createError);
      throw new Error('Failed to create feature set');
    }

    const { error: reparentError } = await api.PUT('/features/{id}', {
      params: { path: { id: wrapTarget.id } },
      body: { parent_id: newGroup.id },
    });

    if (reparentError) {
      console.error('Failed to reparent feature:', reparentError);
      throw new Error('Failed to move feature into group');
    }

    await loadFeatureTree(projectId);
    const currentPath = page.url.pathname;
    goto(`${currentPath}?feature=${newGroup.id}`);

    wrapTarget = null;
  }

  function handleArchiveFromDetail() {
    if (!selectedFeature) return;
    if (isSelectedRoot) return;

    handleOpenArchiveDialog(
      selectedFeature.id,
      selectedFeature.title,
      selectedFeatureIsGroup,
      selectedFeatureChildCount,
      selectedFeatureParentId,
    );
  }

  async function handleRestoreFeature(featureId: string) {
    if (!projectId) return;

    const api = await authApi.getClient();
    const { error } = await api.PUT('/features/{id}', {
      params: { path: { id: featureId } },
      body: { state: 'proposed' },
    });

    if (error) {
      console.error('Failed to restore feature:', error);
      throw new Error('Failed to restore feature');
    }

    await loadFeatureTree(projectId);
  }

  function handleRestoreFromDetail() {
    if (!selectedFeature) return;
    handleRestoreFeature(selectedFeature.id);
  }

  async function handleDeleteFeature(featureId: string) {
    if (!projectId) return;

    const api = await authApi.getClient();
    const { error } = await api.DELETE('/features/{id}', {
      params: { path: { id: featureId } },
    });

    if (error) {
      console.error('Failed to delete feature:', error);
      throw new Error('Failed to delete feature');
    }

    await loadFeatureTree(projectId);

    if (selectedFeatureId === featureId) {
      goto(`/app/${projectSlug}`);
    }
  }

  async function handleDeleteFromDetail() {
    if (!selectedFeature) return;
    await handleDeleteFeature(selectedFeature.id);
  }

  async function handleArchiveFeature(moveChildrenToParent: boolean) {
    if (!archiveTarget || !projectId) return;

    const api = await authApi.getClient();
    const node = findFeature(featureTree, archiveTarget.id);

    if (moveChildrenToParent && archiveTarget.isGroup && node) {
      await Promise.all(
        node.children.map((child) =>
          api.PUT('/features/{id}', {
            params: { path: { id: child.id } },
            body: { parent_id: archiveTarget!.parentId },
          }),
        ),
      );
    } else if (archiveTarget.isGroup && node) {
      const archiveDescendants = (n: FeatureTreeNode): Promise<unknown>[] => {
        const promises: Promise<unknown>[] = [];
        for (const child of n.children) {
          promises.push(
            api.PUT('/features/{id}', {
              params: { path: { id: child.id } },
              body: { state: 'archived' },
            }),
          );
          promises.push(...archiveDescendants(child));
        }
        return promises;
      };
      await Promise.all(archiveDescendants(node));
    }

    const { error } = await api.PUT('/features/{id}', {
      params: { path: { id: archiveTarget.id } },
      body: { state: 'archived' },
    });

    if (error) {
      console.error('Failed to archive feature:', error);
      throw new Error('Failed to archive feature');
    }

    await loadFeatureTree(projectId);
    goto(`/app/${projectSlug}`);

    archiveTarget = null;
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
  setContext('projectData', {
    get featureTree() { return featureTree; },
    get selectedFeature() { return selectedFeatureWithRoot; },
    get selectedFeatureId() { return selectedFeatureId; },
    get selectedFeatureIsGroup() { return selectedFeatureIsGroup; },
    get versions() { return versions; },
    get projectId() { return projectId; },
    get projectSlug() { return projectSlug; },
    get gitRemote() { return gitRemote; },
    get isLoadingFeatures() { return isLoadingFeatures; },
    get isLoadingFeature() { return isLoadingFeature; },
    get isProjectEmpty() { return isProjectEmpty; },
    get acFormat() { return acFormat; },
    get treeScrollTop() { return treeScrollTop; },
    get expandedIds() { return featureTreeRef?.getExpandedIds() ?? new Set<string>(); },
    get activeFilters() { return featureTreeRef?.getActiveFilters() ?? new Set(); },
    get hoveredFeatureId() { return hoveredFeatureId; },
    loadFeatureTree: () => projectId ? loadFeatureTree(projectId) : Promise.resolve(),
    loadVersions: () => projectId ? loadVersions(projectId) : Promise.resolve(),
    handleSelectFeature,
    handleSaveFeature,
    handleVersionChange,
    handleReparentFeature,
    handleOpenCreateDialog,
    handleOpenArchiveDialog,
    handleArchiveFromDetail,
    handleRestoreFeature,
    handleRestoreFromDetail,
    handleDeleteFeature,
    handleDeleteFromDetail,
    handleScrollSync,
    handleHoverFeature,
    handleExpandAll: () => featureTreeRef?.expandAll(),
    handleCollapseAll: () => featureTreeRef?.collapseAll(),
    handleToggleFilter: (state: import('$lib/stores/featureFilter.svelte.js').FilterableState) => featureTreeRef?.toggleFilter(state),
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
    <!-- Secondary header bar -->
    <div class="secondary-header">
      <div class="header-left-section" style="width: {sidebarWidth.value}px"></div>
      <div class="header-center-section">
        {#if isVersionView}
          {#each groupedVersions as group}
            <div
              class="header-group-label"
              style="width: {group.versions.length * 80}px"
            >
              {group.label}
            </div>
          {/each}
          <div class="header-group-label" style="width: 80px">Backlog</div>
        {/if}
      </div>
      <div class="header-right-section" style="width: {rightSidebarWidth.value}px">
        <button
          class="panel-tab"
          class:active={rightPanel.activeTab === 'chat'}
          onclick={() => rightPanel.setActiveTab('chat')}
        >
          Chat
        </button>
        <button
          class="panel-tab"
          class:active={rightPanel.activeTab === 'terminal'}
          onclick={() => rightPanel.setActiveTab('terminal')}
          title="Cmd+`"
        >
          Terminal
        </button>
      </div>
    </div>

    <div class="project-columns">
    <!-- Left panel: FeatureTree (always visible) -->
    <aside class="left-panel" style="width: {sidebarWidth.value}px">
      {#if isLoadingFeatures && featureTree.length === 0}
        <div class="loading-state">Loading features...</div>
      {:else}
        <FeatureTree
          bind:this={featureTreeRef}
          features={featureTree}
          selectedId={selectedFeatureId}
          projectId={projectId!}
          featureColumnWidth={sidebarWidth.value}
          onSelect={handleSelectFeature}
          onAddFeature={handleOpenCreateDialog}
          onReparent={handleReparentFeature}
          onCreateGroup={handleCreateGroup}
          onWrapInGroup={handleOpenWrapDialog}
          onArchiveFeature={handleOpenArchiveDialog}
          onRestoreFeature={handleRestoreFeature}
          onDeleteFeature={handleDeleteFeature}
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

    <!-- Right panel: AI Chat + Terminal (tabbed) -->
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
      <div class="tab-content" class:hidden={rightPanel.activeTab !== 'chat'}>
        <AiChat
          featureId={selectedFeature?.id ?? null}
          featureTitle={selectedFeature?.title ?? ''}
          featureDetails={selectedFeature?.details ?? ''}
          featureState={selectedFeature?.state}
          projectId={projectId}
          isLeaf={isSelectedLeaf}
          isProjectRoot={isSelectedRoot}
          {acFormat}
          versions={versionSummaries}
          {nextVersionName}
          {unassignedFeatureCount}
          {isVersionView}
        />
      </div>
      <div class="tab-content" class:hidden={rightPanel.activeTab !== 'terminal'}>
        {#if rightPanel.terminalMounted}
          <Terminal cwd={primaryDirectoryPath} />
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
        <span class="status-dot" class:disconnected={!serverConnection.connected}></span>
        <span class="status-text">{serverConnection.connected ? 'Server running' : 'Disconnected'}</span>
      </div>
    </footer>
  </div>
{/if}

<!-- Shared dialogs -->
<CreateFeatureDialog
  open={createDialogOpen}
  onOpenChange={(open) => (createDialogOpen = open)}
  onCreate={handleCreateFeature}
  parentTitle={createDialogParentTitle}
/>

{#if archiveTarget}
  <ArchiveFeatureDialog
    open={archiveDialogOpen}
    onOpenChange={(open) => {
      archiveDialogOpen = open;
      if (!open) archiveTarget = null;
    }}
    featureTitle={archiveTarget.title}
    isGroup={archiveTarget.isGroup}
    childCount={archiveTarget.childCount}
    onArchive={handleArchiveFeature}
  />
{/if}

{#if wrapTarget}
  <WrapInGroupDialog
    open={wrapDialogOpen}
    onOpenChange={(open) => {
      wrapDialogOpen = open;
      if (!open) wrapTarget = null;
    }}
    featureTitle={wrapTarget.title}
    onCreate={handleWrapInGroup}
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

  /* Secondary header bar */
  .secondary-header {
    display: flex;
    align-items: stretch;
    height: 36px;
    background: var(--background-subtle);
    border-bottom: 1px solid var(--border-default);
    flex-shrink: 0;
  }

  .header-left-section {
    flex-shrink: 0;
    border-right: 1px solid var(--border-default);
  }

  .header-center-section {
    flex: 1;
    display: flex;
    align-items: center;
    min-width: 0;
    overflow: hidden;
  }

  .header-group-label {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--foreground);
    border-left: 1px solid var(--border-default);
    flex: none;
  }

  .header-right-section {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 0 12px;
    flex-shrink: 0;
    border-left: 1px solid var(--border-default);
  }

  .panel-tab {
    padding: 0 10px;
    height: 100%;
    font-size: 12px;
    font-weight: 500;
    color: var(--foreground-muted);
    background: none;
    border: none;
    cursor: pointer;
    transition: color 0.15s ease;
  }

  .panel-tab:hover {
    color: var(--foreground);
  }

  .panel-tab.active {
    color: var(--foreground);
    box-shadow: inset 0 -2px 0 var(--accent-blue);
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

  /* Right panel: AI Chat + Terminal (tabbed) */
  .right-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    min-width: 250px;
    max-width: 800px;
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

  .tab-content.hidden {
    display: none;
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
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--foreground-subtle);
    font-size: 14px;
  }
</style>
