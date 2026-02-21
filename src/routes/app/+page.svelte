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

  // Redirect to last project when in project mode
  $effect(() => {
    if (viewMode.value !== 'project') return;
    if (debugEmptyState.value === 'no-projects') return;
    if (!projectsContext.isLoading && projectsContext.projects.length > 0) {
      const lastKey =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem('manifest_last_project')
          : null;
      const lastProject = lastKey
        ? projectsContext.projects.find((p) => p.slug === lastKey || p.id === lastKey)
        : null;
      const target = lastProject || projectsContext.projects[0];
      goto(`/app/${target.slug}`, { replaceState: true });
    }
  });

  // Portfolio data
  let portfolio = $state<Portfolio | null>(null);
  let loadError = $state(false);

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
    viewMode.set('project');
    goto(`/app/${slug}`);
  }

  function handleFeatureClick(slug: string, featureId: string) {
    viewMode.set('project');
    goto(`/app/${slug}?feature=${featureId}`);
  }

  function handleBlockerClick(slug: string) {
    viewMode.set('project');
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
      <div class="lanes">
        {#each portfolio.projects as project (project.id)}
          <ProjectLane
            {project}
            onProjectClick={handleProjectClick}
            onFeatureClick={handleFeatureClick}
            onBlockerClick={handleBlockerClick}
          />
        {/each}
        <div class="new-lane-placeholder">
          <!-- New project affordance is in the header (+) button -->
        </div>
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
  .lanes {
    display: grid;
    grid-auto-columns: 280px;
    grid-auto-flow: column;
    height: 100%;
    overflow-x: auto;
    background: var(--background);
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
</style>
