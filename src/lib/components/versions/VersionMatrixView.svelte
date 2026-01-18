<script lang="ts">
	import type { components } from '$lib/api/schema.js';
	import { FeatureTree } from '$lib/components/features/index.js';
	import { StateIcon } from '$lib/components/icons/index.js';
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

	// Group versions into Now, Next, Later
	type VersionGroup = {
		label: string;
		versions: Version[];
	};

	let groupedVersions = $derived.by(() => {
		const groups: VersionGroup[] = [];
		const unreleased = versions.filter((v) => !v.released_at);

		// Now: first unreleased version
		if (unreleased.length > 0) {
			groups.push({ label: 'Now', versions: [unreleased[0]] });
		}

		// Next: second unreleased version
		if (unreleased.length > 1) {
			groups.push({ label: 'Next', versions: [unreleased[1]] });
		}

		// Later: remaining unreleased versions
		if (unreleased.length > 2) {
			groups.push({ label: 'Later', versions: unreleased.slice(2) });
		}

		return groups;
	});

	// Flatten all features to find ones targeting each version
	function getAllFeatures(nodes: FeatureTreeNode[]): FeatureTreeNode[] {
		const result: FeatureTreeNode[] = [];
		for (const node of nodes) {
			result.push(node);
			if (node.children && node.children.length > 0) {
				result.push(...getAllFeatures(node.children));
			}
		}
		return result;
	}

	let allFeatures = $derived(getAllFeatures(features));

	function getFeaturesForVersion(versionId: string): FeatureTreeNode[] {
		return allFeatures.filter((f) => f.target_version_id === versionId);
	}

	// Get unassigned specified/proposed features (not implemented, not deprecated, no version)
	let unassignedFeatures = $derived(
		allFeatures.filter(
			(f) =>
				!f.target_version_id &&
				f.state !== 'implemented' &&
				f.state !== 'deprecated' &&
				(!f.children || f.children.length === 0)
		)
	);
</script>

<div class="nnl-container">
	<!-- Left: Feature Tree -->
	<aside class="feature-sidebar">
		<FeatureTree {features} {selectedId} {onSelect} />
	</aside>

	<!-- Right: Version Panels -->
	<div class="version-panels">
		{#if groupedVersions.length === 0 && unassignedFeatures.length === 0}
			<div class="empty-state">
				<p>No versions yet</p>
				<button class="create-btn" onclick={() => (showCreateDialog = true)} type="button">
					Create first version
				</button>
			</div>
		{:else}
			{#each groupedVersions as group}
				<div class="version-group">
					<div class="group-header">
						<span class="group-label">{group.label}</span>
					</div>
					<div class="group-content">
						{#each group.versions as version}
							{@const versionFeatures = getFeaturesForVersion(version.id)}
							<div class="version-panel">
								<div class="version-header">
									<span class="version-name">{version.name}</span>
									{#if version.description}
										<span class="version-desc">{version.description}</span>
									{/if}
								</div>
								<div class="version-features">
									{#if versionFeatures.length === 0}
										<span class="no-features">No features assigned</span>
									{:else}
										{#each versionFeatures as feature}
											<button
												type="button"
												class="feature-item"
												class:selected={selectedId === feature.id}
												onclick={() => onSelect(feature.id)}
											>
												<StateIcon state={feature.state} size={14} />
												<span class="feature-name">{feature.title}</span>
											</button>
										{/each}
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}

			<!-- Unassigned features -->
			{#if unassignedFeatures.length > 0}
				<div class="version-group unassigned">
					<div class="group-header">
						<span class="group-label">Unassigned</span>
					</div>
					<div class="group-content">
						<div class="version-panel">
							<div class="version-features">
								{#each unassignedFeatures as feature}
									<button
										type="button"
										class="feature-item"
										class:selected={selectedId === feature.id}
										onclick={() => onSelect(feature.id)}
									>
										<StateIcon state={feature.state} size={14} />
										<span class="feature-name">{feature.title}</span>
									</button>
								{/each}
							</div>
						</div>
					</div>
				</div>
			{/if}

			<button class="add-version-btn" onclick={() => (showCreateDialog = true)} type="button">
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
					<path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
				</svg>
				<span>Add Version</span>
			</button>
		{/if}
	</div>
</div>

<CreateVersionDialog
	open={showCreateDialog}
	onOpenChange={(open) => (showCreateDialog = open)}
	onCreate={onCreateVersion}
/>

<style>
	.nnl-container {
		display: flex;
		height: 100%;
		overflow: hidden;
	}

	.feature-sidebar {
		width: 280px;
		min-width: 200px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		background: var(--background-subtle);
		border-right: 1px solid var(--border-default);
		overflow: auto;
	}

	.version-panels {
		flex: 1;
		display: flex;
		gap: 0;
		overflow-x: auto;
		overflow-y: auto;
		background: var(--background);
		align-items: flex-start;
		padding: 16px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		gap: 16px;
		color: var(--foreground-subtle);
	}

	.empty-state p {
		margin: 0;
		font-size: 14px;
	}

	.create-btn {
		padding: 8px 16px;
		font-size: 13px;
		font-weight: 500;
		color: var(--foreground);
		background: var(--background-muted);
		border: 1px solid var(--border-default);
		border-radius: 6px;
		cursor: pointer;
	}

	.create-btn:hover {
		background: var(--background-subtle);
		border-color: var(--foreground-subtle);
	}

	.version-group {
		display: flex;
		flex-direction: column;
		min-width: 200px;
		border-right: 1px solid var(--border-default);
	}

	.version-group:last-of-type {
		border-right: none;
	}

	.version-group.unassigned {
		opacity: 0.7;
	}

	.group-header {
		padding: 12px 16px;
		border-bottom: 1px solid var(--border-default);
		background: var(--background-subtle);
	}

	.group-label {
		font-size: 14px;
		font-weight: 600;
		color: var(--foreground);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.group-content {
		display: flex;
		flex-direction: column;
	}

	.version-panel {
		padding: 12px 16px;
	}

	.version-header {
		margin-bottom: 12px;
	}

	.version-name {
		font-size: 13px;
		font-weight: 500;
		color: var(--foreground-muted);
	}

	.version-desc {
		display: block;
		font-size: 11px;
		color: var(--foreground-subtle);
		margin-top: 2px;
	}

	.version-features {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.no-features {
		font-size: 12px;
		color: var(--foreground-subtle);
		font-style: italic;
	}

	.feature-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		font-size: 13px;
		color: var(--foreground);
		background: transparent;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		text-align: left;
		transition: background-color 0.1s ease;
	}

	.feature-item:hover {
		background: var(--background-muted);
	}

	.feature-item.selected {
		background: var(--background-emphasis);
	}

	.feature-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.add-version-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		margin: 12px 16px;
		font-size: 12px;
		font-weight: 500;
		color: var(--foreground-subtle);
		background: transparent;
		border: 1px dashed var(--border-default);
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s ease;
		flex-shrink: 0;
	}

	.add-version-btn:hover {
		color: var(--foreground);
		border-color: var(--foreground-subtle);
		background: var(--background-muted);
	}
</style>
