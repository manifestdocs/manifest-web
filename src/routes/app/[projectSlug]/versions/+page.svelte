<script lang="ts">
	import { subscribeToProject } from '$lib/api/client.js';
	import { getAuthApiContext } from '$lib/api/auth-context.js';
	import type { components } from '$lib/api/schema.js';
	import { VersionMatrixView } from '$lib/components/versions/index.js';
	import { CreateFeatureDialog, ArchiveFeatureDialog } from '$lib/components/features/index.js';
	import { sidebarWidth } from '$lib/stores/index.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { getContext } from 'svelte';

	// Get authenticated API client from context
	const authApi = getAuthApiContext();

	type Project = components['schemas']['Project'];
	type FeatureTreeNode = components['schemas']['FeatureTreeNode'];
	type Version = components['schemas']['Version'];

	interface ProjectsContext {
		readonly projects: Project[];
		readonly isLoading: boolean;
		refresh: () => Promise<void>;
	}

	const projectsContext = getContext<ProjectsContext>('projects');

	let featureTree = $state<FeatureTreeNode[]>([]);
	let versions = $state<Version[]>([]);
	let isLoadingFeatures = $state(false);
	let isLoadingVersions = $state(false);

	// Create feature dialog state
	let createDialogOpen = $state(false);
	let createDialogParentId = $state<string | null>(null);

	// Archive feature dialog state
	let archiveDialogOpen = $state(false);
	let archiveTarget = $state<{
		id: string;
		title: string;
		isGroup: boolean;
		childCount: number;
		parentId: string | null;
	} | null>(null);

	const projectSlug = $derived(page.params.projectSlug);
	const project = $derived(projectsContext.projects.find((p) => p.slug === projectSlug));
	const projectId = $derived(project?.id);
	const selectedFeatureId = $derived(page.url.searchParams.get('feature'));

	// Helper to find a feature in the tree
	function findInTree(nodes: FeatureTreeNode[], id: string): FeatureTreeNode | null {
		for (const node of nodes) {
			if (node.id === id) return node;
			const found = findInTree(node.children, id);
			if (found) return found;
		}
		return null;
	}

	// Get parent title for create dialog
	const createDialogParentTitle = $derived.by(() => {
		if (!createDialogParentId) return null;
		const node = findInTree(featureTree, createDialogParentId);
		return node?.title ?? null;
	});

	// Load features and versions when project changes and auth is ready
	$effect(() => {
		if (projectId && authApi.isReady()) {
			loadFeatureTree(projectId);
			loadVersions(projectId);
		}
	});

	// Subscribe to SSE for real-time updates from other clients/agents
	$effect(() => {
		if (!projectId || !authApi.isReady()) return;

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
			const api = await authApi.getClient();
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
			const api = await authApi.getClient();
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

	async function handleCreateVersion(name: string) {
		if (!projectId) return;

		const api = await authApi.getClient();
		const { error } = await api.POST('/projects/{id}/versions', {
			params: { path: { id: projectId } },
			body: { name }
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

		const api = await authApi.getClient();
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

		const api = await authApi.getClient();
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
		goto(`/app/${projectSlug}/versions?feature=${id}`);
	}

	async function handleReparentFeature(featureId: string, newParentId: string | null) {
		const api = await authApi.getClient();
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

	function handleOpenCreateDialog(parentId: string | null) {
		createDialogParentId = parentId;
		createDialogOpen = true;
	}

	async function handleCreateFeature(title: string, details: string | null) {
		if (!projectId) return;

		const api = await authApi.getClient();
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
		goto(`/app/${projectSlug}/versions?feature=${data.id}`);
	}

	function handleOpenArchiveDialog(id: string, title: string, isGroup: boolean, childCount: number, parentId: string | null) {
		archiveTarget = { id, title, isGroup, childCount, parentId };
		archiveDialogOpen = true;
	}

	async function handleArchiveFeature(moveChildrenToParent: boolean) {
		if (!archiveTarget || !projectId) return;

		const api = await authApi.getClient();
		const node = findInTree(featureTree, archiveTarget.id);

		if (moveChildrenToParent && archiveTarget.isGroup && node) {
			// Reparent children to grandparent first
			await Promise.all(
				node.children.map((child) =>
					api.PUT('/features/{id}', {
						params: { path: { id: child.id } },
						body: { parent_id: archiveTarget!.parentId }
					})
				)
			);
		} else if (archiveTarget.isGroup && node) {
			// Cascade: archive all descendants too
			const archiveDescendants = (n: FeatureTreeNode): Promise<unknown>[] => {
				const promises: Promise<unknown>[] = [];
				for (const child of n.children) {
					promises.push(
						api.PUT('/features/{id}', {
							params: { path: { id: child.id } },
							body: { state: 'archived' }
						})
					);
					promises.push(...archiveDescendants(child));
				}
				return promises;
			};
			await Promise.all(archiveDescendants(node));
		}

		// Archive the target feature itself
		const { error } = await api.PUT('/features/{id}', {
			params: { path: { id: archiveTarget.id } },
			body: { state: 'archived' }
		});

		if (error) {
			console.error('Failed to archive feature:', error);
			throw new Error('Failed to archive feature');
		}

		// Refresh tree
		await loadFeatureTree(projectId);

		// If archived feature was selected, clear selection
		if (selectedFeatureId === archiveTarget.id) {
			goto(`/app/${projectSlug}/versions`);
		}
	}

	async function handleRestoreFeature(featureId: string) {
		if (!projectId) return;

		const api = await authApi.getClient();
		const { error } = await api.PUT('/features/{id}', {
			params: { path: { id: featureId } },
			body: { state: 'proposed' }
		});

		if (error) {
			console.error('Failed to restore feature:', error);
			throw new Error('Failed to restore feature');
		}

		// Refresh tree
		await loadFeatureTree(projectId);
	}

	async function handleDeleteFeature(featureId: string) {
		if (!projectId) return;

		const api = await authApi.getClient();
		const { error } = await api.DELETE('/features/{id}', {
			params: { path: { id: featureId } }
		});

		if (error) {
			console.error('Failed to delete feature:', error);
			throw new Error('Failed to delete feature');
		}

		// Refresh tree
		await loadFeatureTree(projectId);

		// If deleted feature was selected, clear selection
		if (selectedFeatureId === featureId) {
			goto(`/app/${projectSlug}/versions`);
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
			onAddFeature={handleOpenCreateDialog}
			onArchiveFeature={handleOpenArchiveDialog}
			onRestoreFeature={handleRestoreFeature}
			onDeleteFeature={handleDeleteFeature}
		/>
	{/if}
</section>

<CreateFeatureDialog
	open={createDialogOpen}
	onOpenChange={(open) => (createDialogOpen = open)}
	onCreate={handleCreateFeature}
	parentTitle={createDialogParentTitle}
/>

{#if archiveTarget}
	<ArchiveFeatureDialog
		open={archiveDialogOpen}
		onOpenChange={(open) => {
			archiveDialogOpen = open;
			if (!open) archiveTarget = null;
		}}
		featureTitle={archiveTarget.title}
		isGroup={archiveTarget.isGroup}
		childCount={archiveTarget.childCount}
		onArchive={handleArchiveFeature}
	/>
{/if}

<style>
	.content-full {
		flex: 1;
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
