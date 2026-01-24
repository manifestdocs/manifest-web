<script lang="ts">
	import { getAuthApiContext } from '$lib/api/auth-context.js';
	import type { components } from '$lib/api/schema.js';
	import { HistoryList } from '$lib/components/history/index.js';
	import { ActivityNav } from '$lib/components/activity/index.js';
	import { findFeature, getDescendantIds } from '$lib/components/features/featureTreeUtils.js';
	import { sidebarWidth } from '$lib/stores/index.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { getContext } from 'svelte';

	// Get authenticated API client from context
	const authApi = getAuthApiContext();

	type Project = components['schemas']['Project'];
	type ProjectHistoryEntry = components['schemas']['ProjectHistoryEntry'];
	type FeatureTreeNode = components['schemas']['FeatureTreeNode'];

	interface ProjectsContext {
		readonly projects: Project[];
		readonly isLoading: boolean;
		refresh: () => Promise<void>;
	}

	const projectsContext = getContext<ProjectsContext>('projects');

	let historyEntries = $state<ProjectHistoryEntry[]>([]);
	let featureTree = $state<FeatureTreeNode[]>([]);
	let isLoadingHistory = $state(false);
	let isLoadingFeatures = $state(false);
	let gitRemote = $state<string | undefined>(undefined);

	const projectSlug = $derived(page.params.projectSlug);
	const project = $derived(projectsContext.projects.find((p) => p.slug === projectSlug));
	const projectId = $derived(project?.id);
	const selectedFeatureId = $derived(page.url.searchParams.get('feature'));

	// Get selected feature node for filtering logic
	const selectedNode = $derived(
		selectedFeatureId ? findFeature(featureTree, selectedFeatureId) : null
	);
	const selectedIsRoot = $derived(selectedNode?.is_root ?? false);
	const selectedIsGroup = $derived(selectedNode ? selectedNode.children.length > 0 : false);

	// Filter history based on selected feature
	const filteredHistory = $derived.by(() => {
		// No selection or root feature → show all history
		if (!selectedFeatureId || !selectedNode || selectedIsRoot) {
			return historyEntries;
		}

		// Group feature → filter by feature + all descendants
		if (selectedIsGroup) {
			const descendantIds = getDescendantIds(selectedNode);
			descendantIds.add(selectedFeatureId);
			return historyEntries.filter((entry) => descendantIds.has(entry.feature_id));
		}

		// Leaf feature → filter by that feature only
		return historyEntries.filter((entry) => entry.feature_id === selectedFeatureId);
	});

	// Load history, feature tree, and git remote when project changes and auth is ready
	$effect(() => {
		if (projectId && authApi.isReady()) {
			loadHistory(projectId);
			loadFeatureTree(projectId);
			loadGitRemote(projectId);
		}
	});

	async function loadHistory(projectId: string) {
		isLoadingHistory = true;
		try {
			const api = await authApi.getClient();
			const { data, error } = await api.GET('/projects/{id}/history', {
				params: { path: { id: projectId }, query: { limit: 50 } }
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

	async function loadFeatureTree(projectId: string) {
		isLoadingFeatures = true;
		try {
			const api = await authApi.getClient();
			const { data, error } = await api.GET('/projects/{id}/features/tree', {
				params: { path: { id: projectId } }
			});
			if (error || !data) {
				console.error('Failed to load features:', error);
				featureTree = [];
				return;
			}
			featureTree = data;
		} finally {
			isLoadingFeatures = false;
		}
	}

	async function loadGitRemote(projectId: string) {
		const api = await authApi.getClient();
		const { data, error } = await api.GET('/projects/{id}/directories', {
			params: { path: { id: projectId } }
		});
		if (error || !data) {
			gitRemote = undefined;
			return;
		}
		// Use git_remote from primary directory, or first directory with git_remote
		const primary = data.find((d) => d.is_primary);
		gitRemote = primary?.git_remote ?? data.find((d) => d.git_remote)?.git_remote ?? undefined;
	}

	function handleSelectFeature(id: string | null) {
		// null means "All Activity" - clear the filter
		if (id === null || id === selectedFeatureId) {
			goto(`/app/${projectSlug}/activity`, { replaceState: true });
		} else {
			goto(`/app/${projectSlug}/activity?feature=${id}`, { replaceState: true });
		}
	}

	function handleFeatureClick(featureId: string) {
		// Navigate to tree view with feature selected
		goto(`/app/${projectSlug}?feature=${featureId}`);
	}
</script>

<div class="page-container">
	<aside class="sidebar">
		{#if isLoadingFeatures && featureTree.length === 0}
			<div class="loading-state">Loading features...</div>
		{:else}
			<ActivityNav
				features={featureTree}
				projectTitle={project?.name ?? ''}
				selectedId={selectedFeatureId}
				width={sidebarWidth.value}
				onSelect={handleSelectFeature}
			/>
		{/if}
	</aside>

	<section class="content">
		<HistoryList
			entries={filteredHistory}
			isLoading={isLoadingHistory}
			{gitRemote}
			onFeatureClick={handleFeatureClick}
		/>
	</section>
</div>

<style>
	.page-container {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.sidebar {
		flex-shrink: 0;
		min-height: 0;
		overflow: hidden;
	}

	.content {
		flex: 1;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		background: var(--background);
	}

	.loading-state {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--foreground-subtle);
		font-size: 14px;
	}
</style>
