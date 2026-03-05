<script lang="ts">
  import { api, API_BASE_URL } from '$lib/api/client.js';
  import { setAuthApiContext } from '$lib/api/auth-context.js';
  import type { components } from '$lib/api/schema.js';
  import { goto, afterNavigate } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { setContext } from 'svelte';
  import logoSmall from '$lib/assets/manifest_logo_small.png';
  import {
    NewProjectWizard,
    ProjectSettingsDialog,
  } from '$lib/components/projects/index.js';
  import {
    SettingsIcon,
    PlusIcon,
    SearchIcon,
  } from '$lib/components/icons/index.js';
  import { CommandPalette } from '$lib/components/command-palette/index.js';
  import UpdateBanner from '$lib/components/ui/UpdateBanner.svelte';
  import ConnectionBanner from '$lib/components/ui/ConnectionBanner.svelte';
  import McpConfigBanner from '$lib/components/ui/McpConfigBanner.svelte';
  import ViewModeToggle from '$lib/components/ui/ViewModeToggle.svelte';
  import NotificationToggle from '$lib/components/ui/NotificationToggle.svelte';
  import TutorialOverlay from '$lib/components/ui/TutorialOverlay.svelte';
  import { sidebarWidth, viewMode, tutorial, type ViewMode } from '$lib/stores/index.js';
  import {
    setRightPanelContext,
    setProjectsContext,
  } from '$lib/contexts/types.js';

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
  let helpMenuOpen = $state(false);

  let defaultAgent = $state('claude');

  // Fetch settings (default_agent) from server on mount
  $effect(() => {
    fetch(`${API_BASE_URL}/settings`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.default_agent) defaultAgent = data.default_agent;
      })
      .catch(() => {}); // Keep fallbacks
  });

  setRightPanelContext({
    get defaultAgent() { return defaultAgent; },
  });

  // Navigate on mode switch: portfolio → /app, project → last project slug
  function navigateToMode(mode: ViewMode) {
    viewMode.set(mode);
    if (mode === 'portfolio') {
      goto('/app');
    } else {
      const lastSlug =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem('manifest_last_project')
          : null;
      const target = lastSlug
        ? projects.find((p) => p.slug === lastSlug)
        : null;
      const dest = target || projects[0];
      if (dest) goto(`/app/${dest.slug}`);
    }
  }

  // Global keyboard shortcuts
  function handleGlobalKeydown(e: KeyboardEvent) {
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
    if (
      (e.key === 'p' || e.key === 'P') &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey
    ) {
      e.preventDefault();
      navigateToMode(viewMode.value === 'portfolio' ? 'project' : 'portfolio');
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
  setProjectsContext({
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

  // First-run redirect: if on /app with no slug, no localStorage entry, and projects exist → go to first project
  let firstRunChecked = false;
  $effect(() => {
    if (firstRunChecked || isLoadingProjects || selectedProjectSlug) return;
    const lastSlug = typeof localStorage !== 'undefined' ? localStorage.getItem('manifest_last_project') : null;
    if (lastSlug) { firstRunChecked = true; return; } // returning user on portfolio — don't redirect
    if (projects.length > 0) {
      firstRunChecked = true;
      goto(`/app/${projects[0].slug}`, { replaceState: true });
    }
  });

  // Stale slug redirect: if slug doesn't match any loaded project → redirect to first project
  $effect(() => {
    if (isLoadingProjects || !selectedProjectSlug || projects.length === 0) return;
    if (!projects.find((p) => p.slug === selectedProjectSlug)) {
      localStorage.setItem('manifest_last_project', projects[0].slug);
      goto(`/app/${projects[0].slug}`, { replaceState: true });
    }
  });

  const isPortfolioMode = $derived(viewMode.value === 'portfolio' && !selectedProjectSlug);

  // Sync viewMode with the URL after each navigation so the toggle icon is always correct
  afterNavigate(() => {
    if (selectedProjectSlug) {
      viewMode.set('project');
    } else {
      viewMode.set('portfolio');
    }
  });
</script>

<svelte:document onkeydown={handleGlobalKeydown} />

<div class="app-layout">
  <header class="app-header" class:portfolio-mode={isPortfolioMode}>
    <a href="/" class="logo">
      <img src={logoSmall} alt="" class="logo-icon" />
      <span class="logo-text">MANIFEST</span>
    </a>

    {#if isPortfolioMode}
      <!-- Portfolio mode: minimal toolbar — logo (absolute) + toggle only -->
      <div class="header-toolbar portfolio-toolbar">
        <div class="toolbar-fill"></div>
        <div class="project-controls">
          <button
            class="icon-btn"
            onclick={() => (newProjectWizardOpen = true)}
            title="New project"
            aria-label="New project"
          >
            <PlusIcon size={16} />
          </button>
          <NotificationToggle />
          <div class="help-menu-anchor">
            <button
              class="icon-btn"
              onclick={() => (helpMenuOpen = !helpMenuOpen)}
              title="Help"
              aria-label="Help"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.5"/>
                <text x="8" y="11.5" text-anchor="middle" fill="currentColor" font-size="10" font-weight="600" font-family="system-ui">?</text>
              </svg>
            </button>
            {#if helpMenuOpen}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="help-menu-backdrop" onclick={() => (helpMenuOpen = false)}></div>
              <div class="help-menu">
                <a
                  href="https://manifestdocs.ai/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="help-menu-item"
                  onclick={() => (helpMenuOpen = false)}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M2.5 1.5h8l3 3v10h-11z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                    <line x1="5" y1="7" x2="11" y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                    <line x1="5" y1="9.5" x2="11" y2="9.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                    <line x1="5" y1="12" x2="9" y2="12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                  </svg>
                  <span>Documentation</span>
                </a>
                <button
                  class="help-menu-item"
                  onclick={() => { helpMenuOpen = false; if (isPortfolioMode) { tutorial.resetPortfolio(); } else { tutorial.resetProject(); } }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.3"/>
                    <path d="M5.5 6.5a2.5 2.5 0 0 1 4.5 1c0 1.5-2.5 1.5-2.5 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="7.5" cy="12" r="0.75" fill="currentColor"/>
                  </svg>
                  <span>Show Tutorial</span>
                </button>
              </div>
            {/if}
          </div>
          <ViewModeToggle onmode={navigateToMode} />
        </div>
      </div>
      <!-- Invisible tab placeholder — keeps header the same height as project mode -->
      <div class="header-tabs" aria-hidden="true">
        <span class="header-tab tab-height-placeholder">&nbsp;</span>
      </div>
    {:else}
      <!-- Project mode: full header -->
      <div class="header-toolbar">
        <button
          class="search-btn"
          onclick={() => (commandPaletteOpen = true)}
          title="Search features (T)"
          aria-label="Search features"
        >
          <SearchIcon size={14} />
          <span class="search-label">Search</span>
          <kbd class="search-kbd">T</kbd>
        </button>
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
          <NotificationToggle />
          <div class="help-menu-anchor">
            <button
              class="icon-btn"
              onclick={() => (helpMenuOpen = !helpMenuOpen)}
              title="Help"
              aria-label="Help"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.5"/>
                <text x="8" y="11.5" text-anchor="middle" fill="currentColor" font-size="10" font-weight="600" font-family="system-ui">?</text>
              </svg>
            </button>
            {#if helpMenuOpen}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="help-menu-backdrop" onclick={() => (helpMenuOpen = false)}></div>
              <div class="help-menu">
                <a
                  href="https://manifestdocs.ai/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="help-menu-item"
                  onclick={() => (helpMenuOpen = false)}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M2.5 1.5h8l3 3v10h-11z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                    <line x1="5" y1="7" x2="11" y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                    <line x1="5" y1="9.5" x2="11" y2="9.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                    <line x1="5" y1="12" x2="9" y2="12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                  </svg>
                  <span>Documentation</span>
                </a>
                <button
                  class="help-menu-item"
                  onclick={() => { helpMenuOpen = false; if (isPortfolioMode) { tutorial.resetPortfolio(); } else { tutorial.resetProject(); } }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.3"/>
                    <path d="M5.5 6.5a2.5 2.5 0 0 1 4.5 1c0 1.5-2.5 1.5-2.5 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="7.5" cy="12" r="0.75" fill="currentColor"/>
                  </svg>
                  <span>Show Tutorial</span>
                </button>
              </div>
            {/if}
          </div>
          <ViewModeToggle onmode={navigateToMode} />
        </div>
      </div>

      {#if selectedProjectSlug}
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
        </div>
      {/if}
    {/if}
  </header>

  <ConnectionBanner />
  <UpdateBanner />
  <McpConfigBanner />

  <main class="app-main">
    {@render children()}
  </main>
</div>

<NewProjectWizard
  open={newProjectWizardOpen}
  onOpenChange={(open) => (newProjectWizardOpen = open)}
  onCreated={loadProjects}
/>

{#if selectedProject}
  <ProjectSettingsDialog
    open={settingsDialogOpen}
    onOpenChange={(open) => { settingsDialogOpen = open; }}
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

{#if isPortfolioMode && !tutorial.portfolioCompleted && projects.length > 0}
  <TutorialOverlay mode="portfolio" onComplete={() => tutorial.completePortfolio()} />
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
    position: relative;
  }

  .portfolio-toolbar {
    padding-bottom: 4px;
  }

  .portfolio-toolbar .icon-btn:first-child {
    border-left: 1px solid var(--border-default);
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

  .tab-height-placeholder {
    visibility: hidden;
    pointer-events: none;
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

  /* --- Shared elements --- */

  .logo {
    position: absolute;
    left: 13px;
    top: 50%;
    transform: translateY(calc(-50% + 2px));
    display: flex;
    align-items: center;
    text-decoration: none;
    transition: opacity 0.15s ease;
    z-index: 2;
  }

  .logo:hover {
    opacity: 0.8;
  }

  .logo-icon {
    height: 50px;
    width: auto;
    margin-right: 10px;
    margin-top: -7px;
    border-radius: 4px;
  }

  .logo-text {
    font-family: 'Zalando Sans Expanded', sans-serif;
    font-size: 22px;
    font-weight: 200;
    letter-spacing: 0.12em;
    color: var(--foreground);
  }

  .project-select {
    padding: 5px 26px 6px 10px;
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
    outline: 1px solid var(--foreground-subtle);
    outline-offset: -1px;
    z-index: 1;
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
    outline: 1px solid var(--foreground-subtle);
    outline-offset: -1px;
    z-index: 1;
  }

  .help-menu-anchor {
    position: relative;
  }

  .help-menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .help-menu {
    position: absolute;
    top: 100%;
    right: 0;
    z-index: 100;
    margin-top: 4px;
    min-width: 180px;
    padding: 4px;
    background: var(--background);
    border: 1px solid var(--border-default);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }

  .help-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 10px;
    font-size: 13px;
    color: var(--foreground-muted);
    background: none;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.1s, color 0.1s;
  }

  .help-menu-item:hover {
    background: var(--background-muted);
    color: var(--foreground);
  }

  .search-btn {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 72px;
    background: var(--background);
    border: 1px solid var(--border-default);
    border-radius: 0;
    color: var(--foreground-muted);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .search-btn:hover {
    background: var(--background-emphasis);
    color: var(--foreground);
    border-color: var(--foreground-subtle);
  }

  .search-label {
    font-weight: 400;
  }

  .search-kbd {
    font-family: inherit;
    font-size: 11px;
    font-weight: 500;
    padding: 1px 5px;
    background: var(--background-subtle);
    border: 1px solid var(--border-default);
    border-radius: 3px;
    color: var(--foreground-muted);
    line-height: 1;
  }

  .app-main {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
</style>
