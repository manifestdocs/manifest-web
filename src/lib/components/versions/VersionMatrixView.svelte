<script lang="ts">
	import type { components } from '$lib/api/schema.js';
	import { GroupIcon, StateIcon } from '$lib/components/icons/index.js';
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

	let showCreateDialog = $state(false);
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
</script>

<div class="matrix-container">
	<!-- Header -->
	<div class="matrix-header">
		<!-- Feature column header -->
		<div class="header-cell feature-header">
			<span>Features</span>
		</div>

		<!-- Version group headers -->
		{#each groupedVersions as group}
			<div class="header-cell group-header" style="flex: 0 0 {group.versions.length * 80}px">
				<span class="group-label">{group.label}</span>
			</div>
		{/each}

		<div class="header-cell add-header">
			<button class="add-btn" onclick={() => (showCreateDialog = true)} type="button" title="Add version">
				<svg width="12" height="12" viewBox="0 0 16 16" fill="none">
					<path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
				</svg>
			</button>
		</div>
	</div>

	<!-- Sub-header with version names -->
	<div class="matrix-subheader">
		<div class="subheader-cell feature-subheader"></div>
		{#each groupedVersions as group}
			{#each group.versions as version}
				<div class="subheader-cell version-name" title={version.description || ''}>
					{version.name}
				</div>
			{/each}
		{/each}
		<div class="subheader-cell add-subheader"></div>
	</div>

	<!-- Body -->
	<div class="matrix-body">
		{#if visibleFeatures.length === 0}
			<div class="empty-state">No features yet</div>
		{:else}
			{#each visibleFeatures as { feature, depth } (feature.id)}
				{@const hasChildren = feature.children && feature.children.length > 0}
				{@const isExpanded = expandedIds.has(feature.id)}
				{@const isLeaf = !hasChildren}
				<div class="matrix-row" class:is-group={hasChildren}>
					<!-- Feature cell -->
					<button
						type="button"
						class="feature-cell"
						class:selected={selectedId === feature.id}
						style="padding-left: {depth * 16 + 8}px"
						onclick={() => onSelect(feature.id)}
					>
						{#if hasChildren}
							<button
								type="button"
								class="toggle-btn"
								onclick={(e) => { e.stopPropagation(); toggleExpand(feature.id); }}
							>
								<svg class="chevron" class:expanded={isExpanded} width="14" height="14" viewBox="0 0 16 16" fill="none">
									<path d="M6 4L10 8L6 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							</button>
							<GroupIcon size={14} />
						{:else}
							<span class="toggle-spacer"></span>
							<StateIcon state={feature.state} size={14} />
						{/if}
						<span class="feature-title">{feature.title}</span>
					</button>

					<!-- Version cells -->
					{#each groupedVersions as group}
						{#each group.versions as version}
							<div class="version-cell" class:targeted={isLeaf && feature.target_version_id === version.id}>
								{#if isLeaf && feature.target_version_id === version.id}
									<span class="dot"></span>
								{/if}
							</div>
						{/each}
					{/each}

					<div class="add-cell"></div>
				</div>
			{/each}
		{/if}
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
		background: var(--background-subtle);
		border-bottom: 1px solid var(--border-default);
	}

	.header-cell {
		padding: 10px 12px;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--foreground-muted);
	}

	.feature-header {
		flex: 0 0 280px;
		min-width: 200px;
	}

	.group-header {
		display: flex;
		align-items: center;
		justify-content: center;
		border-left: 1px solid var(--border-default);
	}

	.group-label {
		font-weight: 600;
		color: var(--foreground);
	}

	.add-header {
		flex: 1;
		min-width: 40px;
		display: flex;
		align-items: center;
		justify-content: flex-start;
		padding-left: 8px;
		border-left: 1px solid var(--border-default);
	}

	.add-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		color: var(--foreground-subtle);
		background: transparent;
		border: 1px dashed var(--border-default);
		border-radius: 4px;
		cursor: pointer;
	}

	.add-btn:hover {
		color: var(--foreground);
		border-color: var(--foreground-subtle);
		background: var(--background-muted);
	}

	.matrix-subheader {
		display: flex;
		background: var(--background);
		border-bottom: 1px solid var(--border-default);
	}

	.subheader-cell {
		padding: 6px 12px;
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
		text-align: center;
		border-left: 1px solid var(--border-default);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.add-subheader {
		flex: 1;
		min-width: 40px;
		border-left: 1px solid var(--border-default);
	}

	.matrix-body {
		flex: 1;
		overflow: auto;
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
	}

	.matrix-row.is-group {
		background: var(--background-subtle);
	}

	.feature-cell {
		flex: 0 0 280px;
		min-width: 200px;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 8px;
		font-size: 13px;
		color: var(--foreground);
		background: transparent;
		border: none;
		cursor: pointer;
		text-align: left;
	}

	.feature-cell:hover {
		background: var(--background-muted);
	}

	.feature-cell.selected {
		background: var(--background-emphasis);
	}

	.toggle-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		padding: 0;
		border: none;
		background: transparent;
		cursor: pointer;
		color: var(--foreground-subtle);
	}

	.toggle-btn:hover {
		color: var(--foreground);
	}

	.toggle-spacer {
		width: 16px;
		flex-shrink: 0;
	}

	.chevron {
		transition: transform 0.15s ease;
	}

	.chevron.expanded {
		transform: rotate(90deg);
	}

	.feature-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.version-cell {
		flex: 0 0 80px;
		min-height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-left: 1px solid var(--border-subtle);
	}

	.version-cell.targeted {
		background: var(--background-emphasis);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent-blue);
	}

	.add-cell {
		flex: 1;
		min-width: 40px;
		border-left: 1px solid var(--border-subtle);
	}
</style>
