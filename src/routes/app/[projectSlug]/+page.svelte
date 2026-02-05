<script lang="ts">
  import type { components } from '$lib/api/schema.js';
  import { FeatureDetail } from '$lib/components/features/index.js';
  import { EmptyProjectGuide } from '$lib/components/projects/index.js';
  import { getContext } from 'svelte';

  type Feature = components['schemas']['Feature'];
  type FeatureTreeNode = components['schemas']['FeatureTreeNode'];
  type FeatureState = components['schemas']['FeatureState'];
  type Version = components['schemas']['Version'];

  interface ProjectDataContext {
    readonly featureTree: FeatureTreeNode[];
    readonly selectedFeature: Feature | null;
    readonly selectedFeatureId: string | null;
    readonly selectedFeatureIsGroup: boolean;
    readonly versions: Version[];
    readonly projectId: string | undefined;
    readonly projectSlug: string | undefined;
    readonly gitRemote: string | undefined;
    readonly isLoadingFeatures: boolean;
    readonly isLoadingFeature: boolean;
    readonly isProjectEmpty: boolean;
    readonly acFormat: 'checkbox' | 'gherkin' | undefined;
    handleSaveFeature: (
      id: string,
      updates: {
        title?: string;
        details?: string | null;
        desired_details?: string | null;
        state?: FeatureState;
      },
    ) => Promise<void>;
    handleVersionChange: (
      featureId: string,
      versionId: string | null,
    ) => Promise<void>;
    handleArchiveFromDetail: () => void;
    handleRestoreFromDetail: () => void;
    handleDeleteFromDetail: () => Promise<void>;
    handleOpenCreateDialog: (parentId: string | null) => void;
  }

  const ctx = getContext<ProjectDataContext>('projectData');
</script>

{#if ctx.isProjectEmpty}
  <EmptyProjectGuide onCreateFeature={() => ctx.handleOpenCreateDialog(null)} />
{:else if ctx.isLoadingFeature}
  <div class="loading-state">Loading...</div>
{:else}
  <FeatureDetail
    feature={ctx.selectedFeature}
    isGroup={ctx.selectedFeatureIsGroup}
    versions={ctx.versions}
    onSave={ctx.handleSaveFeature}
    onVersionChange={ctx.handleVersionChange}
    onArchive={ctx.handleArchiveFromDetail}
    onRestore={ctx.handleRestoreFromDetail}
    onDelete={ctx.handleDeleteFromDetail}
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
