<script lang="ts">
  import { api } from '$lib/api/client.js';
  import { setAuthApiContext } from '$lib/api/auth-context.js';
  import type { components } from '$lib/api/schema.js';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { setContext } from 'svelte';
  import headerLogotype from '$lib/assets/manifest_header_logotype.png';
  import {
    NewProjectWizard,
    ProjectSettingsDialog,
  } from '$lib/components/projects/index.js';
  import {
    SettingsIcon,
    PlusIcon,
    SearchIcon,
    CloseIcon,
  } from '$lib/components/icons/index.js';
  import { CommandPalette } from '$lib/components/command-palette/index.js';
  import UpdateBanner from '$lib/components/ui/UpdateBanner.svelte';
  import ConnectionBanner from '$lib/components/ui/ConnectionBanner.svelte';
  import McpConfigBanner from '$lib/components/ui/McpConfigBanner.svelte';
  import { debugEmptyState, serverConnection, rightSidebarWidth, type DebugEmptyState } from '$lib/stores/index.js';

  type Project = components['schemas']['Project'];

  let { children } = $props();

  // Set up auth API context for child components (no auth in self-hosted mode)
  setAuthApiContext(
    () => Promise.resolve(null),
    () => true,
  );

  let projects = $state<Project[]>([]);
  let isLoadingProjects = $state(true);

  // Dialog state
  let newProjectWizardOpen = $state(false);
  let settingsDialogOpen = $state(false);

  let commandPaletteOpen = $state(false);

  // Right panel tab state — owned here, consumed by project layout via context
  interface TerminalTab {
    id: string;
    label: string;
    initialInput?: string;
  }

  const MAX_TERMINAL_TABS = 8;
  let nextTerminalNumber = $state(2); // Start at 2 since we have a default Terminal 1

  // Create default terminal tab
  const defaultTerminalTab: TerminalTab = {
    id: crypto.randomUUID(),
    label: 'Terminal 1',
  };

  let terminalTabs = $state<TerminalTab[]>([defaultTerminalTab]);
  let activeTerminalTabId = $state<string | null>(defaultTerminalTab.id);
  let rightPanelTab = $state<'chat' | 'terminal'>('chat');
  let terminalMounted = $state(false);
  let terminalTabsScrollRef = $state<HTMLDivElement | null>(null);
  let attentionTabIds = $state<Set<string>>(new Set());

  function createTerminalTab() {
    if (terminalTabs.length >= MAX_TERMINAL_TABS) return;

    const tab: TerminalTab = {
      id: crypto.randomUUID(),
      label: `Terminal ${nextTerminalNumber}`,
    };
    nextTerminalNumber++;

    terminalTabs = [...terminalTabs, tab];
    activeTerminalTabId = tab.id;
    rightPanelTab = 'terminal';
    if (!terminalMounted) terminalMounted = true;

    // Scroll to show the new tab after DOM updates
    requestAnimationFrame(() => {
      if (terminalTabsScrollRef) {
        terminalTabsScrollRef.scrollLeft = terminalTabsScrollRef.scrollWidth;
      }
    });
  }

  function closeTerminalTab(tabId: string) {
    const idx = terminalTabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;

    terminalTabs = terminalTabs.filter((t) => t.id !== tabId);

    if (activeTerminalTabId === tabId) {
      if (terminalTabs.length === 0) {
        // Last tab closed — create a fresh default terminal
        const newTab: TerminalTab = {
          id: crypto.randomUUID(),
          label: `Terminal ${nextTerminalNumber}`,
        };
        nextTerminalNumber++;
        terminalTabs = [newTab];
        activeTerminalTabId = newTab.id;
      } else {
        // Switch to adjacent tab
        const newIdx = Math.min(idx, terminalTabs.length - 1);
        activeTerminalTabId = terminalTabs[newIdx].id;
      }
    }
  }

  function selectTerminalTab(tabId: string) {
    activeTerminalTabId = tabId;
    rightPanelTab = 'terminal';
    if (!terminalMounted) terminalMounted = true;
    // Clear attention when tab is selected
    if (attentionTabIds.has(tabId)) {
      attentionTabIds = new Set([...attentionTabIds].filter(id => id !== tabId));
    }
  }

  function markTerminalAttention(tabId: string) {
    // Only mark attention if tab is not currently active and visible
    const isActiveAndVisible = rightPanelTab === 'terminal' && activeTerminalTabId === tabId;
    if (!isActiveAndVisible && !attentionTabIds.has(tabId)) {
      attentionTabIds = new Set([...attentionTabIds, tabId]);
    }
  }

  setContext('rightPanel', {
    get activeTab() { return rightPanelTab; },
    get terminalMounted() { return terminalMounted; },
    get terminalTabs() { return terminalTabs; },
    get activeTerminalTabId() { return activeTerminalTabId; },
    setActiveTab(tab: 'chat' | 'terminal') {
      rightPanelTab = tab;
      if (tab === 'terminal' && !terminalMounted) terminalMounted = true;
    },
    setTerminalMounted(v: boolean) { terminalMounted = v; },
    toggleTab() { this.setActiveTab(rightPanelTab === 'chat' ? 'terminal' : 'chat'); },
    resetToChat() {
      rightPanelTab = 'chat';
      terminalMounted = false;
      // Reset to one default terminal
      const newTab: TerminalTab = {
        id: crypto.randomUUID(),
        label: 'Terminal 1',
      };
      terminalTabs = [newTab];
      activeTerminalTabId = newTab.id;
      nextTerminalNumber = 2;
      attentionTabIds = new Set();
    },
    createTerminalTab,
    closeTerminalTab,
    selectTerminalTab,
    markTerminalAttention,
  });

  // Debug state change handler
  function handleDebugStateChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    debugEmptyState.set(select.value as DebugEmptyState);
  }

  // Global keyboard shortcuts
  function handleGlobalKeydown(e: KeyboardEvent) {
    // Cmd+` create new terminal tab
    if ((e.metaKey || e.ctrlKey) && e.key === '`') {
      e.preventDefault();
      createTerminalTab();
      return;
    }

    // T for command palette (not in inputs)
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }
    if (
      (e.key === 't' || e.key === 'T') &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey
    ) {
      e.preventDefault();
      commandPaletteOpen = true;
    }
  }

  // Load projects on mount
  $effect(() => {
    loadProjects();
  });

  async function loadProjects() {
    isLoadingProjects = true;
    try {
      const { data, error } = await api.GET('/projects');
      if (error || !data) {
        console.error('Failed to load projects:', error);
        isLoadingProjects = false;
        return;
      }
      // Filter to unique project names, preferring those with descriptions
      const uniqueProjects = data.reduce((acc, project) => {
        const existing = acc.find((p) => p.name === project.name);
        if (!existing) {
          acc.push(project);
        } else if (!existing.description && project.description) {
          const idx = acc.indexOf(existing);
          acc[idx] = project;
        }
        return acc;
      }, [] as Project[]);

      projects = uniqueProjects.sort((a, b) => a.name.localeCompare(b.name));
    } finally {
      isLoadingProjects = false;
    }
  }

  function handleProjectChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const projectSlug = select.value;
    if (projectSlug) {
      goto(`/app/${projectSlug}`);
    }
  }

  const selectedProjectSlug = $derived(page.params.projectSlug || null);
  const selectedProject = $derived(
    projects.find((p) => p.slug === selectedProjectSlug),
  );
  const selectedFeatureId = $derived(page.url.searchParams.get('feature'));
  const featureQueryParam = $derived(
    selectedFeatureId ? `?feature=${selectedFeatureId}` : '',
  );

  // Remember last viewed project (by slug for cleaner URLs)
  $effect(() => {
    if (selectedProjectSlug && typeof localStorage !== 'undefined') {
      localStorage.setItem('manifest_last_project', selectedProjectSlug);
    }
  });

  // Provide projects context to child routes
  setContext('projects', {
    get projects() {
      return projects;
    },
    get isLoading() {
      return isLoadingProjects;
    },
    refresh: loadProjects,
  });

  // Expose wizard control to child routes (e.g., WelcomeScreen)
  setContext('newProjectWizard', {
    open: () => {
      newProjectWizardOpen = true;
    },
  });
</script>

<svelte:document onkeydown={handleGlobalKeydown} />

{#if page.params.projectSlug}
  <div class="app-layout">
    <header class="app-header">
      <div class="header-left">
        <a href="/" class="logo">
          <img src={headerLogotype} alt="Manifest" class="logo-image" />
        </a>
        <nav class="view-nav">
          <div class="nav-group">
            <a
              href="{base}/app/{selectedProjectSlug}{featureQueryParam}"
              class="nav-link"
              class:active={page.url.pathname === `/app/${selectedProjectSlug}`}
            >
              Edit
            </a>
            <a
              href="{base}/app/{selectedProjectSlug}/versions{featureQueryParam}"
              class="nav-link"
              class:active={page.url.pathname ===
                `/app/${selectedProjectSlug}/versions`}
            >
              Plan
            </a>
            <a
              href="{base}/app/{selectedProjectSlug}/activity"
              class="nav-link"
              class:active={page.url.pathname ===
                `/app/${selectedProjectSlug}/activity`}
            >
              Activity
            </a>
          </div>
        </nav>
        <div class="project-controls">
          <select
            class="project-select"
            value={selectedProjectSlug}
            onchange={handleProjectChange}
            disabled={isLoadingProjects}
          >
            {#if isLoadingProjects}
              <option value="">Loading...</option>
            {:else if projects.length === 0}
              <option value="">No projects</option>
            {:else}
              {#each projects as project (project.id)}
                <option value={project.slug}>{project.name}</option>
              {/each}
            {/if}
          </select>
          <button
            class="icon-btn"
            onclick={() => (settingsDialogOpen = true)}
            title="Settings"
          >
            <SettingsIcon size={16} />
          </button>
          <button
            class="icon-btn"
            onclick={() => (newProjectWizardOpen = true)}
            title="New project"
          >
            <PlusIcon size={16} />
          </button>
          <button
            class="search-btn"
            onclick={() => (commandPaletteOpen = true)}
            title="Search features (T)"
          >
            <SearchIcon size={14} />
            <span class="search-label">Search</span>
            <kbd class="search-kbd">T</kbd>
          </button>
        </div>
      </div>
      <div class="header-center"></div>
      <div class="header-right" style="width: {rightSidebarWidth.value}px">
        <div class="panel-tab-bar">
          <button
            class="panel-tab"
            class:active={rightPanelTab === 'chat'}
            onclick={() => { rightPanelTab = 'chat'; }}
          >
            Chat
          </button>
          <div class="terminal-tabs-scroll" bind:this={terminalTabsScrollRef}>
            {#each terminalTabs as tab (tab.id)}
              <div
                class="panel-tab terminal-tab"
                class:active={rightPanelTab === 'terminal' && activeTerminalTabId === tab.id}
                class:needs-attention={attentionTabIds.has(tab.id)}
              >
                <button
                  class="terminal-tab-label"
                  onclick={() => selectTerminalTab(tab.id)}
                  title={tab.label}
                >
                  {tab.label}
                </button>
                <button
                  class="terminal-tab-close"
                  onclick={(e: MouseEvent) => { e.stopPropagation(); closeTerminalTab(tab.id); }}
                  title="Close terminal"
                >
                  <CloseIcon size={10} />
                </button>
              </div>
            {/each}
          </div>
          <button
            class="panel-tab add-terminal-btn"
            onclick={() => createTerminalTab()}
            disabled={terminalTabs.length >= MAX_TERMINAL_TABS}
            title="New terminal (Cmd+`)"
          >
            <PlusIcon size={12} />
          </button>
        </div>
      </div>
    </header>

    <ConnectionBanner />
    <UpdateBanner />
    <McpConfigBanner />

    <main class="app-main">
      {@render children()}
    </main>
  </div>
{:else}
  {@render children()}
{/if}

<NewProjectWizard
  open={newProjectWizardOpen}
  onOpenChange={(open) => (newProjectWizardOpen = open)}
  onCreated={loadProjects}
/>

{#if selectedProject}
  <ProjectSettingsDialog
    open={settingsDialogOpen}
    onOpenChange={(open) => (settingsDialogOpen = open)}
    project={selectedProject}
    onUpdated={loadProjects}
    onDeleted={async () => {
      await loadProjects();
      if (projects.length > 0) {
        goto(`/app/${projects[0].slug}`);
      } else {
        goto('/app');
      }
    }}
  />
  <CommandPalette
    open={commandPaletteOpen}
    onOpenChange={(open) => (commandPaletteOpen = open)}
    projectId={selectedProject.id}
    projectSlug={selectedProjectSlug || ''}
  />
{/if}

<style>
  .app-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .app-header {
    display: flex;
    align-items: center;
    padding: 12px 0 12px 16px;
    background: var(--background-subtle);
    border-bottom: 1px solid var(--border-default);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .project-controls {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .header-center {
    flex: 1;
    display: flex;
    justify-content: flex-end;
    padding: 0 16px;
  }

  .header-right {
    display: flex;
    align-items: flex-end;
    flex-shrink: 0;
  }

  .project-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--foreground-muted);
  }

  .logo {
    display: flex;
    align-items: center;
    text-decoration: none;
    transition: opacity 0.15s ease;
  }

  .logo:hover {
    opacity: 0.8;
  }

  .logo-image {
    height: 30px;
    width: auto;
    position: relative;
    top: -1px;
    left: 1px;
  }

  .project-select {
    padding: 5px 26px 5px 10px;
    font-size: 13px;
    font-weight: 500;
    background: var(--background);
    border: 1px solid var(--border-default);
    border-radius: 6px;
    color: var(--foreground);
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6L8 10L12 6' stroke='%238b949e' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
  }

  .project-select:hover {
    border-color: var(--foreground-subtle);
  }

  .project-select:focus {
    outline: none;
    border-color: var(--accent-blue);
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--background);
    border: 1px solid var(--border-default);
    border-radius: 2px;
    color: var(--foreground-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .icon-btn:hover {
    background: var(--background-emphasis);
    color: var(--foreground);
    border-color: var(--foreground-subtle);
  }

  .view-nav {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .nav-group {
    display: flex;
    gap: 2px;
    padding: 3px;
    background: var(--background);
    border-radius: 6px;
  }

  .nav-link {
    padding: 5px 10px;
    font-size: 13px;
    font-weight: 500;
    color: var(--foreground-muted);
    text-decoration: none;
    border-radius: 4px;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .nav-link:hover {
    color: var(--foreground);
  }

  .nav-link.active {
    background: rgba(156, 220, 254, 0.2);
    color: var(--state-implemented);
  }

  .view-nav > .nav-link {
    padding: 8px 10px;
    background: var(--background);
    border-radius: 6px;
  }

  .view-nav > .nav-link:hover {
    background: var(--background-emphasis);
  }

  .view-nav > .nav-link.active {
    background: rgba(156, 220, 254, 0.2);
    color: var(--state-implemented);
  }

  .app-main {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .header-divider {
    width: 1px;
    height: 20px;
    background: var(--border-default);
    margin: 0 4px;
  }

  .docs-link {
    flex-shrink: 0;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 500;
    color: var(--foreground-muted);
    text-decoration: none;
    border-radius: 6px;
    transition: all 0.15s ease;
  }

  .docs-link:hover {
    color: var(--foreground);
    background: var(--background);
  }

  .search-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    height: 32px;
    min-width: 160px;
    margin-left: 12px;
    font-size: 13px;
    color: var(--foreground-muted);
    background: var(--background);
    border: 1px solid var(--border-default);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .search-btn:hover {
    color: var(--foreground);
    border-color: var(--foreground-subtle);
  }

  .search-label {
    flex: 1;
    font-weight: 500;
  }

  .search-kbd {
    padding: 2px 5px;
    font-size: 11px;
    font-family: var(--font-mono, monospace);
    background: var(--background-subtle);
    border: 1px solid var(--border-default);
    border-radius: 3px;
    color: var(--foreground-subtle);
  }

  .debug-select {
    padding: 4px 24px 4px 8px;
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

  .debug-select:focus {
    outline: none;
    border-color: var(--accent-blue);
  }

  .debug-select.active {
    background-color: #f59e0b;
    border-color: #f59e0b;
    color: black;
  }

  .panel-tab-bar {
    display: flex;
    width: 100%;
    gap: 2px;
    padding: 3px;
    background: var(--background);
    border-radius: 6px;
  }

  .terminal-tabs-scroll {
    display: flex;
    flex: 1;
    gap: 2px;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .terminal-tabs-scroll::-webkit-scrollbar {
    display: none;
  }

  .panel-tab {
    flex-shrink: 0;
    padding: 5px 10px;
    font-size: 13px;
    font-weight: 500;
    color: var(--foreground-muted);
    background: none;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .panel-tab:hover {
    color: var(--foreground);
  }

  .panel-tab.active {
    background: rgba(156, 220, 254, 0.2);
    color: var(--state-implemented);
  }

  .panel-tab.terminal-tab.needs-attention {
    background: rgba(210, 153, 34, 0.25);
    color: #e3b341;
  }

  .panel-tab.terminal-tab.needs-attention:not(.active) {
    animation: attention-pulse 2s ease-in-out infinite;
  }

  @keyframes attention-pulse {
    0%, 100% { background: rgba(210, 153, 34, 0.25); }
    50% { background: rgba(210, 153, 34, 0.4); }
  }

  .panel-tab.terminal-tab {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0;
    padding-left: 10px;
    padding-right: 4px;
  }

  .terminal-tab-label {
    padding: 5px 0;
    font-size: 13px;
    font-weight: 500;
    color: inherit;
    background: none;
    border: none;
    cursor: pointer;
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .terminal-tab-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 3px;
    color: var(--foreground-subtle);
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.1s ease, background 0.1s ease;
  }

  .terminal-tab:hover .terminal-tab-close,
  .terminal-tab.active .terminal-tab-close {
    opacity: 1;
  }

  .terminal-tab-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--foreground);
  }

  .add-terminal-btn {
    padding: 5px 8px;
  }

  .add-terminal-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

</style>
