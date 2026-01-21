<script lang="ts">
	import { api, subscribeToProject } from '$lib/api/client.js';
	import type { components } from '$lib/api/schema.js';
	import { VersionMatrixView } from '$lib/components/versions/index.js';
	import { sidebarWidth } from '$lib/stores/index.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	type FeatureTreeNode = components['schemas']['FeatureTreeNode'];
	type Version = components['schemas']['Version'];

	let featureTree = $state<FeatureTreeNode[]>([]);
	let versions = $state<Version[]>([]);
	let isLoadingFeatures = $state(false);
	let isLoadingVersions = $state(false);

	const projectId = $derived(page.params.projectId);
	const selectedFeatureId = $derived(page.url.searchParams.get('feature'));

	// Load features and versions when project changes
	$effect(() => {
		if (projectId) {
			loadFeatureTree(projectId);
			loadVersions(projectId);
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
			console.debug('SSE connection closed or failed');
		};

		return () => {
			source.close();
		};
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
		} finally {
			isLoadingFeatures = false;
		}
	}

	async function loadVersions(projectId: string) {
		isLoadingVersions = true;
		try {
			const { data, error } = await api.GET('/projects/{id}/versions', {
				params: { path: { id: projectId } }
			});
			if (error) {
				console.error('Failed to load versions:', error);
				versions = [];
				return;
			}
			versions = data;
		} finally {
			isLoadingVersions = false;
		}
	}

	async function handleCreateVersion(name: string, description: string | null) {
		if (!projectId) return;

		const { error } = await api.POST('/projects/{id}/versions', {
			params: { path: { id: projectId } },
			body: { name, description }
		});
		if (error) {
			console.error('Failed to create version:', error);
			throw new Error('Failed to create version');
		}
		// Refresh versions list
		await loadVersions(projectId);
	}

	async function handleUpdateFeatureVersion(featureId: string, versionId: string | null) {
		if (!projectId) return;

		const { error } = await api.PUT('/features/{id}', {
			params: { path: { id: featureId } },
			body: { target_version_id: versionId }
		});
		if (error) {
			console.error('Failed to update feature version:', error);
			throw new Error('Failed to update feature version');
		}
		// Refresh feature tree
		await loadFeatureTree(projectId);
	}

	async function handleCompleteVersion(versionId: string) {
		if (!projectId) return;

		const { error } = await api.PUT('/versions/{id}', {
			params: { path: { id: versionId } },
			body: { released_at: new Date().toISOString() }
		});
		if (error) {
			console.error('Failed to complete version:', error);
			throw new Error('Failed to complete version');
		}
		// Refresh both versions and features
		await Promise.all([loadVersions(projectId), loadFeatureTree(projectId)]);
	}

	function handleSelectFeature(id: string) {
		goto(`/app/${projectId}/versions?feature=${id}`);
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

<section class="content-full">
	{#if (isLoadingFeatures && featureTree.length === 0) || (isLoadingVersions && versions.length === 0) || !projectId}
		<div class="loading-state">Loading...</div>
	{:else}
		<VersionMatrixView
			features={featureTree}
			{versions}
			selectedId={selectedFeatureId}
			{projectId}
			featureColumnWidth={sidebarWidth.value}
			onSelect={handleSelectFeature}
			onCreateVersion={handleCreateVersion}
			onUpdateFeatureVersion={handleUpdateFeatureVersion}
			onCompleteVersion={handleCompleteVersion}
			onResize={(delta) => sidebarWidth.resize(delta)}
			onReparent={handleReparentFeature}
		/>
	{/if}
</section>

<style>
	.content-full {
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
