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
  import { sidebarWidth, rightSidebarWidth } from '$lib/stores/index.js';

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
    featureId?: string;
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
  let terminalTabsScrollRef = $state<HTMLDivElement | null>(null);
  let attentionTabIds = $state<Set<string>>(new Set());

  function createTerminalTab(opts?: { label?: string; initialInput?: string; featureId?: string }) {
    if (terminalTabs.length >= MAX_TERMINAL_TABS) return;

    const tab: TerminalTab = {
      id: crypto.randomUUID(),
      label: opts?.label ?? `Terminal ${nextTerminalNumber}`,
      initialInput: opts?.initialInput,
      featureId: opts?.featureId,
    };
    nextTerminalNumber++;

    terminalTabs = [...terminalTabs, tab];
    activeTerminalTabId = tab.id;

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
    // Clear attention when tab is selected
    if (attentionTabIds.has(tabId)) {
      attentionTabIds = new Set([...attentionTabIds].filter(id => id !== tabId));
    }
  }

  function markTerminalAttention(tabId: string) {
    // Only mark attention if tab is not currently active
    const isActiveAndVisible = activeTerminalTabId === tabId;
    if (!isActiveAndVisible && !attentionTabIds.has(tabId)) {
      attentionTabIds = new Set([...attentionTabIds, tabId]);
    }
  }

  setContext('rightPanel', {
    get terminalTabs() { return terminalTabs; },
    get activeTerminalTabId() { return activeTerminalTabId; },
    resetTerminals() {
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
      <a href="/" class="logo">
        <img src={headerLogotype} alt="Manifest" class="logo-image" />
      </a>
      <!-- Row 1: Toolbar -->
      <div class="header-toolbar">
        <div class="header-left"></div>
        <div class="toolbar-fill"></div>
        <div class="project-controls">
            <select
              class="project-select"
              value={selectedProjectSlug}
              onchange={handleProjectChange}
              disabled={isLoadingProjects}
              aria-label="Select project"
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
              aria-label="Settings"
            >
              <SettingsIcon size={16} />
            </button>
            <button
              class="icon-btn"
              onclick={() => (newProjectWizardOpen = true)}
              title="New project"
              aria-label="New project"
            >
              <PlusIcon size={16} />
            </button>
        </div>
      </div>

      <!-- Row 2: Tab strips aligned to columns below -->
      <div class="header-tabs">
        <div class="tab-spacer" style="width: {sidebarWidth.value}px"></div>
        <nav class="tab-strip">
          <a
            href="{base}/app/{selectedProjectSlug}{featureQueryParam}"
            class="header-tab"
            class:active={page.url.pathname === `/app/${selectedProjectSlug}`}
          >
            Edit
          </a>
          <a
            href="{base}/app/{selectedProjectSlug}/versions{featureQueryParam}"
            class="header-tab"
            class:active={page.url.pathname ===
              `/app/${selectedProjectSlug}/versions`}
          >
            Plan
          </a>
          <a
            href="{base}/app/{selectedProjectSlug}/activity"
            class="header-tab"
            class:active={page.url.pathname ===
              `/app/${selectedProjectSlug}/activity`}
          >
            Activity
          </a>
        </nav>
        <div class="tab-strip-fill"></div>
        <div class="tab-strip-right" style="width: {rightSidebarWidth.value}px">
          <div class="terminal-tabs-scroll" bind:this={terminalTabsScrollRef}>
            {#each terminalTabs as tab (tab.id)}
              <div
                class="terminal-tab"
                class:active={activeTerminalTabId === tab.id}
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
                  aria-label="Close terminal"
                >
                  <CloseIcon size={10} />
                </button>
              </div>
            {/each}
            <button
              class="add-terminal-btn"
              onclick={() => createTerminalTab()}
              disabled={terminalTabs.length >= MAX_TERMINAL_TABS}
              title="New terminal (Cmd+`)"
              aria-label="New terminal"
            >
              <PlusIcon size={12} />
            </button>
          </div>
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

  /* --- Header: two-row column layout --- */

  .app-header {
    display: flex;
    flex-direction: column;
    position: relative;
    background: var(--background-subtle);
    border-bottom: 1px solid var(--border-default);
  }

  /* Row 1: Toolbar */

  .header-toolbar {
    display: flex;
    align-items: center;
    padding: 0 0 4px 16px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .toolbar-fill {
    flex: 1;
  }

  .project-controls {
    display: flex;
    align-items: center;
    gap: 0;
  }

  /* Row 2: Tab strips */

  .header-tabs {
    display: flex;
    align-items: flex-end;
    position: relative;
    z-index: 1;
    margin-bottom: -1px;
  }

  .tab-spacer {
    flex-shrink: 0;
  }

  .tab-strip {
    display: flex;
  }

  .tab-strip .header-tab:first-child {
    border-left: 1px solid var(--border-default);
  }

  .tab-strip-fill {
    flex: 1;
  }

  .tab-strip-right {
    display: flex;
    align-items: flex-end;
    flex-shrink: 0;
    border-left: none;
    padding-left: 0;
  }

  /* --- Tabs --- */

  .header-tab {
    padding: 6px 20px;
    font-size: 13px;
    font-weight: 500;
    color: var(--foreground-muted);
    background: transparent;
    border: 1px solid var(--border-default);
    border-left: none;
    border-bottom: none;
    border-radius: 0;
    text-decoration: none;
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .header-tab:hover {
    color: var(--foreground);
    background: var(--background-emphasis);
  }

  .header-tab.active {
    background: var(--background);
    color: var(--state-implemented);
    border-top: 1px solid var(--state-implemented);
    border-right: 1px solid var(--border-default);
    border-bottom: 1px solid var(--background);
    border-left: 1px solid var(--border-default);
  }

  /* --- Terminal tabs --- */

  .terminal-tab {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: 2px;
    padding: 6px 4px 6px 12px;
    font-size: 13px;
    font-weight: 500;
    color: var(--foreground-muted);
    background: transparent;
    border: 1px solid var(--border-default);
    border-left: none;
    border-bottom: none;
    border-radius: 0;
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .terminal-tab:first-child {
    border-left: 1px solid var(--border-default);
  }

  .terminal-tab:hover {
    color: var(--foreground);
    background: var(--background-emphasis);
  }

  .terminal-tab.active {
    background: var(--background);
    color: var(--state-implemented);
    border-top: 1px solid var(--state-implemented);
    border-right: 1px solid var(--border-default);
    border-bottom: 1px solid var(--background);
    border-left: 1px solid var(--border-default);
  }

  .terminal-tab.needs-attention {
    background: rgba(210, 153, 34, 0.25);
    color: #e3b341;
  }

  .terminal-tab.needs-attention:not(.active) {
    animation: attention-pulse 2s ease-in-out infinite;
  }

  @keyframes attention-pulse {
    0%, 100% { background: rgba(210, 153, 34, 0.25); }
    50% { background: rgba(210, 153, 34, 0.4); }
  }

  .terminal-tabs-scroll {
    display: flex;
    flex: 1;
    gap: 0;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .terminal-tabs-scroll::-webkit-scrollbar {
    display: none;
  }

  .terminal-tab-label {
    padding: 0;
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
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 10px;
    font-size: 13px;
    color: var(--foreground-muted);
    background: transparent;
    border: 1px solid var(--border-default);
    border-left: none;
    border-bottom: none;
    border-radius: 0;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .add-terminal-btn:hover {
    color: var(--foreground);
    background: var(--background-emphasis);
  }

  .add-terminal-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  /* --- Shared elements --- */

  .logo {
    position: absolute;
    left: 11px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    text-decoration: none;
    transition: opacity 0.15s ease;
    z-index: 2;
  }

  .logo:hover {
    opacity: 0.8;
  }

  .logo-image {
    height: 36px;
    width: auto;
  }

  .project-select {
    padding: 5px 26px 5px 10px;
    font-size: 13px;
    font-weight: 500;
    background: var(--background);
    border: 1px solid var(--border-default);
    border-top: none;
    border-radius: 0;
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
    border-top: none;
    border-left: none;
    border-radius: 0;
    color: var(--foreground-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .icon-btn:hover {
    background: var(--background-emphasis);
    color: var(--foreground);
    border-color: var(--foreground-subtle);
  }

  .search-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    height: 32px;
    min-width: 160px;
    margin-left: 0;
    font-size: 13px;
    color: var(--foreground-muted);
    background: var(--background);
    border: 1px solid var(--border-default);
    border-radius: 0;
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

  .app-main {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

</style>
