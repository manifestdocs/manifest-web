<script lang="ts">
  import { goto } from '$app/navigation';
  import { api, API_BASE_URL } from '$lib/api/client.js';
  import type { components } from '$lib/api/schema.js';
  import { WelcomeScreen, ProjectLane } from '$lib/components/projects/index.js';
  import { debugEmptyState, viewMode } from '$lib/stores/index.js';
  import { getProjectsContext } from '$lib/contexts/types.js';

  type Portfolio = components['schemas']['Portfolio'];

  const projectsContext = getProjectsContext();

  const showNoProjectsState = $derived(
    debugEmptyState.value === 'no-projects' ||
      (!projectsContext.isLoading && projectsContext.projects.length === 0),
  );


  // Portfolio data
  let portfolio = $state<Portfolio | null>(null);
  let loadError = $state(false);

  // Hidden projects (persisted in localStorage)
  const HIDDEN_KEY = 'manifest_hidden_projects';
  let hiddenProjectIds = $state<Set<string>>(
    new Set(
      typeof localStorage !== 'undefined'
        ? JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]')
        : [],
    ),
  );

  function hideProject(id: string) {
    hiddenProjectIds = new Set([...hiddenProjectIds, id]);
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hiddenProjectIds]));
  }

  const visibleProjects = $derived(
    portfolio ? portfolio.projects.filter((p) => !hiddenProjectIds.has(p.id)) : [],
  );

  const hiddenProjects = $derived(
    portfolio ? portfolio.projects.filter((p) => hiddenProjectIds.has(p.id)) : [],
  );

  let showHiddenPanel = $state(false);

  function unhideProject(id: string) {
    const next = new Set(hiddenProjectIds);
    next.delete(id);
    hiddenProjectIds = next;
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hiddenProjectIds]));
  }

  async function loadPortfolio() {
    const { data, error } = await api.GET('/portfolio');
    if (error || !data) {
      loadError = true;
      return;
    }
    portfolio = data;
    loadError = false;
  }

  // Subscribe to portfolio SSE events for live updates
  $effect(() => {
    if (viewMode.value !== 'portfolio') return;

    loadPortfolio();

    const es = new EventSource(`${API_BASE_URL}/portfolio/events`);
    es.addEventListener('change', () => loadPortfolio());
    es.onerror = () => {
      // SSE dropped — silently retry on next change event or page refresh
    };

    return () => es.close();
  });

  function handleProjectClick(slug: string) {
    goto(`/app/${slug}`);
  }

  function handleFeatureClick(slug: string, featureId: string) {
    goto(`/app/${slug}?feature=${featureId}`);
  }

  function handleBlockerClick(slug: string) {
    goto(`/app/${slug}?filter=blocked`);
  }
</script>

{#if showNoProjectsState}
  <WelcomeScreen />
{:else if viewMode.value === 'portfolio'}
  {#if portfolio}
    {#if portfolio.projects.length === 0}
      <WelcomeScreen />
    {:else}
      <div class="portfolio-container">
        <div class="lanes">
          {#each visibleProjects as project (project.id)}
            <ProjectLane
              {project}
              onProjectClick={handleProjectClick}
              onFeatureClick={handleFeatureClick}
              onBlockerClick={handleBlockerClick}
              onClose={hideProject}
            />
          {/each}
          <div class="new-lane-placeholder">
            <!-- New project affordance is in the header (+) button -->
          </div>
        </div>
        {#if hiddenProjects.length > 0}
          <div class="hidden-bar">
            <button class="hidden-toggle" onclick={() => showHiddenPanel = !showHiddenPanel}>
              {showHiddenPanel ? 'Hide' : 'Show'} hidden ({hiddenProjects.length})
            </button>
            {#if showHiddenPanel}
              <div class="hidden-list">
                {#each hiddenProjects as project (project.id)}
                  <div class="hidden-item">
                    <span class="hidden-name">{project.name}</span>
                    <button class="unhide-btn" onclick={() => unhideProject(project.id)}>Unhide</button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  {:else if loadError}
    <div class="load-error">
      <p>Could not load portfolio data.</p>
      <button onclick={loadPortfolio}>Retry</button>
    </div>
  {:else}
    <div class="loading-container">
      <div class="spinner"></div>
      <span>Loading projects...</span>
    </div>
  {/if}
{:else}
  <!-- project mode: redirect handled above -->
  <div class="loading-container">
    <div class="spinner"></div>
    <span>Loading projects...</span>
  </div>
{/if}

<style>
  .portfolio-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--background);
  }

  .lanes {
    display: grid;
    grid-auto-columns: 280px;
    grid-auto-flow: column;
    flex: 1;
    min-height: 0;
    overflow-x: auto;
  }

  .new-lane-placeholder {
    width: 280px;
    height: 100%;
    border-right: 1px solid var(--border-default);
    background: var(--background-subtle);
    opacity: 0.4;
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 16px;
    color: var(--foreground-subtle);
    background: var(--background);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-default);
    border-top-color: var(--accent-blue);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .load-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    color: var(--foreground-muted);
  }

  .load-error button {
    padding: 6px 16px;
    font-size: 13px;
    background: var(--background-emphasis);
    border: 1px solid var(--border-default);
    border-radius: 4px;
    color: var(--foreground);
    cursor: pointer;
  }

  .load-error button:hover {
    border-color: var(--foreground-subtle);
  }

  /* --- Hidden projects bar --- */

  .hidden-bar {
    flex-shrink: 0;
    border-top: 1px solid var(--border-default);
    background: var(--background-subtle);
    padding: 6px 14px;
  }

  .hidden-toggle {
    font-size: 12px;
    color: var(--foreground-subtle);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: color 0.1s ease;
  }

  .hidden-toggle:hover {
    color: var(--foreground);
  }

  .hidden-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }

  .hidden-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    font-size: 12px;
    background: var(--background);
    border: 1px solid var(--border-default);
    border-radius: 4px;
  }

  .hidden-name {
    color: var(--foreground-muted);
  }

  .unhide-btn {
    font-size: 11px;
    color: var(--accent-blue);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }

  .unhide-btn:hover {
    text-decoration: underline;
  }
</style>
