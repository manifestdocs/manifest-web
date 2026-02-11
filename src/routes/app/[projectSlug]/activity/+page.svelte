<script lang="ts">
  import { getAuthApiContext } from '$lib/api/auth-context.js';
  import type { components } from '$lib/api/schema.js';
  import { HistoryList } from '$lib/components/history/index.js';
  import {
    findFeature,
    getDescendantIds,
  } from '$lib/components/features/featureTreeUtils.js';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { getProjectDataContext } from '$lib/contexts/types.js';

  const authApi = getAuthApiContext();

  type ProjectHistoryEntry = components['schemas']['ProjectHistoryEntry'];

  const ctx = getProjectDataContext();

  // Activity-specific state
  let historyEntries = $state<ProjectHistoryEntry[]>([]);
  let isLoadingHistory = $state(false);

  // Get selected feature node for filtering logic
  const selectedNode = $derived(
    ctx.selectedFeatureId
      ? findFeature(ctx.featureTree, ctx.selectedFeatureId)
      : null,
  );
  const selectedIsRoot = $derived(selectedNode?.is_root ?? false);
  const selectedIsGroup = $derived(
    selectedNode ? selectedNode.children.length > 0 : false,
  );

  // Filter history based on selected feature
  const filteredHistory = $derived.by(() => {
    if (!ctx.selectedFeatureId || !selectedNode || selectedIsRoot) {
      return historyEntries;
    }

    if (selectedIsGroup) {
      const descendantIds = getDescendantIds(selectedNode);
      descendantIds.add(ctx.selectedFeatureId);
      return historyEntries.filter((entry) =>
        descendantIds.has(entry.feature_id),
      );
    }

    return historyEntries.filter(
      (entry) => entry.feature_id === ctx.selectedFeatureId,
    );
  });

  // Load history when project changes
  $effect(() => {
    if (ctx.projectId && authApi.isReady()) {
      loadHistory(ctx.projectId);
    }
  });

  async function loadHistory(projectId: string) {
    isLoadingHistory = true;
    try {
      const api = await authApi.getClient();
      const { data, error } = await api.GET('/projects/{id}/history', {
        params: { path: { id: projectId }, query: { limit: 50 } },
      });
      if (error) {
        console.error('Failed to load history:', error);
        historyEntries = [];
        return;
      }
      historyEntries = data;
    } finally {
      isLoadingHistory = false;
    }
  }

  function handleFeatureClick(featureId: string) {
    goto(`/app/${ctx.projectSlug}?feature=${featureId}`);
  }
</script>

<HistoryList
  entries={filteredHistory}
  isLoading={isLoadingHistory}
  gitRemote={ctx.gitRemote}
  onFeatureClick={handleFeatureClick}
/>
