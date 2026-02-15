<script lang="ts">
  import { getAuthApiContext } from '$lib/api/auth-context.js';
  import type { components } from '$lib/api/schema.js';
  import { VersionMatrixView } from '$lib/components/versions/index.js';
  import { getProjectDataContext } from '$lib/contexts/types.js';

  const authApi = getAuthApiContext();

  type Version = components['schemas']['Version'];

  const ctx = getProjectDataContext();

  // Version-specific handlers (not shared since only plan view needs them)
  async function handleCreateVersion(name: string) {
    if (!ctx.projectId) return;

    const api = await authApi.getClient();
    const { error } = await api.POST('/projects/{id}/versions', {
      params: { path: { id: ctx.projectId } },
      body: { name },
    });
    if (error) {
      console.error('Failed to create version:', error);
      throw new Error('Failed to create version');
    }
    await ctx.loadVersions();
  }

  async function handleUpdateFeatureVersion(
    featureId: string,
    versionId: string | null,
  ) {
    if (!ctx.projectId) return;

    const api = await authApi.getClient();
    const { error } = await api.PUT('/features/{id}', {
      params: { path: { id: featureId } },
      body: { target_version_id: versionId },
    });
    if (error) {
      console.error('Failed to update feature version:', error);
      throw new Error('Failed to update feature version');
    }
    await ctx.loadFeatureTree();
  }

  async function handleCompleteVersion(versionId: string) {
    if (!ctx.projectId) return;

    const api = await authApi.getClient();
    const { error } = await api.PUT('/versions/{id}', {
      params: { path: { id: versionId } },
      body: { released_at: new Date().toISOString() },
    });
    if (error) {
      console.error('Failed to complete version:', error);
      throw new Error('Failed to complete version');
    }
    await Promise.all([ctx.loadVersions(), ctx.loadFeatureTree()]);
  }
</script>

{#if (ctx.isLoadingFeatures && ctx.featureTree.length === 0) || !ctx.projectId}
  <div class="loading-state">Loading...</div>
{:else}
  <VersionMatrixView
    features={ctx.featureTree}
    versions={ctx.versions}
    projectId={ctx.projectId}
    selectedId={ctx.selectedFeatureId}
    hoveredFeatureId={ctx.hoveredFeatureId}
    expandedIds={ctx.expandedIds}
    activeFilters={ctx.activeFilters}
    treeScrollTop={ctx.treeScrollTop}
    activeVersionId={ctx.activeVersionFilter?.versionId}
    onCreateVersion={handleCreateVersion}
    onUpdateFeatureVersion={handleUpdateFeatureVersion}
    onCompleteVersion={handleCompleteVersion}
    onScrollSync={ctx.handleScrollSync}
    onHoverFeature={ctx.handleHoverFeature}
    onVersionClick={ctx.handleExpandForVersion}
  />
{/if}

<style>
  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--foreground-subtle);
    font-size: 14px;
  }
</style>
