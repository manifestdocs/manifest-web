<script lang="ts">
	import type { components } from '$lib/api/schema.js';
	import { FeatureTree, FeatureTreeActions, type RowContext } from '$lib/components/features/index.js';
	import { findFeature } from '$lib/components/features/featureTreeUtils.js';
	import { StateIcon, PlusIcon } from '$lib/components/icons/index.js';
	import { InfoBanner, ResizeDivider } from '$lib/components/ui/index.js';
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
		onCreateVersion: (name: string) => Promise<void>;
		onUpdateFeatureVersion?: (featureId: string, versionId: string | null) => Promise<void>;
		onCompleteVersion?: (versionId: string) => Promise<void>;
		onResize?: (deltaX: number) => void;
		onReparent?: (featureId: string, newParentId: string | null) => void;
		onAddFeature?: (parentId: string | null) => void;
		onArchiveFeature?: (id: string, title: string, isGroup: boolean, childCount: number, parentId: string | null) => void;
		onRestoreFeature?: (id: string) => Promise<void>;
		onDeleteFeature?: (id: string) => Promise<void>;
	}

	let { features, versions, selectedId, projectId, featureColumnWidth = 350, onSelect, onCreateVersion, onUpdateFeatureVersion, onCompleteVersion, onResize, onReparent, onAddFeature, onArchiveFeature, onRestoreFeature, onDeleteFeature }: Props = $props();

	// Reference to FeatureTree for controlling state
	let featureTreeRef = $state<ReturnType<typeof FeatureTree> | null>(null);

	let showCreateDialog = $state(false);
	let isCompleting = $state(false);
	let closingVersionId = $state<string | null>(null);

	// Drag state for version drop zone indicator
	let dragHover = $state<{ featureId: string; versionId: string } | null>(null);

	// Track showProposedOnly from FeatureTree
	let showProposedOnly = $state(false);

	// Compute suggested next version name from existing versions
	function getNextVersionName(versions: Version[]): string {
		if (versions.length === 0) return '0.1.0';

		const parsed = versions
			.map(v => {
				const match = v.name.match(/^v?(\d+)\.(\d+)\.(\d+)/);
				if (!match) return null;
				return {
					major: parseInt(match[1], 10),
					minor: parseInt(match[2], 10),
					patch: parseInt(match[3], 10)
				};
			})
			.filter((v): v is { major: number; minor: number; patch: number } => v !== null);

		if (parsed.length === 0) return '';

		const highest = parsed.reduce((max, v) => {
			if (v.major > max.major) return v;
			if (v.major === max.major && v.minor > max.minor) return v;
			if (v.major === max.major && v.minor === max.minor && v.patch > max.patch) return v;
			return max;
		});

		return `${highest.major}.${highest.minor + 1}.0`;
	}

	const suggestedVersionName = $derived(getNextVersionName(versions));

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

		const versionToClose = nowVersion.id;
		closingVersionId = versionToClose;

		setTimeout(async () => {
			if (onCompleteVersion) {
				isCompleting = true;
				try {
					await onCompleteVersion(versionToClose);
				} catch (error) {
					console.error('Failed to complete version:', error);
					closingVersionId = null;
				} finally {
					isCompleting = false;
				}
			} else {
				closingVersionId = null;
			}
		}, 400);
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
		dragHover = null;
		const feature = findFeature(features, featureId);
		if (!feature) return;

		if (feature.target_version_id === newVersionId) return;

		if (onUpdateFeatureVersion) {
			try {
				await onUpdateFeatureVersion(featureId, newVersionId);
			} catch (error) {
				console.error('Failed to update feature version:', error);
			}
		}
	}

	// FeatureTree action handlers
	function handleAddFeatureFromActions() {
		onAddFeature?.(null);
	}

	function handleToggleFilter() {
		featureTreeRef?.toggleFilter();
		showProposedOnly = featureTreeRef?.isShowingProposedOnly() ?? false;
	}

	function handleExpandAll() {
		featureTreeRef?.expandAll();
	}

	function handleCollapseAll() {
		featureTreeRef?.collapseAll();
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
		<div class="header-cell feature-header">
			<span class="feature-title">Feature Tree</span>
		</div>

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
		<button
			type="button"
			class="add-version-btn"
			onclick={() => (showCreateDialog = true)}
			title="Add version"
		>
			<PlusIcon size={14} />
		</button>
	</div>

	<!-- Sub-header with version names -->
	<div class="matrix-subheader" class:has-complete-banner={isNowFeatureComplete && onCompleteVersion}>
		<div class="subheader-cell feature-subheader">
			<FeatureTreeActions
				{showProposedOnly}
				showAddButton={!!onAddFeature}
				onAddFeature={handleAddFeatureFromActions}
				onToggleFilter={handleToggleFilter}
				onExpandAll={handleExpandAll}
				onCollapseAll={handleCollapseAll}
			/>
		</div>
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

	<!-- Body - contains FeatureTree with version cells via rowExtras -->
	<div class="matrix-body">
		<!-- Full-height column backgrounds (sticky to fill viewport) -->
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

		<div class="matrix-body-inner">
		<FeatureTree
			bind:this={featureTreeRef}
			{features}
			{selectedId}
			{projectId}
			{featureColumnWidth}
			showHeader={false}
			scrollable={false}
			class="matrix-tree"
			{onSelect}
			{onReparent}
			{onAddFeature}
			{onArchiveFeature}
			{onRestoreFeature}
			{onDeleteFeature}
		>
			{#snippet rowExtras(ctx: RowContext)}
				{@const feature = ctx.feature}
				{@const hasChildren = ctx.hasChildren}
				{#each groupedVersions as group, groupIndex}
					{#each group.versions as version, versionIndex}
						{@const isTarget = feature.target_version_id === version.id}
						{@const targetIdx = getVersionFlatIndex(feature.target_version_id)}
						{@const currentIdx = getFlatIndex(groupIndex, versionIndex)}
						{@const showTrack = !hasChildren && targetIdx >= 0 && currentIdx < targetIdx}
						{@const isVersionDropZone = dragHover?.featureId === feature.id && dragHover?.versionId === version.id && !isTarget}
						<div
							class="version-cell"
							class:show-track={showTrack}
							class:has-dot={isTarget && !hasChildren}
							class:drop-zone={isVersionDropZone}
							class:closing={version.id === closingVersionId}
							data-version-id={version.id}
						>
							{#if isTarget && !hasChildren}
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
			{/snippet}
		</FeatureTree>
		</div>
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
	suggestedName={suggestedVersionName}
/>

<style>
	.matrix-container {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
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
		align-items: center;
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
		align-self: stretch;
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
		align-self: stretch;
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

	.group-header:has(+ .add-version-btn) {
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
		justify-content: flex-end;
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

	.add-version-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		margin-left: 8px;
		background: var(--background);
		border: 1px solid var(--border-default);
		border-radius: 2px;
		color: var(--foreground-muted);
		cursor: pointer;
		transition: all 0.15s ease;
		flex-shrink: 0;
	}

	.add-version-btn:hover {
		background: var(--background-emphasis);
		color: var(--foreground);
		border-color: var(--foreground-subtle);
	}

	.matrix-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		padding-bottom: 48px;
		position: relative;
	}

	.column-backgrounds {
		position: sticky;
		top: 0;
		height: 100vh;
		margin-bottom: -100vh;
		display: flex;
		pointer-events: none;
		overflow: hidden;
		z-index: 0;
	}

	.matrix-body-inner {
		position: relative;
		z-index: 1;
	}

	.col-bg {
		flex-shrink: 0;
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

	/* Style FeatureTree within matrix */
	.matrix-body-inner :global(.matrix-tree) {
		grid-row: 1;
		grid-column: 1;
		z-index: 1;
	}

	.matrix-body :global(.tree-scroll-container) {
		position: static;
		overflow: visible;
	}

	.matrix-body :global(.tree-content) {
		position: static;
		overflow: visible;
	}

	.matrix-body :global(.tree-row) {
		position: relative;
		overflow: hidden;
		height: 28px;
		min-height: 28px;
		flex-shrink: 0;
	}

	.matrix-body :global(.tree-row:hover) {
		background: var(--background-muted);
	}

	.matrix-body :global(.tree-row.selected) {
		background: color-mix(in srgb, var(--background-emphasis) 33%, transparent);
	}

	.version-cell {
		flex: 0 0 80px;
		min-height: 28px;
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

	.drop-indicator {
		opacity: 0.5;
	}

	.version-cell.drop-zone {
		background: rgba(59, 130, 246, 0.08);
	}

	.matrix-legend {
		display: flex;
		flex-shrink: 0;
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
