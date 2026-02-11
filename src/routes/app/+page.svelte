<script lang="ts">
  import { goto } from '$app/navigation';
  import { WelcomeScreen } from '$lib/components/projects/index.js';
  import { debugEmptyState } from '$lib/stores/index.js';
  import { getProjectsContext } from '$lib/contexts/types.js';

  const projectsContext = getProjectsContext();

  // Check if we should show empty state due to debug mode
  const showNoProjectsState = $derived(
    debugEmptyState.value === 'no-projects' ||
      (!projectsContext.isLoading && projectsContext.projects.length === 0),
  );

  // Redirect to last viewed project (or first project) when projects are loaded
  $effect(() => {
    // Skip redirect if debug mode is forcing no-projects view
    if (debugEmptyState.value === 'no-projects') return;

    if (!projectsContext.isLoading && projectsContext.projects.length > 0) {
      const lastProjectKey =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem('manifest_last_project')
          : null;
      // Support both slug (new) and id (legacy) lookups for backwards compatibility
      const lastProject = lastProjectKey
        ? projectsContext.projects.find(
            (p) => p.slug === lastProjectKey || p.id === lastProjectKey,
          )
        : null;
      const targetProject = lastProject || projectsContext.projects[0];
      goto(`/app/${targetProject.slug}`, { replaceState: true });
    }
  });
</script>

{#if showNoProjectsState}
  <WelcomeScreen />
{:else if projectsContext.isLoading || projectsContext.projects.length > 0}
  <div class="loading-container">
    <div class="spinner"></div>
    <span>Loading projects...</span>
  </div>
{:else}
  <WelcomeScreen />
{/if}

<style>
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
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
</style>
