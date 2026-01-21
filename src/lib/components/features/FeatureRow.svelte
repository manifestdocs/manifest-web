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
		hasFutureWork?: boolean;
		isDraggable?: boolean;
		isDragging?: boolean;
		isDropTarget?: boolean;
		isDropHovered?: boolean;
		onSelect: (id: string) => void;
		onToggle: (id: string) => void;
		onContextMenu?: (id: string, x: number, y: number) => void;
		onDragStart?: (featureId: string) => void;
		onDragHover?: (targetId: string | null) => void;
		onDragEnd?: () => void;
		onDrop?: (featureId: string, newParentId: string | null) => void;
	}

	let {
		feature,
		depth,
		isSelected,
		isExpanded,
		showTrack = false,
		hasFutureWork = false,
		isDraggable = false,
		isDragging = false,
		isDropTarget = false,
		isDropHovered = false,
		onSelect,
		onToggle,
		onContextMenu,
		onDragStart,
		onDragHover,
		onDragEnd,
		onDrop
	}: Props = $props();

	const hasChildren = $derived(feature.children && feature.children.length > 0);
	const isRoot = $derived(feature.is_root ?? false);

	// Local drag state
	let isLocalDragging = $state(false);
	let dragX = $state(0);
	let dragY = $state(0);
	let rowElement = $state<HTMLElement | null>(null);

	function handleToggleClick(e: MouseEvent) {
		e.stopPropagation();
		onToggle(feature.id);
	}

	function handleContextMenu(e: MouseEvent) {
		e.preventDefault();
		onContextMenu?.(feature.id, e.clientX, e.clientY);
	}

	function handlePointerDown(e: PointerEvent) {
		if (!isDraggable) return;
		e.preventDefault();
		e.stopPropagation();

		isLocalDragging = true;
		dragX = e.clientX;
		dragY = e.clientY;

		(e.target as HTMLElement).setPointerCapture(e.pointerId);
		onDragStart?.(feature.id);
		detectDropTarget(e.clientX, e.clientY);
	}

	function detectDropTarget(clientX: number, clientY: number) {
		const elements = document.elementsFromPoint(clientX, clientY);

		// Check for group/root drop target (exclude self and current parent)
		const groupTarget = elements.find((el) => {
			const targetId = el.getAttribute('data-feature-group-id');
			return targetId && targetId !== feature.id && targetId !== feature.parent_id;
		});
		if (groupTarget) {
			const targetId = groupTarget.getAttribute('data-feature-group-id');
			onDragHover?.(targetId);
		} else {
			onDragHover?.(null);
		}
	}

	function handlePointerMove(e: PointerEvent) {
		if (!isLocalDragging) return;
		dragX = e.clientX;
		dragY = e.clientY;
		detectDropTarget(e.clientX, e.clientY);
	}

	function handlePointerUp(e: PointerEvent) {
		if (!isLocalDragging) return;

		// Find the drop target
		const elements = document.elementsFromPoint(e.clientX, e.clientY);

		// Check for group/root drop target (exclude self and current parent)
		const groupTarget = elements.find((el) => {
			const targetId = el.getAttribute('data-feature-group-id');
			return targetId && targetId !== feature.id && targetId !== feature.parent_id;
		});
		if (groupTarget) {
			const targetId = groupTarget.getAttribute('data-feature-group-id');
			if (targetId) {
				onDrop?.(feature.id, targetId);
			}
		}

		// Reset state
		isLocalDragging = false;
		(e.target as HTMLElement).releasePointerCapture(e.pointerId);
		onDragHover?.(null);
		onDragEnd?.();
	}
</script>

<button
	type="button"
	class="feature-row"
	class:selected={isSelected}
	class:is-root={isRoot}
	style="padding-left: {depth * 16 + (isRoot ? 8 : 13)}px"
	bind:this={rowElement}
	onclick={() => onSelect(feature.id)}
	oncontextmenu={handleContextMenu}
>
	{#if isDraggable && !isRoot}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<span
			class="drag-handle"
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={handlePointerUp}
			onpointercancel={handlePointerUp}
		>
			<svg width="12" height="12" viewBox="0 0 16 16" fill="none">
				<circle cx="6" cy="4" r="1.5" fill="currentColor" />
				<circle cx="10" cy="4" r="1.5" fill="currentColor" />
				<circle cx="6" cy="8" r="1.5" fill="currentColor" />
				<circle cx="10" cy="8" r="1.5" fill="currentColor" />
				<circle cx="6" cy="12" r="1.5" fill="currentColor" />
				<circle cx="10" cy="12" r="1.5" fill="currentColor" />
			</svg>
		</span>
	{/if}
	{#if isRoot}
		<!-- Root feature: no icon, just title -->
	{:else if hasChildren}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<span
			class="toggle-btn"
			onclick={handleToggleClick}
		>
			<svg class="chevron" class:expanded={isExpanded} width="14" height="14" viewBox="0 0 16 16" fill="none">
				<path d="M6 4L10 8L6 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</span>
		<GroupIcon size={14} />
	{:else}
		<span class="toggle-spacer"></span>
		<StateIcon state={feature.state} size={14} />
	{/if}
	<span class="feature-title">{feature.title}</span>
	{#if hasChildren && hasFutureWork}
		<span class="future-work-indicator" title="Has incomplete work">
			<svg width="10" height="10" viewBox="0 0 16 16" fill="none">
				<path d="M8 2L14 8L8 14L2 8Z" fill="var(--state-proposed)" />
			</svg>
		</span>
	{/if}
	{#if feature.desired_details}
		<span class="pending-indicator" title="Has proposed changes"></span>
	{/if}
	{#if showTrack}
		<span class="track"></span>
	{/if}
</button>

<!-- Drag preview (follows cursor) -->
{#if isLocalDragging}
	<div class="drag-preview" style:left="{dragX}px" style:top="{dragY}px">
		<span class="preview-content">
			{#if hasChildren}
				<GroupIcon size={14} />
			{:else}
				<StateIcon state={feature.state} size={14} />
			{/if}
			<span class="preview-title">{feature.title}</span>
		</span>
	</div>
{/if}

<style>
	.feature-row {
		position: relative;
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
		transition: background-color 0.1s ease, opacity 0.1s ease;
	}

	.feature-row:hover {
		background: var(--background-muted);
	}

	.feature-row.selected {
		background: var(--background-emphasis);
	}

	.feature-row.is-root {
		background: var(--background-subtle);
		border-bottom: 1px solid var(--border-default);
	}

	.feature-row.is-root:hover {
		background: var(--background-muted);
	}

	.feature-row.is-root.selected {
		background: var(--background-emphasis);
	}

	.drag-handle {
		position: absolute;
		left: 4px;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 12px;
		height: 16px;
		color: var(--foreground-subtle);
		opacity: 0;
		cursor: grab;
		touch-action: none;
		transition: opacity 0.1s ease;
	}

	.feature-row:hover .drag-handle {
		opacity: 0.5;
	}

	.drag-handle:hover {
		opacity: 1 !important;
		color: var(--foreground);
	}

	.toggle-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
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

	.future-work-indicator {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.track {
		flex: 1;
		height: 1px;
		border-top: 1px dashed var(--border-default);
		margin-left: 8px;
		align-self: center;
	}

	.drag-preview {
		position: fixed;
		transform: translateY(-50%);
		z-index: 1000;
		pointer-events: none;
	}

	.preview-content {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 12px;
		background: var(--background);
		border: 1px solid var(--border-default);
		border-radius: 4px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		font-size: 13px;
	}

	.preview-title {
		color: var(--foreground);
		white-space: nowrap;
	}
</style>
