<script lang="ts">
  import { FeatureDetail } from '$lib/components/features/index.js';
  import { EmptyProjectGuide } from '$lib/components/projects/index.js';
  import { getProjectDataContext } from '$lib/contexts/types.js';

  const ctx = getProjectDataContext();
</script>

{#if ctx.isProjectEmpty}
  <EmptyProjectGuide
    onCreateFeature={() => ctx.handleOpenCreateDialog(null)}
  />
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
