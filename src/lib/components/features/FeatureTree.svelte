<script lang="ts">
	import type { components } from '$lib/api/schema.js';
	import FeatureTreeItem from './FeatureTreeItem.svelte';

	type FeatureTreeNode = components['schemas']['FeatureTreeNode'];

	interface Props {
		features: FeatureTreeNode[];
		selectedId: string | null;
		onSelect: (id: string) => void;
	}

	let { features, selectedId, onSelect }: Props = $props();

	let expandedIds = $state(new Set<string>());

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
</script>

<div class="feature-tree">
	<div class="tree-header">
		<span class="tree-title">Features</span>
		<div class="tree-actions">
			<button class="action-btn" onclick={expandAll} title="Expand all" type="button">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
					<path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</button>
			<button class="action-btn" onclick={collapseAll} title="Collapse all" type="button">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
					<path d="M4 10L8 6L12 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</button>
		</div>
	</div>

	<div class="tree-content">
		{#if features.length === 0}
			<div class="empty-state">No features yet</div>
		{:else}
			{#each features as feature (feature.id)}
				<FeatureTreeItem
					{feature}
					{selectedId}
					{expandedIds}
					{onSelect}
					onToggle={handleToggle}
				/>
			{/each}
		{/if}
	</div>
</div>

<style>
	.feature-tree {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	.tree-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 12px 8px;
		border-bottom: 1px solid var(--border-default);
	}

	.tree-title {
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--foreground-muted);
	}

	.tree-actions {
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

	.tree-content {
		flex: 1;
		overflow-y: auto;
		padding: 8px 4px;
	}

	.empty-state {
		padding: 24px 16px;
		text-align: center;
		color: var(--foreground-subtle);
		font-size: 13px;
	}
</style>
