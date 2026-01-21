<script lang="ts">
	import { api, subscribeToProject } from '$lib/api/client.js';
	import type { components } from '$lib/api/schema.js';
	import { FeatureTree, FeatureDetail, CreateFeatureDialog } from '$lib/components/features/index.js';
	import { StateIcon } from '$lib/components/icons/index.js';
	import { EmptyProjectGuide } from '$lib/components/projects/index.js';
	import ResizeDivider from '$lib/components/ui/ResizeDivider.svelte';
	import { sidebarWidth } from '$lib/stores/index.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	type Feature = components['schemas']['Feature'];
	type FeatureTreeNode = components['schemas']['FeatureTreeNode'];
	type FeatureState = components['schemas']['FeatureState'];

	let featureTree = $state<FeatureTreeNode[]>([]);
	let selectedFeature = $state<Feature | null>(null);
	let isLoadingFeatures = $state(false);
	let isLoadingFeature = $state(false);

	// Create feature dialog state
	let createDialogOpen = $state(false);
	let createDialogParentId = $state<string | null>(null);

	const projectId = $derived(page.params.projectId);
	const selectedFeatureId = $derived(page.url.searchParams.get('feature'));

	// Check if selected feature is a group (has children)
	function findInTree(nodes: FeatureTreeNode[], id: string): FeatureTreeNode | null {
		for (const node of nodes) {
			if (node.id === id) return node;
			const found = findInTree(node.children, id);
			if (found) return found;
		}
		return null;
	}

	const selectedFeatureIsGroup = $derived.by(() => {
		if (!selectedFeatureId) return false;
		const node = findInTree(featureTree, selectedFeatureId);
		return node ? node.children.length > 0 : false;
	});

	// Get parent feature title for dialog
	const createDialogParentTitle = $derived.by(() => {
		if (!createDialogParentId) return null;
		const node = findInTree(featureTree, createDialogParentId);
		return node?.title ?? null;
	});

	// Check if the project is empty (no features)
	const isProjectEmpty = $derived(!isLoadingFeatures && featureTree.length === 0);

	// Load features when project changes
	$effect(() => {
		if (projectId) {
			loadFeatureTree(projectId);
		}
	});

	// Subscribe to SSE for real-time updates from other clients/agents
	$effect(() => {
		if (!projectId) return;

		const source = subscribeToProject(projectId);

		source.addEventListener('change', () => {
			// Refetch the feature tree when any feature changes
			loadFeatureTree(projectId);
		});

		source.onerror = () => {
			// SSE connection failed - that's okay, we'll just use manual refresh
			console.debug('SSE connection closed or failed');
		};

		return () => {
			source.close();
		};
	});

	// Load feature details when selection changes
	$effect(() => {
		if (selectedFeatureId) {
			loadFeature(selectedFeatureId);
		} else {
			selectedFeature = null;
		}
	});

	async function loadFeatureTree(projectId: string) {
		isLoadingFeatures = true;
		try {
			const { data, error } = await api.GET('/projects/{id}/features/tree', {
				params: { path: { id: projectId } }
			});
			if (error) {
				console.error('Failed to load features:', error);
				featureTree = [];
				return;
			}
			featureTree = data;

			// Auto-select first feature if none selected
			if (!selectedFeatureId && data.length > 0) {
				goto(`/app/${projectId}?feature=${data[0].id}`, { replaceState: true });
			}
		} finally {
			isLoadingFeatures = false;
		}
	}

	async function loadFeature(featureId: string) {
		isLoadingFeature = true;
		try {
			const { data, error } = await api.GET('/features/{id}', {
				params: { path: { id: featureId } }
			});
			if (error || !data) {
				console.error('Failed to load feature:', error);
				selectedFeature = null;
				return;
			}
			selectedFeature = data;
		} finally {
			isLoadingFeature = false;
		}
	}

	async function handleSaveFeature(
		id: string,
		updates: { title?: string; details?: string | null; desired_details?: string | null; state?: FeatureState }
	) {
		const { data, error } = await api.PUT('/features/{id}', {
			params: { path: { id } },
			body: updates
		});
		if (error || !data) {
			console.error('Failed to save feature:', error);
			throw new Error('Failed to save');
		}
		// Update local state
		selectedFeature = data;

		// Refresh the tree to get updated data
		if (projectId) {
			await loadFeatureTree(projectId);
		}
	}

	function handleSelectFeature(id: string) {
		goto(`/app/${projectId}?feature=${id}`);
	}

	function handleResize(deltaX: number) {
		sidebarWidth.resize(deltaX);
	}

	function handleOpenCreateDialog(parentId: string | null) {
		createDialogParentId = parentId;
		createDialogOpen = true;
	}

	async function handleCreateFeature(title: string, details: string | null) {
		if (!projectId) return;

		const { data, error } = await api.POST('/projects/{id}/features', {
			params: { path: { id: projectId } },
			body: {
				title,
				details,
				parent_id: createDialogParentId
			}
		});

		if (error || !data) {
			console.error('Failed to create feature:', error);
			throw new Error('Failed to create feature');
		}

		// Refresh tree and select the new feature
		await loadFeatureTree(projectId);
		goto(`/app/${projectId}?feature=${data.id}`);
	}

	async function handleReparentFeature(featureId: string, newParentId: string | null) {
		const { error } = await api.PUT('/features/{id}', {
			params: { path: { id: featureId } },
			body: { parent_id: newParentId }
		});

		if (error) {
			console.error('Failed to reparent feature:', error);
			return;
		}

		// Refresh the tree
		if (projectId) {
			await loadFeatureTree(projectId);
		}
	}
</script>

<div class="page-container">
	<div class="page-content">
		<aside class="sidebar" style="width: {sidebarWidth.value}px">
			{#if isLoadingFeatures && featureTree.length === 0}
				<div class="loading-state">Loading features...</div>
			{:else}
				<FeatureTree features={featureTree} selectedId={selectedFeatureId} projectId={projectId!} featureColumnWidth={sidebarWidth.value} onSelect={handleSelectFeature} onAddFeature={handleOpenCreateDialog} onReparent={handleReparentFeature} />
			{/if}
		</aside>

		<ResizeDivider onResize={handleResize} />

		<section class="content">
			{#if isProjectEmpty}
				<EmptyProjectGuide onCreateFeature={() => handleOpenCreateDialog(null)} />
			{:else if isLoadingFeature}
				<div class="loading-state">Loading...</div>
			{:else}
				<FeatureDetail feature={selectedFeature} isGroup={selectedFeatureIsGroup} onSave={handleSaveFeature} />
			{/if}
		</section>
	</div>

	<div class="page-legend">
		<div class="legend-item">
			<StateIcon state="proposed" size={12} />
			<span>Proposed</span>
		</div>
		<div class="legend-item">
			<StateIcon state="in_progress" size={12} />
			<span>In Progress</span>
		</div>
		<div class="legend-item">
			<StateIcon state="implemented" size={12} />
			<span>Implemented</span>
		</div>
	</div>
</div>

<CreateFeatureDialog
	open={createDialogOpen}
	onOpenChange={(open) => (createDialogOpen = open)}
	onCreate={handleCreateFeature}
	parentTitle={createDialogParentTitle}
/>

<style>
	.page-container {
		display: flex;
		flex-direction: column;
		flex: 1;
		overflow: hidden;
	}

	.page-content {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.sidebar {
		background: var(--background);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		flex-shrink: 0;
		height: 100%;
	}

	.content {
		flex: 1;
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

	.page-legend {
		display: flex;
		gap: 16px;
		padding: 8px 12px;
		border-top: 1px solid var(--border-default);
		background: var(--background-subtle);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		color: var(--foreground-subtle);
	}
</style>
