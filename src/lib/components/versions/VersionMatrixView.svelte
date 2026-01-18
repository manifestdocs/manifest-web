<script lang="ts">
	import type { components } from '$lib/api/schema.js';
	import MatrixRow from './MatrixRow.svelte';
	import CreateVersionDialog from './CreateVersionDialog.svelte';

	type FeatureTreeNode = components['schemas']['FeatureTreeNode'];
	type Version = components['schemas']['Version'];

	interface Props {
		features: FeatureTreeNode[];
		versions: Version[];
		selectedId: string | null;
		onSelect: (id: string) => void;
		onCreateVersion: (name: string, description: string | null) => Promise<void>;
	}

	let { features, versions, selectedId, onSelect, onCreateVersion }: Props = $props();

	let expandedIds = $state(new Set<string>());
	let showCreateDialog = $state(false);

	// Auto-expand parent features on initial load
	$effect(() => {
		if (features.length > 0 && expandedIds.size === 0) {
			const newExpanded = new Set<string>();
			function expandParents(nodes: FeatureTreeNode[]) {
				for (const node of nodes) {
					if (node.children && node.children.length > 0) {
						newExpanded.add(node.id);
						expandParents(node.children);
					}
				}
			}
			expandParents(features);
			expandedIds = newExpanded;
		}
	});

	function handleToggle(id: string) {
		const newExpanded = new Set(expandedIds);
		if (newExpanded.has(id)) {
			newExpanded.delete(id);
		} else {
			newExpanded.add(id);
		}
		expandedIds = newExpanded;
	}

	function expandAll() {
		const newExpanded = new Set<string>();
		function addAll(nodes: FeatureTreeNode[]) {
			for (const node of nodes) {
				if (node.children && node.children.length > 0) {
					newExpanded.add(node.id);
					addAll(node.children);
				}
			}
		}
		addAll(features);
		expandedIds = newExpanded;
	}

	function collapseAll() {
		expandedIds = new Set<string>();
	}

	// Grid columns: tree (flexible) + one per version (fixed) + unassigned (fixed)
	const gridColumns = $derived(
		`minmax(240px, 1fr) repeat(${versions.length}, 100px) 100px`
	);
</script>

<div class="matrix-container">
	<!-- Header row -->
	<div class="matrix-header" style="grid-template-columns: {gridColumns}">
		<div class="header-cell tree-header">
			<span class="header-title">Features</span>
			<div class="header-actions">
				<button class="action-btn" onclick={expandAll} title="Expand all" type="button">
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
						<path
							d="M4 6L8 10L12 6"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</button>
				<button class="action-btn" onclick={collapseAll} title="Collapse all" type="button">
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
						<path
							d="M4 10L8 6L12 10"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</button>
			</div>
		</div>

		{#each versions as version (version.id)}
			<div class="header-cell version-header">
				<span class="version-name" title={version.description || version.name}>v{version.name}</span>
			</div>
		{/each}

		<div class="header-cell version-header unassigned-header">
			<button class="add-version-btn" onclick={() => (showCreateDialog = true)} type="button">
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
					<path
						d="M8 3V13M3 8H13"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
					/>
				</svg>
				<span>Version</span>
			</button>
		</div>
	</div>

	<!-- Body with scrollable content -->
	<div class="matrix-body">
		<div class="matrix-grid" style="grid-template-columns: {gridColumns}">
			{#if features.length === 0}
				<div class="empty-state" style="grid-column: 1 / -1">No features yet</div>
			{:else}
				{#each features as feature (feature.id)}
					<MatrixRow
						{feature}
						{versions}
						{selectedId}
						{expandedIds}
						{onSelect}
						onToggle={handleToggle}
					/>
				{/each}
			{/if}
		</div>
	</div>
</div>

<CreateVersionDialog
	open={showCreateDialog}
	onOpenChange={(open) => (showCreateDialog = open)}
	onCreate={onCreateVersion}
/>

<style>
	.matrix-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		background: var(--background-subtle);
	}

	.matrix-header {
		display: grid;
		background: var(--background-subtle);
		border-bottom: 1px solid var(--border-default);
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.header-cell {
		display: flex;
		align-items: center;
		padding: 10px 12px;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--foreground-muted);
	}

	.tree-header {
		justify-content: space-between;
	}


	.header-actions {
		display: flex;
		gap: 4px;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--foreground-subtle);
		cursor: pointer;
		border-radius: 4px;
		transition: all 0.1s ease;
	}

	.action-btn:hover {
		background: var(--background-muted);
		color: var(--foreground);
	}

	.version-header {
		justify-content: center;
		border-left: 1px solid var(--border-default);
		text-transform: none;
		letter-spacing: normal;
	}

	.version-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 500;
		color: var(--foreground-subtle);
	}

	.unassigned-header {
		background: var(--background-muted);
	}

	.add-version-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px;
		font-size: 11px;
		font-weight: 500;
		text-transform: none;
		letter-spacing: normal;
		color: var(--foreground-subtle);
		background: transparent;
		border: 1px dashed var(--border-default);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.add-version-btn:hover {
		color: var(--foreground);
		border-color: var(--foreground-subtle);
		background: var(--background);
	}

	.matrix-body {
		flex: 1;
		overflow: auto;
	}

	.matrix-grid {
		display: grid;
		min-width: 100%;
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 48px 24px;
		color: var(--foreground-subtle);
		font-size: 13px;
	}
</style>
