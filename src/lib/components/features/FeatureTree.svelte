<script lang="ts">
	import type { components } from '$lib/api/schema.js';
	import FeatureRow from './FeatureRow.svelte';
	import FeatureDragPreview from './FeatureDragPreview.svelte';
	import FeatureContextMenu from './FeatureContextMenu.svelte';
	import CreateGroupDialog from './CreateGroupDialog.svelte';
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
		onCreateGroup?: (title: string, childIds: [string, string], parentId: string | null) => Promise<void>;
		onArchiveFeature?: (id: string, title: string, isGroup: boolean, childCount: number, parentId: string | null) => void;
	}

	let { features, selectedId, projectId, featureColumnWidth = 350, onSelect, onAddFeature, onReparent, onCreateGroup, onArchiveFeature }: Props = $props();

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
	let dropTarget = $state<{ id: string; isLeafTarget: boolean } | null>(null);

	// Group creation dialog state
	let groupDialogOpen = $state(false);
	let pendingGroupData = $state<{ childIds: [string, string]; childTitles: [string, string]; parentId: string | null } | null>(null);

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
	type FeaturePosition = { id: string; top: number; bottom: number; isGroup: boolean; isRoot: boolean; isLeaf: boolean; parentId: string | null };
	let featurePositions = $derived.by(() => {
		if (!treeContentRef) return [];
		const positions: FeaturePosition[] = [];
		let y = 0;

		function traverse(nodes: FeatureTreeNode[], parentId: string | null) {
			for (const node of sortFeatures(nodes)) {
				const isGroup = node.children.length > 0;
				const isRoot = node.is_root ?? false;
				const isLeaf = !isGroup && !isRoot;
				positions.push({ id: node.id, top: y, bottom: y + ROW_HEIGHT, isGroup, isRoot, isLeaf, parentId });
				y += ROW_HEIGHT;
				if ((isRoot || expandedIds.has(node.id)) && node.children.length > 0) {
					traverse(node.children, node.id);
				}
			}
		}
		traverse(features, null);
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

	// Check if the dragged feature is a leaf
	function isDraggingLeaf(): boolean {
		return dragState !== null && dragState.feature.children.length === 0;
	}

	// Find drop target from mouse position (using tree structure, not DOM)
	function findDropTarget(clientY: number): { id: string; isLeafTarget: boolean } | null {
		if (!treeContentRef || !dragState) return null;

		const rect = treeContentRef.getBoundingClientRect();
		const scrollTop = treeContentRef.scrollTop;
		const relativeY = clientY - rect.top + scrollTop;

		// Find which feature row we're over
		for (const pos of featurePositions) {
			if (relativeY >= pos.top && relativeY < pos.bottom) {
				// Groups and root can always be drop targets
				if ((pos.isGroup || pos.isRoot) && isValidDropTarget(pos.id)) {
					return { id: pos.id, isLeafTarget: false };
				}
				// Leaf-on-leaf: allow if dragging a leaf onto another leaf
				if (pos.isLeaf && isDraggingLeaf() && isValidDropTarget(pos.id)) {
					return { id: pos.id, isLeafTarget: true };
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
		dropTarget = findDropTarget(e.clientY);
	}

	function handlePointerUp(e: PointerEvent) {
		if (!dragState || e.pointerId !== dragState.pointerId) return;

		const target = findDropTarget(e.clientY);

		if (target && isValidDropTarget(target.id)) {
			if (target.isLeafTarget && onCreateGroup) {
				// Leaf-on-leaf drop: show dialog to create group
				const targetFeature = findFeature(features, target.id);
				const targetPos = featurePositions.find(p => p.id === target.id);
				if (targetFeature) {
					pendingGroupData = {
						childIds: [dragState.featureId, target.id],
						childTitles: [dragState.feature.title, targetFeature.title],
						parentId: targetPos?.parentId ?? null
					};
					groupDialogOpen = true;
				}
			} else {
				// Regular group/root drop
				if (!expandedIds.has(target.id)) {
					expandedIds = new Set([...expandedIds, target.id]);
				}
				onReparent?.(dragState.featureId, target.id);
			}
		}

		// Reset drag state
		(e.target as HTMLElement).releasePointerCapture(e.pointerId);
		dragState = null;
		dropTarget = null;
	}

	function handlePointerCancel(e: PointerEvent) {
		if (!dragState || e.pointerId !== dragState.pointerId) return;
		dragState = null;
		dropTarget = null;
	}

	// Handle group creation from dialog
	async function handleCreateGroup(title: string) {
		if (!pendingGroupData || !onCreateGroup) return;
		await onCreateGroup(title, pendingGroupData.childIds, pendingGroupData.parentId);
		pendingGroupData = null;
	}

	// Context menu handlers
	const contextMenuFeature = $derived(
		contextMenuFeatureId ? findFeature(features, contextMenuFeatureId) : null
	);
	const contextMenuFeatureTitle = $derived(contextMenuFeature?.title ?? null);
	const contextMenuFeatureIsRoot = $derived(contextMenuFeature?.is_root ?? false);

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

	function handleContextMenuArchive() {
		if (!contextMenuFeature || !onArchiveFeature) return;
		if (contextMenuFeature.is_root) return;

		onArchiveFeature(
			contextMenuFeature.id,
			contextMenuFeature.title,
			contextMenuFeature.children.length > 0,
			contextMenuFeature.children.length,
			contextMenuFeature.parent_id ?? null
		);
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
		archived: 3
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
	{@const isLeaf = !hasChildren && !isRoot}
	{@const groupMeta = hasChildren ? featureExpansion.getGroupMetadata(feature) : null}
	{@const isDragging = dragState?.featureId === feature.id}
	{@const isDropHovered = dropTarget?.id === feature.id && !dropTarget?.isLeafTarget}
	{@const isLeafDropTarget = dropTarget?.id === feature.id && dropTarget?.isLeafTarget}
	{@const isExpanded = isRoot || expandedIds.has(feature.id)}

	<div
		class="tree-row"
		class:is-group={hasChildren || isRoot}
		class:is-leaf={isLeaf}
		class:drop-hover={isDropHovered}
		class:leaf-drop-hover={isLeafDropTarget}
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
			isDraggable={!!(onReparent || onCreateGroup) && !isRoot}
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
	isRoot={contextMenuFeatureIsRoot}
	onClose={handleContextMenuClose}
	onAddChild={handleContextMenuAddChild}
	onArchive={onArchiveFeature ? handleContextMenuArchive : undefined}
/>

{#if pendingGroupData}
	<CreateGroupDialog
		open={groupDialogOpen}
		onOpenChange={(open) => {
			groupDialogOpen = open;
			if (!open) pendingGroupData = null;
		}}
		onCreate={handleCreateGroup}
		featureTitles={pendingGroupData.childTitles}
	/>
{/if}

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

	.tree-row.is-leaf.leaf-drop-hover {
		background: rgba(59, 130, 246, 0.2);
	}

	.empty-state {
		padding: 24px 16px;
		text-align: center;
		color: var(--foreground-subtle);
		font-size: 13px;
	}
</style>
