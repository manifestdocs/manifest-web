<script lang="ts">
	import type { components } from '$lib/api/schema.js';
	import { GroupIcon, StateIcon } from '$lib/components/icons/index.js';
	import FeatureTreeItem from './FeatureTreeItem.svelte';

	type FeatureTreeNode = components['schemas']['FeatureTreeNode'];

	interface Props {
		feature: FeatureTreeNode;
		selectedId: string | null;
		expandedIds: Set<string>;
		depth?: number;
		onSelect: (id: string) => void;
		onToggle: (id: string) => void;
	}

	let {
		feature,
		selectedId,
		expandedIds,
		depth = 0,
		onSelect,
		onToggle
	}: Props = $props();

	const hasChildren = $derived(feature.children && feature.children.length > 0);
	const isExpanded = $derived(expandedIds.has(feature.id));
	const isSelected = $derived(selectedId === feature.id);

	function handleRowClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		// If clicked on toggle button, don't select
		if (target.closest('.toggle-btn')) {
			return;
		}
		onSelect(feature.id);
	}

	function handleToggleClick(e: MouseEvent) {
		e.stopPropagation();
		onToggle(feature.id);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onSelect(feature.id);
		} else if (e.key === 'ArrowRight' && hasChildren && !isExpanded) {
			e.preventDefault();
			onToggle(feature.id);
		} else if (e.key === 'ArrowLeft' && hasChildren && isExpanded) {
			e.preventDefault();
			onToggle(feature.id);
		}
	}
</script>

<div class="tree-item">
	<div
		class="tree-row"
		class:selected={isSelected}
		style="padding-left: {depth * 16 + 8}px"
		onclick={handleRowClick}
		onkeydown={handleKeydown}
		tabindex="0"
		role="treeitem"
		aria-selected={isSelected}
		aria-expanded={hasChildren ? isExpanded : undefined}
	>
		{#if hasChildren}
			<button
				class="toggle-btn"
				onclick={handleToggleClick}
				type="button"
				tabindex={-1}
				aria-label={isExpanded ? 'Collapse' : 'Expand'}
			>
				<svg
					class="chevron"
					class:expanded={isExpanded}
					width="16"
					height="16"
					viewBox="0 0 16 16"
					fill="none"
				>
					<path
						d="M6 4L10 8L6 12"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
		{:else}
			<span class="toggle-spacer"></span>
		{/if}

		{#if hasChildren}
			<GroupIcon size={16} />
		{:else}
			<StateIcon state={feature.state} size={16} />
		{/if}

		<span class="title" title={feature.title}>{feature.title}</span>
	</div>

	{#if hasChildren && isExpanded}
		<div class="children" role="group">
			{#each feature.children as child (child.id)}
				<FeatureTreeItem
					feature={child}
					{selectedId}
					{expandedIds}
					depth={depth + 1}
					{onSelect}
					{onToggle}
				/>
			{/each}
		</div>
	{/if}
</div>

<style>
	.tree-item {
		user-select: none;
	}

	.tree-row {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 4px 8px;
		background: transparent;
		color: var(--foreground);
		font-size: 13px;
		text-align: left;
		cursor: pointer;
		border-radius: 6px;
		transition: background-color 0.1s ease;
	}

	.tree-row:hover {
		background: var(--background-muted);
	}

	.tree-row.selected {
		background: var(--background-emphasis);
	}

	.tree-row:focus {
		outline: none;
		background: var(--background-muted);
	}

	.tree-row:focus-visible {
		outline: 2px solid var(--accent-blue);
		outline-offset: -2px;
	}

	.toggle-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		flex-shrink: 0;
		padding: 0;
		border: none;
		background: transparent;
		cursor: pointer;
		color: inherit;
	}

	.toggle-btn:hover {
		color: var(--foreground);
	}

	.toggle-spacer {
		width: 16px;
		flex-shrink: 0;
	}

	.chevron {
		color: var(--foreground-subtle);
		transition: transform 0.15s ease;
	}

	.chevron.expanded {
		transform: rotate(90deg);
	}

	.title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}

	.children {
		margin-left: 0;
	}
</style>
