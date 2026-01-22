<script lang="ts">
	import type { components } from '$lib/api/schema.js';
	import FeatureRow from '$lib/components/features/FeatureRow.svelte';
	import FeatureDragPreview from '$lib/components/features/FeatureDragPreview.svelte';
	import { StateIcon } from '$lib/components/icons/index.js';
	import { InfoBanner, ResizeDivider } from '$lib/components/ui/index.js';
	import { featureExpansion } from '$lib/stores/index.js';
	import CreateVersionDialog from './CreateVersionDialog.svelte';
	import DraggableDot from './DraggableDot.svelte';

	type FeatureTreeNode = components['schemas']['FeatureTreeNode'];
	type Version = components['schemas']['Version'];

	interface Props {
		features: FeatureTreeNode[];
		versions: Version[];
		selectedId: string | null;
		projectId: string;
		featureColumnWidth?: number;
		onSelect: (id: string) => void;
		onCreateVersion: (name: string, description: string | null) => Promise<void>;
		onUpdateFeatureVersion?: (featureId: string, versionId: string | null) => Promise<void>;
		onCompleteVersion?: (versionId: string) => Promise<void>;
		onResize?: (deltaX: number) => void;
		onReparent?: (featureId: string, newParentId: string | null) => void;
	}

	let { features, versions, selectedId, projectId, featureColumnWidth = 350, onSelect, onCreateVersion, onUpdateFeatureVersion, onCompleteVersion, onResize, onReparent }: Props = $props();

	let showCreateDialog = $state(false);
	let isCompleting = $state(false);
	let closingVersionId = $state<string | null>(null);
	let expandedIds = $state(new Set<string>());
	let matrixBodyRef = $state<HTMLElement | null>(null);
	let containerHeight = $state(0);
	let initialized = $state(false);
	let previousFeatureVersion = $state(0);

	// Drag state for version drop zone indicator
	let dragHover = $state<{ featureId: string; versionId: string } | null>(null);

	// Drag state for feature reparenting (centralized like FeatureTree)
	let reparentDragState = $state<{
		featureId: string;
		feature: FeatureTreeNode;
		parentId: string | null;
		descendantIds: Set<string>;
		pointerId: number;
	} | null>(null);
	let reparentDragPosition = $state({ x: 0, y: 0 });
	let reparentDropTargetId = $state<string | null>(null);

	// Layout constant (matches FeatureTree)
	const ROW_HEIGHT = 25;

	// Measure container height with ResizeObserver
	$effect(() => {
		if (matrixBodyRef) {
			const observer = new ResizeObserver((entries) => {
				containerHeight = entries[0]?.contentRect.height ?? 0;
			});
			observer.observe(matrixBodyRef);
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
		projectId; // Track projectId changes
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

	// Hash-based version computation (like FeatureTree)
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

	// Group versions into Now, Next, Later
	type VersionGroup = {
		label: string;
		versions: Version[];
	};

	let groupedVersions = $derived.by(() => {
		const groups: VersionGroup[] = [];
		const unreleased = versions.filter((v) => !v.released_at);

		if (unreleased.length > 0) {
			groups.push({ label: 'Now', versions: [unreleased[0]] });
		}
		if (unreleased.length > 1) {
			groups.push({ label: 'Next', versions: [unreleased[1]] });
		}
		if (unreleased.length > 2) {
			groups.push({ label: 'Later', versions: unreleased.slice(2) });
		}

		return groups;
	});

	// Get the "Now" version (first unreleased)
	let nowVersion = $derived.by(() => {
		const unreleased = versions.filter((v) => !v.released_at);
		return unreleased.length > 0 ? unreleased[0] : null;
	});

	// Get features targeting the "Now" version
	let nowVersionFeatures = $derived.by(() => {
		if (!nowVersion) return [];
		const result: FeatureTreeNode[] = [];

		function collectTargetedFeatures(nodes: FeatureTreeNode[]) {
			for (const node of nodes) {
				const isLeaf = !node.children || node.children.length === 0;
				if (isLeaf && node.target_version_id === nowVersion!.id) {
					result.push(node);
				}
				if (node.children) {
					collectTargetedFeatures(node.children);
				}
			}
		}

		collectTargetedFeatures(features);
		return result;
	});

	// Check if the "Now" version is feature complete
	let isNowFeatureComplete = $derived.by(() => {
		if (!nowVersion || nowVersionFeatures.length === 0) return false;
		return nowVersionFeatures.every((f) => f.state === 'implemented');
	});

	// Handle completing the Now version
	async function handleCompleteNow() {
		if (!nowVersion || isCompleting || closingVersionId) return;

		// Track which specific version is closing
		const versionToClose = nowVersion.id;
		closingVersionId = versionToClose;

		// Wait for animation to complete, then call API
		setTimeout(async () => {
			if (onCompleteVersion) {
				isCompleting = true;
				try {
					await onCompleteVersion(versionToClose);
				} catch (error) {
					console.error('Failed to complete version:', error);
					closingVersionId = null; // Reset on error so user can retry
				} finally {
					isCompleting = false;
					// Don't reset closingVersionId here - let the data refresh handle it
					// The old version will be gone, so the class won't match anything
				}
			} else {
				closingVersionId = null;
			}
		}, 400); // Match animation duration
	}

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

	// Build feature positions for drop detection (like FeatureTree)
	type FeaturePosition = { id: string; top: number; bottom: number; isGroup: boolean; isRoot: boolean };
	let featurePositions = $derived.by(() => {
		if (!matrixBodyRef) return [];
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

	function toggleExpand(id: string) {
		expandedIds = featureExpansion.toggle(id, expandedIds);
	}

	// Get flat index for a version ID (for determining track visibility)
	function getVersionFlatIndex(versionId: string | null | undefined): number {
		if (!versionId) return -1;
		let idx = 0;
		for (const group of groupedVersions) {
			for (const version of group.versions) {
				if (version.id === versionId) return idx;
				idx++;
			}
		}
		return -1;
	}

	// Get flat index for group/version position
	function getFlatIndex(groupIndex: number, versionIndex: number): number {
		let idx = 0;
		for (let g = 0; g < groupIndex; g++) {
			idx += groupedVersions[g].versions.length;
		}
		return idx + versionIndex;
	}

	// Handle hover during drag for drop zone indicator
	function handleDotHover(featureId: string, versionId: string | null) {
		if (versionId) {
			dragHover = { featureId, versionId };
		} else {
			dragHover = null;
		}
	}

	// Handle dot drop to update feature's target version
	async function handleDotDrop(featureId: string, newVersionId: string | null) {
		// Clear hover state
		dragHover = null;
		// Find the feature's current target version
		const feature = findFeature(features, featureId);
		if (!feature) return;

		// Skip if dropped on same column
		if (feature.target_version_id === newVersionId) return;

		// Call the update handler if provided
		if (onUpdateFeatureVersion) {
			try {
				await onUpdateFeatureVersion(featureId, newVersionId);
			} catch (error) {
				console.error('Failed to update feature version:', error);
			}
		}
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

	// Check if a feature is a valid drop target for reparenting
	function isValidReparentTarget(featureId: string): boolean {
		if (!reparentDragState) return false;
		if (featureId === reparentDragState.featureId) return false;
		if (featureId === reparentDragState.parentId) return false;
		if (reparentDragState.descendantIds.has(featureId)) return false;
		return true;
	}

	// Find drop target from mouse position (using tree structure, not DOM)
	function findDropTarget(clientY: number): string | null {
		if (!matrixBodyRef || !reparentDragState) return null;

		const rect = matrixBodyRef.getBoundingClientRect();
		const scrollTop = matrixBodyRef.scrollTop;
		const relativeY = clientY - rect.top + scrollTop;

		// Find which feature row we're over
		for (const pos of featurePositions) {
			if (relativeY >= pos.top && relativeY < pos.bottom) {
				// Only groups and root can be drop targets
				if ((pos.isGroup || pos.isRoot) && isValidReparentTarget(pos.id)) {
					return pos.id;
				}
				return null;
			}
		}
		return null;
	}

	// Reparent drag handlers (pointer-event based like FeatureTree)
	function handleReparentDragStart(featureId: string, e: PointerEvent) {
		const node = findFeature(features, featureId);
		if (!node) return;

		reparentDragState = {
			featureId,
			feature: node,
			parentId: node.parent_id ?? null,
			descendantIds: getDescendantIds(node),
			pointerId: e.pointerId
		};
		reparentDragPosition = { x: e.clientX, y: e.clientY };

		// Capture pointer on the target element for move/up events
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!reparentDragState || e.pointerId !== reparentDragState.pointerId) return;

		reparentDragPosition = { x: e.clientX, y: e.clientY };
		reparentDropTargetId = findDropTarget(e.clientY);
	}

	function handlePointerUp(e: PointerEvent) {
		if (!reparentDragState || e.pointerId !== reparentDragState.pointerId) return;

		const targetId = findDropTarget(e.clientY);

		if (targetId && isValidReparentTarget(targetId)) {
			// Expand target group to show dropped item
			if (!expandedIds.has(targetId)) {
				expandedIds = new Set([...expandedIds, targetId]);
			}
			onReparent?.(reparentDragState.featureId, targetId);
		}

		// Reset drag state
		(e.target as HTMLElement).releasePointerCapture(e.pointerId);
		reparentDragState = null;
		reparentDropTargetId = null;
	}

	function handlePointerCancel(e: PointerEvent) {
		if (!reparentDragState || e.pointerId !== reparentDragState.pointerId) return;
		reparentDragState = null;
		reparentDropTargetId = null;
	}

	// Sort features: groups alphabetically, leaves by state
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

<div class="matrix-container" style="--feature-col-width: {featureColumnWidth}px">
	{#if onResize}
		<div class="resize-divider-container">
			<ResizeDivider onResize={onResize} />
		</div>
	{/if}

	<!-- Header -->
	<div class="matrix-header">
		<!-- Feature column header -->
		<div class="header-cell feature-header">
			<span class="feature-title">Features</span>
		</div>

		<!-- Version group headers -->
		{#each groupedVersions as group}
			{@const isGroupClosing = group.versions.some(v => v.id === closingVersionId)}
			<div
				class="header-cell group-header"
				class:closing={isGroupClosing}
				style="width: {group.versions.length * 80}px"
			>
				<span class="group-label">{group.label}</span>
			</div>
		{/each}
	</div>

	<!-- Sub-header with version names -->
	<div class="matrix-subheader" class:has-complete-banner={isNowFeatureComplete && onCompleteVersion}>
		<div class="subheader-cell feature-subheader"></div>
		{#each groupedVersions as group, groupIndex}
			{#each group.versions as version, versionIndex}
				{@const colIndex = getFlatIndex(groupIndex, versionIndex)}
				<div
					class="subheader-cell version-name"
					class:group-start={versionIndex === 0}
					class:zebra={colIndex % 2 === 0}
					class:feature-complete={isNowFeatureComplete && group.label === 'Now'}
					class:closing={version.id === closingVersionId}
					title={version.description || ''}
				>
					{version.name}
				</div>
			{/each}
		{/each}
	</div>

	<!-- Feature complete banner -->
	{#if isNowFeatureComplete && onCompleteVersion && nowVersion}
		<InfoBanner spacerWidth="{featureColumnWidth}px" class="feature-complete-banner">
			{#snippet icon()}
				<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
					<path d="M6 2L6 10M6 2L2 6M6 2L10 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			{/snippet}
			<strong>{nowVersion.name}</strong> is feature complete. Close and advance planning?
			<button
				type="button"
				class="banner-btn"
				onclick={handleCompleteNow}
				disabled={isCompleting}
			>
				{isCompleting ? 'Closing...' : 'Close'}
			</button>
		</InfoBanner>
	{/if}

	<!-- Body -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="matrix-body"
		bind:this={matrixBodyRef}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onpointercancel={handlePointerCancel}
	>
		<!-- Full-height column backgrounds -->
		<div class="column-backgrounds">
			<div class="col-bg feature-col"></div>
			{#each groupedVersions as group, groupIndex}
				{#each group.versions as version, versionIndex}
					{@const colIndex = getFlatIndex(groupIndex, versionIndex)}
					<div
						class="col-bg version-col"
						class:group-start={versionIndex === 0}
						class:zebra={colIndex % 2 === 0}
						class:closing={version.id === closingVersionId}
					></div>
				{/each}
			{/each}
		</div>

		{#if features.length === 0}
			<div class="empty-state">No features yet</div>
		{:else}
			{#each sortFeatures(features) as node (node.id)}
				{@render renderMatrixNode(node, 0)}
			{/each}
		{/if}
	</div>

	<div class="matrix-legend">
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

{#snippet renderMatrixNode(feature: FeatureTreeNode, depth: number)}
	{@const hasChildren = feature.children && feature.children.length > 0}
	{@const isLeaf = !hasChildren}
	{@const isSelected = selectedId === feature.id}
	{@const isDragging = reparentDragState?.featureId === feature.id}
	{@const isDropHovered = reparentDropTargetId === feature.id}
	{@const isExpanded = expandedIds.has(feature.id)}
	{@const isRoot = feature.is_root ?? false}
	{@const sortedChildren = sortFeatures(feature.children)}

	{#if hasChildren}
		<!-- Group container -->
		<div
			class="group-container"
			class:drop-hover={isDropHovered}
			class:is-dragging={isDragging}
			data-feature-group-id={feature.id}
		>
			<div class="matrix-row is-group" class:is-selected={isSelected}>
				<FeatureRow
					{feature}
					{depth}
					isSelected={isSelected}
					{isExpanded}
					showTrack={false}
					hasFutureWork={featureExpansion.getGroupMetadata(feature).hasFutureWork}
					isDraggable={!!onReparent}
					{isDragging}
					{onSelect}
					onToggle={toggleExpand}
					onDragStart={handleReparentDragStart}
				/>
				<!-- Version cells for group -->
				{#each groupedVersions as group}
					{#each group.versions as version}
						<div
							class="version-cell"
							class:closing={version.id === closingVersionId}
						></div>
					{/each}
				{/each}
			</div>
			{#if isExpanded}
				{#each sortedChildren as child (child.id)}
					{@render renderMatrixNode(child, depth + 1)}
				{/each}
			{/if}
		</div>
	{:else}
		<!-- Leaf node -->
		<div class="matrix-row is-leaf" class:is-selected={isSelected} class:is-dragging={isDragging}>
			<FeatureRow
				{feature}
				{depth}
				isSelected={isSelected}
				isExpanded={false}
				showTrack={!!feature.target_version_id}
				hasFutureWork={false}
				isDraggable={!!onReparent}
				{isDragging}
				{onSelect}
				onToggle={toggleExpand}
				onDragStart={handleReparentDragStart}
			/>
			<!-- Version cells for leaf -->
			{#each groupedVersions as group, groupIndex}
				{#each group.versions as version, versionIndex}
					{@const isTarget = feature.target_version_id === version.id}
					{@const targetIdx = getVersionFlatIndex(feature.target_version_id)}
					{@const currentIdx = getFlatIndex(groupIndex, versionIndex)}
					{@const showTrack = targetIdx >= 0 && currentIdx < targetIdx}
					{@const isVersionDropZone = dragHover?.featureId === feature.id && dragHover?.versionId === version.id && !isTarget}
					<div
						class="version-cell"
						class:show-track={showTrack}
						class:has-dot={isTarget}
						class:drop-zone={isVersionDropZone}
						class:closing={version.id === closingVersionId}
						data-version-id={version.id}
					>
						{#if isTarget}
							<DraggableDot
								featureId={feature.id}
								featureState={feature.state}
								onDrop={handleDotDrop}
								onHover={handleDotHover}
							/>
						{/if}
						{#if isVersionDropZone}
							<span class="drop-indicator">
								<StateIcon state={feature.state} size={14} />
							</span>
						{/if}
					</div>
				{/each}
			{/each}
		</div>
	{/if}
{/snippet}

{#if reparentDragState}
	<FeatureDragPreview feature={reparentDragState.feature} x={reparentDragPosition.x} y={reparentDragPosition.y} />
{/if}

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
		max-width: 100%;
		position: relative;
	}

	.resize-divider-container {
		position: absolute;
		top: 0;
		bottom: 0;
		left: var(--feature-col-width);
		z-index: 20;
		display: flex;
		align-items: stretch;
	}

	:global(.feature-complete-banner .banner-content) {
		max-width: 800px;
	}

	.matrix-header {
		display: flex;
		height: 36px;
		background: var(--background-subtle);
		border-bottom: 1px solid var(--border-default);
		overflow: hidden;
	}

	.header-cell {
		display: flex;
		align-items: center;
		padding: 0 12px;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--foreground-muted);
	}

	.feature-header {
		flex: 0 0 var(--feature-col-width);
		min-width: 200px;
		display: flex;
		align-items: center;
		padding: 0 12px;
	}

	.feature-title {
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--foreground-muted);
	}

	.group-header {
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		border-left: 1px solid var(--border-default);
		flex: none;
		transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
		overflow: hidden;
	}

	.group-header.closing {
		width: 0 !important;
		opacity: 0;
	}

	.group-header:last-child {
		border-right: 1px solid var(--border-default);
	}

	.group-label {
		font-weight: 600;
		color: var(--foreground);
	}

	.banner-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 4px 10px;
		font-size: 12px;
		font-weight: 500;
		border-radius: 4px;
		border: 1px solid var(--background);
		background: transparent;
		color: var(--background);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.banner-btn:hover:not(:disabled) {
		background: var(--background);
		color: var(--state-implemented);
	}

	.banner-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.matrix-subheader {
		display: flex;
		height: 27px;
		background: var(--background);
		border-bottom: 1px solid var(--border-default);
		overflow: hidden;
	}

	.matrix-subheader.has-complete-banner {
		border-bottom: none;
	}

	.subheader-cell {
		display: flex;
		align-items: center;
		padding: 0 12px;
		font-size: 11px;
		font-weight: 500;
		color: var(--foreground-muted);
	}

	.feature-subheader {
		flex: 0 0 var(--feature-col-width);
		min-width: 200px;
	}

	.version-name {
		flex: 0 0 80px;
		justify-content: center;
		border-left: 1px solid var(--border-subtle);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		transition: flex-basis 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
	}

	.version-name.closing {
		flex-basis: 0;
		opacity: 0;
	}

	.version-name.group-start {
		border-left: 1px solid var(--border-default);
	}

	.version-name:last-child {
		border-right: 1px solid var(--border-default);
	}

	.version-name.zebra {
		background: rgba(128, 128, 128, 0.04);
	}

	.version-name.feature-complete {
		background: var(--state-implemented);
		color: var(--background);
		border-bottom: 1px solid var(--state-implemented);
	}

	.matrix-body {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		position: relative;
	}

	.column-backgrounds {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		pointer-events: none;
		overflow: hidden;
	}

	.col-bg {
		height: 100%;
	}

	.col-bg.feature-col {
		width: var(--feature-col-width);
		min-width: 200px;
	}

	.col-bg.version-col {
		width: 80px;
		border-left: 1px solid color-mix(in srgb, var(--border-subtle) 40%, transparent);
		transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
	}

	.col-bg.version-col.closing {
		width: 0;
		opacity: 0;
	}

	.col-bg.version-col.group-start {
		border-left: 1px solid var(--border-default);
	}

	.col-bg.version-col.zebra {
		background: rgba(128, 128, 128, 0.04);
	}

	.col-bg.version-col:last-child {
		border-right: 1px solid var(--border-default);
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 48px;
		color: var(--foreground-subtle);
		font-size: 13px;
	}

	.matrix-row {
		display: flex;
		border-bottom: 1px solid var(--border-subtle);
		position: relative;
		overflow: hidden;
	}

	.matrix-row:hover {
		background: var(--background-muted);
	}

	.matrix-row.is-selected {
		background: var(--background-muted);
	}

	.matrix-row.is-dragging {
		opacity: 0.3;
	}

	.group-container {
		border-radius: 4px;
		margin: 0;
		transition: box-shadow 0.1s ease, background-color 0.1s ease;
	}

	.group-container.is-dragging {
		opacity: 0.5;
	}

	.group-container.drop-hover {
		background: rgba(107, 142, 95, 0.25);
	}

	.version-cell {
		flex: 0 0 80px;
		min-height: 25px;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		overflow: hidden;
		transition: flex-basis 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
	}

	.version-cell.closing {
		flex-basis: 0;
		opacity: 0;
	}

	.version-cell.show-track::before,
	.version-cell.has-dot::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 0;
		border-top: 1px dashed var(--border-default);
	}

	.version-cell.show-track::before {
		right: 0;
	}

	.version-cell.has-dot::before {
		right: 50%;
	}

	/* Drop zone indicator */
	.drop-indicator {
		opacity: 0.5;
	}

	.version-cell.drop-zone {
		background: rgba(59, 130, 246, 0.08);
	}

	.matrix-legend {
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
