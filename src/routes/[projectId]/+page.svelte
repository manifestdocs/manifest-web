<script lang="ts">
	import { api } from '$lib/api/client.js';
	import type { components } from '$lib/api/schema.js';
	import { FeatureTree, FeatureDetail } from '$lib/components/features/index.js';
	import ResizeDivider from '$lib/components/ui/ResizeDivider.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	const MIN_SIDEBAR_WIDTH = 200;
	const MAX_SIDEBAR_WIDTH = 500;
	let sidebarWidth = $state(280);

	type Feature = components['schemas']['Feature'];
	type FeatureTreeNode = components['schemas']['FeatureTreeNode'];
	type FeatureState = components['schemas']['FeatureState'];

	let featureTree = $state<FeatureTreeNode[]>([]);
	let selectedFeature = $state<Feature | null>(null);
	let isLoadingFeatures = $state(false);
	let isLoadingFeature = $state(false);

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

	// Load features when project changes
	$effect(() => {
		if (projectId) {
			loadFeatureTree(projectId);
		}
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
				goto(`/${projectId}?feature=${data[0].id}`, { replaceState: true });
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
		updates: { title?: string; details?: string | null; state?: FeatureState }
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
		goto(`/${projectId}?feature=${id}`);
	}

	function handleResize(deltaX: number) {
		sidebarWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, sidebarWidth + deltaX));
	}
</script>

<aside class="sidebar" style="width: {sidebarWidth}px">
	{#if isLoadingFeatures}
		<div class="loading-state">Loading features...</div>
	{:else}
		<FeatureTree features={featureTree} selectedId={selectedFeatureId} onSelect={handleSelectFeature} />
	{/if}
</aside>

<ResizeDivider onResize={handleResize} />

<section class="content">
	{#if isLoadingFeature}
		<div class="loading-state">Loading...</div>
	{:else}
		<FeatureDetail feature={selectedFeature} isGroup={selectedFeatureIsGroup} onSave={handleSaveFeature} />
	{/if}
</section>

<style>
	.sidebar {
		background: var(--background);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		flex-shrink: 0;
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
</style>
