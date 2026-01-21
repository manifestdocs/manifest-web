<script lang="ts">
	import type { components } from '$lib/api/schema.js';
	import FeatureRow from './FeatureRow.svelte';
	import FeatureDragPreview from './FeatureDragPreview.svelte';
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

	// Layout constant (matches CSS)
	const ROW_HEIGHT = 25;

	// Drag state - all centralized here
	let dragState = $state<{
		featureId: string;
		feature: FeatureTreeNode;
		parentId: string | null;
		descendantIds: Set<string>;
		pointerId: number;
	} | null>(null);
	let dragPosition = $state({ x: 0, y: 0 });
	let dropTargetId = $state<string | null>(null);

	// Expansion state
	let expandedIds = $state(new Set<string>());
	let treeContentRef = $state<HTMLElement | null>(null);
	let containerHeight = $state(0);
	let initialized = $state(false);
	let previousFeatureVersion = $state(0);

	// Context menu state
	let contextMenuOpen = $state(false);
	let contextMenuX = $state(0);
	let contextMenuY = $state(0);
	let contextMenuFeatureId = $state<string | null>(null);

	// Build a map of feature positions for drop detection
	type FeaturePosition = { id: string; top: number; bottom: number; isGroup: boolean; isRoot: boolean };
	let featurePositions = $derived.by(() => {
		if (!treeContentRef) return [];
		const positions: FeaturePosition[] = [];
		let y = 0;

		function traverse(nodes: FeatureTreeNode[]) {
			for (const node of sortFeatures(nodes)) {
				const isGroup = node.children.length > 0;
				const isRoot = node.is_root ?? false;
				positions.push({ id: node.id, top: y, bottom: y + ROW_HEIGHT, isGroup, isRoot });
				y += ROW_HEIGHT;
				if ((isRoot || expandedIds.has(node.id)) && node.children.length > 0) {
					traverse(node.children);
				}
			}
		}
		traverse(features);
		return positions;
	});

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
			previousFeatureVersion = computeFeatureVersion(features);
			initialized = true;
		}
	});

	// Reset initialized flag when project changes
	$effect(() => {
		projectId;
		initialized = false;
	});

	// Handle tree updates (e.g., from SSE) - detect newly-complete groups
	$effect(() => {
		if (!initialized) return;
		const currentVersion = computeFeatureVersion(features);
		if (currentVersion !== previousFeatureVersion) {
			expandedIds = featureExpansion.handleTreeUpdate(features, expandedIds);
			previousFeatureVersion = currentVersion;
		}
	});

	// Simple version computation based on feature states and structure
	function computeFeatureVersion(nodes: FeatureTreeNode[]): number {
		let hash = 0;
		function traverse(n: FeatureTreeNode) {
			hash = (hash * 31 + n.state.charCodeAt(0)) >>> 0;
			hash = (hash * 31 + n.children.length) >>> 0;
			for (const child of n.children) traverse(child);
		}
		for (const node of nodes) traverse(node);
		return hash;
	}

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

	// Get all descendant IDs of a feature
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
	function isValidDropTarget(targetId: string): boolean {
		if (!dragState) return false;
		if (targetId === dragState.featureId) return false;
		if (targetId === dragState.parentId) return false;
		if (dragState.descendantIds.has(targetId)) return false;
		return true;
	}

	// Find drop target from mouse position (using tree structure, not DOM)
	function findDropTarget(clientY: number): string | null {
		if (!treeContentRef || !dragState) return null;

		const rect = treeContentRef.getBoundingClientRect();
		const scrollTop = treeContentRef.scrollTop;
		const relativeY = clientY - rect.top + scrollTop;

		// Find which feature row we're over
		for (const pos of featurePositions) {
			if (relativeY >= pos.top && relativeY < pos.bottom) {
				// Only groups and root can be drop targets
				if ((pos.isGroup || pos.isRoot) && isValidDropTarget(pos.id)) {
					return pos.id;
				}
				return null;
			}
		}
		return null;
	}

	// Drag handlers
	function handleDragStart(featureId: string, e: PointerEvent) {
		const node = findFeature(features, featureId);
		if (!node) return;

		dragState = {
			featureId,
			feature: node,
			parentId: node.parent_id ?? null,
			descendantIds: getDescendantIds(node),
			pointerId: e.pointerId
		};
		dragPosition = { x: e.clientX, y: e.clientY };

		// Capture pointer on the tree content for move/up events
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!dragState || e.pointerId !== dragState.pointerId) return;

		dragPosition = { x: e.clientX, y: e.clientY };
		dropTargetId = findDropTarget(e.clientY);
	}

	function handlePointerUp(e: PointerEvent) {
		if (!dragState || e.pointerId !== dragState.pointerId) return;

		const targetId = findDropTarget(e.clientY);

		if (targetId && isValidDropTarget(targetId)) {
			// Expand target group to show dropped item
			if (!expandedIds.has(targetId)) {
				expandedIds = new Set([...expandedIds, targetId]);
			}
			onReparent?.(dragState.featureId, targetId);
		}

		// Reset drag state
		(e.target as HTMLElement).releasePointerCapture(e.pointerId);
		dragState = null;
		dropTargetId = null;
	}

	function handlePointerCancel(e: PointerEvent) {
		if (!dragState || e.pointerId !== dragState.pointerId) return;
		dragState = null;
		dropTargetId = null;
	}

	// Context menu handlers
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
		if (e.target === e.currentTarget) {
			e.preventDefault();
			contextMenuFeatureId = null;
			contextMenuX = e.clientX;
			contextMenuY = e.clientY;
			contextMenuOpen = true;
		}
	}

	// Sort features: groups alphabetically first, then leaves by state
	const stateOrder: Record<string, number> = {
		implemented: 0,
		in_progress: 1,
		proposed: 2,
		deprecated: 3
	};

	function sortFeatures(nodes: FeatureTreeNode[]): FeatureTreeNode[] {
		const groups = nodes.filter(n => n.children.length > 0);
		const leaves = nodes.filter(n => n.children.length === 0);

		groups.sort((a, b) => a.title.localeCompare(b.title));
		leaves.sort((a, b) => {
			const aOrder = stateOrder[a.state] ?? 99;
			const bOrder = stateOrder[b.state] ?? 99;
			if (aOrder !== bOrder) return aOrder - bOrder;
			if (a.priority !== b.priority) return a.priority - b.priority;
			return a.title.localeCompare(b.title);
		});

		return [...groups, ...leaves];
	}
</script>

<div class="feature-tree" style="--feature-col-width: {featureColumnWidth}px">
	<div class="tree-header">
		<span class="tree-title">Feature Tree</span>
	</div>

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
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onpointercancel={handlePointerCancel}
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
	{@const hasChildren = feature.children.length > 0}
	{@const isRoot = feature.is_root ?? false}
	{@const groupMeta = hasChildren ? featureExpansion.getGroupMetadata(feature) : null}
	{@const isDragging = dragState?.featureId === feature.id}
	{@const isDropHovered = dropTargetId === feature.id}
	{@const isExpanded = isRoot || expandedIds.has(feature.id)}

	<div
		class="tree-row"
		class:is-group={hasChildren || isRoot}
		class:drop-hover={isDropHovered}
		class:is-dragging={isDragging}
		data-feature-id={feature.id}
	>
		<FeatureRow
			{feature}
			{depth}
			isSelected={selectedId === feature.id}
			{isExpanded}
			showTrack={!hasChildren && !!feature.target_version_id}
			hasFutureWork={groupMeta?.hasFutureWork ?? false}
			isDraggable={!!onReparent && !isRoot}
			{isDragging}
			{onSelect}
			onToggle={handleToggle}
			onContextMenu={handleRowContextMenu}
			onDragStart={handleDragStart}
		/>
	</div>

	{#if (hasChildren || isRoot) && isExpanded}
		{#each sortFeatures(feature.children) as child (child.id)}
			{@render renderNode(child, depth + 1)}
		{/each}
	{/if}
{/snippet}

{#if dragState}
	<FeatureDragPreview feature={dragState.feature} x={dragPosition.x} y={dragPosition.y} />
{/if}

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
		transition: background-color 0.1s ease;
	}

	.tree-row.is-dragging {
		opacity: 0.5;
	}

	.tree-row.is-group.drop-hover {
		background: rgba(107, 142, 95, 0.25);
	}

	.empty-state {
		padding: 24px 16px;
		text-align: center;
		color: var(--foreground-subtle);
		font-size: 13px;
	}
</style>
