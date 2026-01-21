<script lang="ts">
	import type { components } from '$lib/api/schema.js';
	import FeatureRow from './FeatureRow.svelte';
	import FeatureContextMenu from './FeatureContextMenu.svelte';
	import { featureExpansion } from '$lib/stores/index.js';

	type FeatureTreeNode = components['schemas']['FeatureTreeNode'];

	interface Props {
		features: FeatureTreeNode[];
		selectedId: string | null;
		projectId: string;
		featureColumnWidth?: number;
		onSelect: (id: string) => void;
		onAddFeature?: (parentId: string | null) => void;
		onReparent?: (featureId: string, newParentId: string | null) => void;
	}

	let { features, selectedId, projectId, featureColumnWidth = 350, onSelect, onAddFeature, onReparent }: Props = $props();

	// Drag state
	let dragState = $state<{
		featureId: string;
		parentId: string | null;
		descendantIds: Set<string>;
	} | null>(null);
	let dropTargetId = $state<string | null>(null);

	let expandedIds = $state(new Set<string>());
	let treeContentRef = $state<HTMLElement | null>(null);
	let containerHeight = $state(0);
	let initialized = $state(false);
	let previousFeaturesJson = $state('');

	// Context menu state
	let contextMenuOpen = $state(false);
	let contextMenuX = $state(0);
	let contextMenuY = $state(0);
	let contextMenuFeatureId = $state<string | null>(null);

	// Measure container height with ResizeObserver
	$effect(() => {
		if (treeContentRef) {
			const observer = new ResizeObserver((entries) => {
				containerHeight = entries[0]?.contentRect.height ?? 0;
			});
			observer.observe(treeContentRef);
			return () => observer.disconnect();
		}
	});

	// Initialize expansion state once we have all required data
	$effect(() => {
		if (projectId && features.length > 0 && containerHeight > 0 && !initialized) {
			expandedIds = featureExpansion.init(projectId, features, containerHeight);
			previousFeaturesJson = JSON.stringify(features);
			initialized = true;
		}
	});

	// Reset initialized flag when project changes
	$effect(() => {
		projectId; // Track projectId changes
		initialized = false;
	});

	// Handle tree updates (e.g., from SSE) - detect newly-complete groups
	$effect(() => {
		if (!initialized) return;

		const currentJson = JSON.stringify(features);
		if (currentJson !== previousFeaturesJson) {
			expandedIds = featureExpansion.handleTreeUpdate(features, expandedIds);
			previousFeaturesJson = currentJson;
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
		expandedIds = featureExpansion.toggle(id, expandedIds);
	}

	function expandAll() {
		expandedIds = featureExpansion.expandAll(features);
	}

	function collapseAll() {
		expandedIds = featureExpansion.collapseAll();
	}

	function handleAddFeature() {
		// If a feature is selected, add as child; otherwise add at root
		onAddFeature?.(selectedId);
	}

	// Find a feature by ID in the tree
	function findFeature(nodes: FeatureTreeNode[], id: string): FeatureTreeNode | null {
		for (const node of nodes) {
			if (node.id === id) return node;
			const found = findFeature(node.children, id);
			if (found) return found;
		}
		return null;
	}

	// Get all descendant IDs of a feature (for circular reference prevention)
	function getDescendantIds(node: FeatureTreeNode): Set<string> {
		const ids = new Set<string>();
		function collect(n: FeatureTreeNode) {
			for (const child of n.children) {
				ids.add(child.id);
				collect(child);
			}
		}
		collect(node);
		return ids;
	}

	// Check if a feature is a valid drop target
	function isValidDropTarget(featureId: string): boolean {
		if (!dragState) return false;
		// Can't drop on self
		if (featureId === dragState.featureId) return false;
		// Can't drop on current parent (already there)
		if (featureId === dragState.parentId) return false;
		// Can't drop on descendants (would create circular reference)
		if (dragState.descendantIds.has(featureId)) return false;
		return true;
	}

	// Drag handlers passed to FeatureRow
	function handleDragStart(featureId: string) {
		const node = findFeature(features, featureId);
		if (!node) return;
		dragState = {
			featureId,
			parentId: node.parent_id ?? null,
			descendantIds: getDescendantIds(node)
		};
	}

	function handleDragHover(targetId: string | null) {
		dropTargetId = targetId;
	}

	function handleDragEnd() {
		dragState = null;
		dropTargetId = null;
	}

	function handleDrop(featureId: string, newParentId: string | null) {
		// Validate the drop
		if (newParentId !== null && newParentId !== 'root') {
			if (!isValidDropTarget(newParentId)) {
				handleDragEnd();
				return;
			}
			// Expand the target group to show the dropped item
			if (!expandedIds.has(newParentId)) {
				expandedIds = new Set([...expandedIds, newParentId]);
			}
		}
		// For 'root' drops, set parent to null (true root-level)
		onReparent?.(featureId, newParentId === 'root' ? null : newParentId);
		handleDragEnd();
	}

	const contextMenuFeatureTitle = $derived(
		contextMenuFeatureId ? findFeature(features, contextMenuFeatureId)?.title ?? null : null
	);

	function handleRowContextMenu(id: string, x: number, y: number) {
		contextMenuFeatureId = id;
		contextMenuX = x;
		contextMenuY = y;
		contextMenuOpen = true;
	}

	function handleContextMenuClose() {
		contextMenuOpen = false;
	}

	function handleContextMenuAddChild() {
		onAddFeature?.(contextMenuFeatureId);
	}

	function handleTreeContextMenu(e: MouseEvent) {
		// Only trigger if clicking on the tree background (empty space)
		if (e.target === e.currentTarget) {
			e.preventDefault();
			contextMenuFeatureId = null;
			contextMenuX = e.clientX;
			contextMenuY = e.clientY;
			contextMenuOpen = true;
		}
	}

	// Sort features: groups alphabetically, leaves by state
	const stateOrder: Record<string, number> = {
		implemented: 0,
		in_progress: 1,
		proposed: 2,
		deprecated: 3
	};

	function sortFeatures(nodes: FeatureTreeNode[]): FeatureTreeNode[] {
		const groups = nodes.filter(n => n.children.length > 0);
		const leaves = nodes.filter(n => n.children.length === 0);

		// Groups: alphabetical
		groups.sort((a, b) => a.title.localeCompare(b.title));

		// Leaves: by state, then priority, then title
		leaves.sort((a, b) => {
			const aOrder = stateOrder[a.state] ?? 99;
			const bOrder = stateOrder[b.state] ?? 99;
			if (aOrder !== bOrder) return aOrder - bOrder;
			if (a.priority !== b.priority) return a.priority - b.priority;
			return a.title.localeCompare(b.title);
		});

		// Groups first, then leaves
		return [...groups, ...leaves];
	}
</script>

<div class="feature-tree" style="--feature-col-width: {featureColumnWidth}px">
	<!-- Header row (matches matrix header) -->
	<div class="tree-header">
		<span class="tree-title">Feature Tree</span>
	</div>

	<!-- Subheader row (matches matrix subheader) -->
	<div class="tree-subheader">
		<div class="tree-actions">
			{#if onAddFeature}
				<button class="action-btn" onclick={handleAddFeature} title="Add feature" type="button">
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
						<path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
					</svg>
				</button>
			{/if}
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

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="tree-content"
		bind:this={treeContentRef}
		oncontextmenu={handleTreeContextMenu}
	>
		{#if features.length === 0}
			<div class="empty-state">No features yet</div>
		{:else}
			{#each sortFeatures(features) as node (node.id)}
				{@render renderNode(node, 0)}
			{/each}
		{/if}
	</div>
</div>

{#snippet renderNode(feature: FeatureTreeNode, depth: number)}
	{@const hasChildren = feature.children && feature.children.length > 0}
	{@const isRoot = feature.is_root ?? false}
	{@const groupMeta = hasChildren ? featureExpansion.getGroupMetadata(feature) : null}
	{@const isDragging = dragState?.featureId === feature.id}
	{@const isDropHovered = dropTargetId === feature.id}
	{@const isExpanded = isRoot || expandedIds.has(feature.id)}
	{@const sortedChildren = sortFeatures(feature.children)}

	{#if hasChildren || isRoot}
		<!-- Group container wraps header + children for drop zone -->
		<div
			class="group-container"
			class:drop-hover={isDropHovered}
			class:is-dragging={isDragging}
			class:is-root={isRoot}
			data-feature-group-id={feature.id}
		>
			<div class="tree-row">
				<FeatureRow
					{feature}
					{depth}
					isSelected={selectedId === feature.id}
					{isExpanded}
					showTrack={false}
					hasFutureWork={groupMeta?.hasFutureWork ?? false}
					isDraggable={!!onReparent && !isRoot}
					{isDragging}
					isDropTarget={false}
					isDropHovered={false}
					{onSelect}
					onToggle={handleToggle}
					onContextMenu={handleRowContextMenu}
					onDragStart={handleDragStart}
					onDragHover={handleDragHover}
					onDragEnd={handleDragEnd}
					onDrop={handleDrop}
				/>
			</div>
			{#if isExpanded}
				{#each sortedChildren as child (child.id)}
					{@render renderNode(child, depth + 1)}
				{/each}
			{/if}
		</div>
	{:else}
		<!-- Leaf node -->
		<div class="tree-row" class:is-dragging={isDragging}>
			<FeatureRow
				{feature}
				{depth}
				isSelected={selectedId === feature.id}
				isExpanded={false}
				showTrack={!!feature.target_version_id}
				hasFutureWork={false}
				isDraggable={!!onReparent}
				{isDragging}
				isDropTarget={false}
				isDropHovered={false}
				{onSelect}
				onToggle={handleToggle}
				onContextMenu={handleRowContextMenu}
				onDragStart={handleDragStart}
				onDragHover={handleDragHover}
				onDragEnd={handleDragEnd}
				onDrop={handleDrop}
			/>
		</div>
	{/if}
{/snippet}

<FeatureContextMenu
	open={contextMenuOpen}
	x={contextMenuX}
	y={contextMenuY}
	featureTitle={contextMenuFeatureTitle}
	onClose={handleContextMenuClose}
	onAddChild={handleContextMenuAddChild}
/>

<style>
	.feature-tree {
		display: grid;
		grid-template-rows: auto auto 1fr;
		flex: 1;
		min-height: 0;
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
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		display: flex;
		flex-direction: column;
	}

	.tree-row {
		display: flex;
		border-bottom: 1px solid var(--border-subtle);
	}

	.tree-row.is-dragging {
		opacity: 0.5;
	}

	.group-container {
		border-radius: 4px;
		margin: 2px 4px 2px 0;
		transition: box-shadow 0.1s ease, background-color 0.1s ease;
	}

	.group-container.is-dragging {
		opacity: 0.5;
	}

	.group-container.drop-hover {
		box-shadow: inset 0 0 0 2px rgba(107, 142, 95, 0.7);
		background: rgba(107, 142, 95, 0.06);
	}

	.group-container.is-root {
		margin: 0;
		border-radius: 0;
	}

	.empty-state {
		padding: 24px 16px;
		text-align: center;
		color: var(--foreground-subtle);
		font-size: 13px;
	}
</style>
