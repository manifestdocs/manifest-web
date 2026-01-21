<script lang="ts">
	import type { components } from '$lib/api/schema.js';
	import { GroupIcon, StateIcon } from '$lib/components/icons/index.js';

	type FeatureTreeNode = components['schemas']['FeatureTreeNode'];

	interface Props {
		feature: FeatureTreeNode;
		depth: number;
		isSelected: boolean;
		isExpanded: boolean;
		showTrack?: boolean;
		onSelect: (id: string) => void;
		onToggle: (id: string) => void;
		onContextMenu?: (id: string, x: number, y: number) => void;
	}

	let { feature, depth, isSelected, isExpanded, showTrack = false, onSelect, onToggle, onContextMenu }: Props = $props();

	const hasChildren = $derived(feature.children && feature.children.length > 0);

	function handleToggleClick(e: MouseEvent) {
		e.stopPropagation();
		onToggle(feature.id);
	}

	function handleContextMenu(e: MouseEvent) {
		e.preventDefault();
		onContextMenu?.(feature.id, e.clientX, e.clientY);
	}
</script>

<button
	type="button"
	class="feature-row"
	class:selected={isSelected}
	style="padding-left: {depth * 16 + 8}px"
	onclick={() => onSelect(feature.id)}
	oncontextmenu={handleContextMenu}
>
	{#if hasChildren}
		<button
			type="button"
			class="toggle-btn"
			onclick={handleToggleClick}
			aria-label={isExpanded ? 'Collapse' : 'Expand'}
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
	{#if feature.desired_details}
		<span class="pending-indicator" title="Has proposed changes"></span>
	{/if}
	{#if showTrack}
		<span class="track"></span>
	{/if}
</button>

<style>
	.feature-row {
		flex: 0 0 var(--feature-col-width, 350px);
		min-width: 200px;
		height: 25px;
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: var(--foreground);
		background: transparent;
		border: none;
		cursor: pointer;
		text-align: left;
		overflow: hidden;
	}

	.feature-row:hover {
		background: var(--background-muted);
	}

	.feature-row.selected {
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
		flex-shrink: 0;
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
		flex-shrink: 1;
		min-width: 0;
	}

	.pending-indicator {
		flex-shrink: 0;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--state-proposed);
	}

	.track {
		flex: 1;
		height: 1px;
		border-top: 1px dashed var(--border-default);
		margin-left: 8px;
		align-self: center;
	}
</style>
