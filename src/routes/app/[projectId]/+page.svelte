<script lang="ts">
	import { subscribeToProject } from '$lib/api/client.js';
	import { getAuthApiContext } from '$lib/api/auth-context.js';
	import type { components } from '$lib/api/schema.js';
	import { FeatureTree, FeatureDetail, CreateFeatureDialog, ArchiveFeatureDialog } from '$lib/components/features/index.js';
	import { StateIcon } from '$lib/components/icons/index.js';
	import { EmptyProjectGuide } from '$lib/components/projects/index.js';
	import ResizeDivider from '$lib/components/ui/ResizeDivider.svelte';
	import { sidebarWidth } from '$lib/stores/index.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	// Get authenticated API client from context
	const authApi = getAuthApiContext();

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

	// Archive feature dialog state
	let archiveDialogOpen = $state(false);
	let archiveTarget = $state<{
		id: string;
		title: string;
		isGroup: boolean;
		childCount: number;
		parentId: string | null;
	} | null>(null);

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

	const selectedFeatureChildCount = $derived.by(() => {
		if (!selectedFeatureId) return 0;
		const node = findInTree(featureTree, selectedFeatureId);
		return node ? node.children.length : 0;
	});

	const selectedFeatureParentId = $derived.by(() => {
		if (!selectedFeatureId) return null;
		const node = findInTree(featureTree, selectedFeatureId);
		return node?.parent_id ?? null;
	});

	// Get parent feature title for dialog
	const createDialogParentTitle = $derived.by(() => {
		if (!createDialogParentId) return null;
		const node = findInTree(featureTree, createDialogParentId);
		return node?.title ?? null;
	});

	// Check if the project is empty (no features)
	const isProjectEmpty = $derived(!isLoadingFeatures && featureTree.length === 0);

	// Load features when project changes and auth is ready
	$effect(() => {
		if (projectId && authApi.isReady()) {
			loadFeatureTree(projectId);
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
			// SSE connection failed - that's okay, we'll just use manual refresh
			console.debug('SSE connection closed or failed');
		};

		return () => {
			source.close();
		};
	});

	// Load feature details when selection changes and auth is ready
	$effect(() => {
		if (selectedFeatureId && authApi.isReady()) {
			loadFeature(selectedFeatureId);
		} else if (!selectedFeatureId) {
			selectedFeature = null;
		}
	});

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
			const api = await authApi.getClient();
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
		const api = await authApi.getClient();
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
		goto(`/app/${projectId}?feature=${data.id}`);
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

	async function handleCreateGroup(title: string, childIds: [string, string], parentId: string | null) {
		if (!projectId) return;

		const api = await authApi.getClient();

		// 1. Create new group feature
		const { data: newGroup, error: createError } = await api.POST('/projects/{id}/features', {
			params: { path: { id: projectId } },
			body: { title, parent_id: parentId }
		});

		if (createError || !newGroup) {
			console.error('Failed to create group:', createError);
			return;
		}

		// 2. Reparent both children to the new group
		const reparentResults = await Promise.all(
			childIds.map((childId) =>
				api.PUT('/features/{id}', {
					params: { path: { id: childId } },
					body: { parent_id: newGroup.id }
				})
			)
		);

		const hasError = reparentResults.some((r) => r.error);
		if (hasError) {
			console.error('Failed to reparent some features');
		}

		// 3. Refresh tree and select the new group
		await loadFeatureTree(projectId);
		goto(`/app/${projectId}?feature=${newGroup.id}`);
	}

	function handleOpenArchiveDialog(id: string, title: string, isGroup: boolean, childCount: number, parentId: string | null) {
		archiveTarget = { id, title, isGroup, childCount, parentId };
		archiveDialogOpen = true;
	}

	function handleArchiveFromDetail() {
		if (!selectedFeature) return;
		const node = findInTree(featureTree, selectedFeature.id);
		const isRoot = node?.is_root ?? false;
		if (isRoot) return;

		handleOpenArchiveDialog(
			selectedFeature.id,
			selectedFeature.title,
			selectedFeatureIsGroup,
			selectedFeatureChildCount,
			selectedFeatureParentId
		);
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

		await loadFeatureTree(projectId);
	}

	function handleRestoreFromDetail() {
		if (!selectedFeature) return;
		handleRestoreFeature(selectedFeature.id);
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

		await loadFeatureTree(projectId);

		if (selectedFeatureId === featureId) {
			goto(`/app/${projectId}`);
		}
	}

	function handleDeleteFromDetail() {
		if (!selectedFeature) return;
		handleDeleteFeature(selectedFeature.id);
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

		// Refresh and clear selection
		await loadFeatureTree(projectId);
		goto(`/app/${projectId}`);

		archiveTarget = null;
	}
</script>

<div class="page-container">
	<div class="page-content">
		<aside class="sidebar" style="width: {sidebarWidth.value}px">
			{#if isLoadingFeatures && featureTree.length === 0}
				<div class="loading-state">Loading features...</div>
			{:else}
				<FeatureTree features={featureTree} selectedId={selectedFeatureId} projectId={projectId!} featureColumnWidth={sidebarWidth.value} onSelect={handleSelectFeature} onAddFeature={handleOpenCreateDialog} onReparent={handleReparentFeature} onCreateGroup={handleCreateGroup} onArchiveFeature={handleOpenArchiveDialog} onRestoreFeature={handleRestoreFeature} onDeleteFeature={handleDeleteFeature} />
			{/if}
		</aside>

		<ResizeDivider onResize={handleResize} />

		<section class="content">
			{#if isProjectEmpty}
				<EmptyProjectGuide onCreateFeature={() => handleOpenCreateDialog(null)} />
			{:else if isLoadingFeature}
				<div class="loading-state">Loading...</div>
			{:else}
				<FeatureDetail feature={selectedFeature} isGroup={selectedFeatureIsGroup} onSave={handleSaveFeature} onArchive={handleArchiveFromDetail} onRestore={handleRestoreFromDetail} onDelete={handleDeleteFromDetail} />
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
