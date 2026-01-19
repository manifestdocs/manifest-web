<script lang="ts">
	import type { components } from '$lib/api/schema.js';
	import FeatureRow from '$lib/components/features/FeatureRow.svelte';
	import { StateIcon } from '$lib/components/icons/index.js';
	import CreateVersionDialog from './CreateVersionDialog.svelte';
	import DraggableDot from './DraggableDot.svelte';

	type FeatureTreeNode = components['schemas']['FeatureTreeNode'];
	type Version = components['schemas']['Version'];

	interface Props {
		features: FeatureTreeNode[];
		versions: Version[];
		selectedId: string | null;
		onSelect: (id: string) => void;
		onCreateVersion: (name: string, description: string | null) => Promise<void>;
		onUpdateFeatureVersion?: (featureId: string, versionId: string | null) => Promise<void>;
	}

	let { features, versions, selectedId, onSelect, onCreateVersion, onUpdateFeatureVersion }: Props = $props();

	let showCreateDialog = $state(false);
	let expandedIds = $state(new Set<string>());

	// Drag state for drop zone indicator
	let dragHover = $state<{ featureId: string; versionId: string } | null>(null);

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

	function toggleExpand(id: string) {
		const newExpanded = new Set(expandedIds);
		if (newExpanded.has(id)) {
			newExpanded.delete(id);
		} else {
			newExpanded.add(id);
		}
		expandedIds = newExpanded;
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
		function findFeature(nodes: FeatureTreeNode[]): FeatureTreeNode | null {
			for (const node of nodes) {
				if (node.id === featureId) return node;
				if (node.children) {
					const found = findFeature(node.children);
					if (found) return found;
				}
			}
			return null;
		}

		const feature = findFeature(features);
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
</script>

<div class="matrix-container">
	<!-- Header -->
	<div class="matrix-header">
		<!-- Feature column header -->
		<div class="header-cell feature-header">
			<span class="feature-title">Features</span>
		</div>

		<!-- Version group headers -->
		{#each groupedVersions as group}
			<div class="header-cell group-header" style="width: {group.versions.length * 80}px">
				<span class="group-label">{group.label}</span>
			</div>
		{/each}
	</div>

	<!-- Sub-header with version names -->
	<div class="matrix-subheader">
		<div class="subheader-cell feature-subheader"></div>
		{#each groupedVersions as group, groupIndex}
			{#each group.versions as version, versionIndex}
				{@const colIndex = getFlatIndex(groupIndex, versionIndex)}
				<div
					class="subheader-cell version-name"
					class:group-start={versionIndex === 0}
					class:zebra={colIndex % 2 === 0}
					title={version.description || ''}
				>
					{version.name}
				</div>
			{/each}
		{/each}
	</div>

	<!-- Body -->
	<div class="matrix-body">
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
					></div>
				{/each}
			{/each}
		</div>

		{#if visibleFeatures.length === 0}
			<div class="empty-state">No features yet</div>
		{:else}
			{#each visibleFeatures as { feature, depth } (feature.id)}
				{@const hasChildren = feature.children && feature.children.length > 0}
				{@const isLeaf = !hasChildren}
				{@const isSelected = selectedId === feature.id}
				<div class="matrix-row" class:is-group={hasChildren} class:is-leaf={isLeaf} class:is-selected={isSelected}>
					<FeatureRow
						{feature}
						{depth}
						isSelected={selectedId === feature.id}
						isExpanded={expandedIds.has(feature.id)}
						showTrack={isLeaf && !!feature.target_version_id}
						{onSelect}
						onToggle={toggleExpand}
					/>

					<!-- Version cells -->
					{#each groupedVersions as group, groupIndex}
						{#each group.versions as version, versionIndex}
							{@const isTarget = isLeaf && feature.target_version_id === version.id}
							{@const targetIdx = getVersionFlatIndex(feature.target_version_id)}
							{@const currentIdx = getFlatIndex(groupIndex, versionIndex)}
							{@const showTrack = isLeaf && targetIdx >= 0 && currentIdx < targetIdx}
							{@const isDropZone = dragHover?.featureId === feature.id && dragHover?.versionId === version.id && !isTarget}
							<div
								class="version-cell"
								class:group-start={versionIndex === 0}
								class:show-track={showTrack}
								class:has-dot={isTarget}
								class:drop-zone={isDropZone}
								class:zebra={currentIdx % 2 === 0}
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
								{#if isDropZone}
									<span class="drop-indicator">
										<StateIcon state={feature.state} size={14} />
									</span>
								{/if}
							</div>
						{/each}
					{/each}
				</div>
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
	}

	.matrix-header {
		display: flex;
		height: 36px;
		background: var(--background-subtle);
		border-bottom: 1px solid var(--border-default);
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
		flex: 0 0 280px;
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
	}

	.group-header:last-child {
		border-right: 1px solid var(--border-default);
	}

	.group-label {
		font-weight: 600;
		color: var(--foreground);
	}

	.matrix-subheader {
		display: flex;
		height: 27px;
		background: var(--background);
		border-bottom: 1px solid var(--border-default);
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
		flex: 0 0 280px;
		min-width: 200px;
	}

	.version-name {
		flex: 0 0 80px;
		justify-content: center;
		border-left: 1px solid var(--border-subtle);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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

	.matrix-body {
		flex: 1;
		overflow: auto;
		position: relative;
	}

	.column-backgrounds {
		position: absolute;
		top: 0;
		left: 0;
		bottom: 0;
		display: flex;
		pointer-events: none;
	}

	.col-bg {
		height: 100%;
	}

	.col-bg.feature-col {
		width: 280px;
		min-width: 200px;
	}

	.col-bg.version-col {
		width: 80px;
		border-left: 1px solid color-mix(in srgb, var(--border-subtle) 40%, transparent);
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
		width: fit-content;
	}

	.matrix-row:hover {
		background: var(--background-muted);
	}

	.matrix-row.is-selected {
		background: var(--background-muted);
	}

	.version-cell {
		flex: 0 0 80px;
		min-height: 25px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-left: 1px solid color-mix(in srgb, var(--border-subtle) 40%, transparent);
		position: relative;
	}

	.version-cell.group-start {
		border-left: 1px solid var(--border-default);
	}

	.version-cell:last-child {
		border-right: 1px solid var(--border-default);
	}

	.version-cell.show-track::before,
	.version-cell.has-dot::before {
		content: '';
		position: absolute;
		top: 50%;
		left: -1px;
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
