<script lang="ts">
	import type { components } from '$lib/api/schema.js';
	import FeatureRow from './FeatureRow.svelte';
	import { StateIcon } from '$lib/components/icons/index.js';

	type FeatureTreeNode = components['schemas']['FeatureTreeNode'];

	interface Props {
		features: FeatureTreeNode[];
		selectedId: string | null;
		onSelect: (id: string) => void;
	}

	let { features, selectedId, onSelect }: Props = $props();

	let expandedIds = $state(new Set<string>());

	// Auto-expand all on load
	$effect(() => {
		if (features.length > 0 && expandedIds.size === 0) {
			const newExpanded = new Set<string>();
			function expandAll(nodes: FeatureTreeNode[]) {
				for (const node of nodes) {
					if (node.children && node.children.length > 0) {
						newExpanded.add(node.id);
						expandAll(node.children);
					}
				}
			}
			expandAll(features);
			expandedIds = newExpanded;
		}
	});

	// Flatten features with visibility based on expanded state
	type FlatFeature = {
		feature: FeatureTreeNode;
		depth: number;
	};

	function getVisibleFeatures(nodes: FeatureTreeNode[], depth = 0): FlatFeature[] {
		const result: FlatFeature[] = [];
		for (const node of nodes) {
			result.push({ feature: node, depth });
			if (node.children && node.children.length > 0 && expandedIds.has(node.id)) {
				result.push(...getVisibleFeatures(node.children, depth + 1));
			}
		}
		return result;
	}

	let visibleFeatures = $derived(getVisibleFeatures(features));

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
	<!-- Header row (matches matrix header) -->
	<div class="tree-header">
		<span class="tree-title">Features</span>
	</div>

	<!-- Subheader row (matches matrix subheader) -->
	<div class="tree-subheader">
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
		{#if visibleFeatures.length === 0}
			<div class="empty-state">No features yet</div>
		{:else}
			{#each visibleFeatures as { feature, depth } (feature.id)}
				{@const isLeaf = !feature.children || feature.children.length === 0}
				<div class="tree-row">
					<FeatureRow
						{feature}
						{depth}
						isSelected={selectedId === feature.id}
						isExpanded={expandedIds.has(feature.id)}
						showTrack={isLeaf && !!feature.target_version_id}
						{onSelect}
						onToggle={handleToggle}
					/>
				</div>
			{/each}
		{/if}
	</div>

	<div class="tree-legend">
		<div class="legend-item">
			<StateIcon state="proposed" size={12} />
			<span>Proposed</span>
		</div>
		<div class="legend-item">
			<StateIcon state="specified" size={12} />
			<span>Specified</span>
		</div>
		<div class="legend-item">
			<StateIcon state="implemented" size={12} />
			<span>Implemented</span>
		</div>
	</div>
</div>

<style>
	.feature-tree {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	/* Matches matrix-header height */
	.tree-header {
		display: flex;
		align-items: center;
		height: 36px;
		padding: 0 12px;
		background: var(--background-subtle);
		border-bottom: 1px solid var(--border-default);
	}

	.tree-title {
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--foreground-muted);
	}

	/* Matches matrix-subheader height */
	.tree-subheader {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		height: 27px;
		padding: 0 12px;
		background: var(--background);
		border-bottom: 1px solid var(--border-default);
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
	}

	.tree-row {
		display: flex;
		border-bottom: 1px solid var(--border-subtle);
	}

	.empty-state {
		padding: 24px 16px;
		text-align: center;
		color: var(--foreground-subtle);
		font-size: 13px;
	}

	.tree-legend {
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
