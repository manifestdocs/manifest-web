<script lang="ts">
	import type { components } from '$lib/api/schema.js';
	import { StateIcon } from '$lib/components/icons/index.js';

	type FeatureState = components['schemas']['FeatureState'];

	interface Props {
		featureId: string;
		featureState?: FeatureState;
		onDrop: (featureId: string, newVersionId: string | null) => void;
		onHover?: (featureId: string, versionId: string | null) => void;
	}

	let { featureId, featureState = 'implemented', onDrop, onHover }: Props = $props();

	const isDraggable = $derived(featureState === 'proposed');

	let isDragging = $state(false);
	let dragX = $state(0);
	let rowY = $state(0);
	let ghostElement: HTMLElement | null = $state(null);
	let lastHoveredVersion: string | null = $state(null);

	function handlePointerDown(e: PointerEvent) {
		if (!isDraggable) return;
		e.preventDefault();
		e.stopPropagation();
		isDragging = true;
		dragX = e.clientX;

		// Lock Y to the ghost's center position
		if (ghostElement) {
			const rect = ghostElement.getBoundingClientRect();
			rowY = rect.top + rect.height / 2;
		}

		(e.target as HTMLElement).setPointerCapture(e.pointerId);

		// Initial hover detection
		detectHoveredVersion();
	}

	function detectHoveredVersion() {
		const elements = document.elementsFromPoint(dragX, rowY);
		const cell = elements.find((el) => el.hasAttribute('data-version-id'));
		const hoveredVersion = cell?.getAttribute('data-version-id') ?? null;

		if (hoveredVersion !== lastHoveredVersion) {
			lastHoveredVersion = hoveredVersion;
			onHover?.(featureId, hoveredVersion);
		}
	}

	function handlePointerMove(e: PointerEvent) {
		if (!isDragging) return;
		dragX = e.clientX;
		detectHoveredVersion();
	}

	function handlePointerUp(e: PointerEvent) {
		if (!isDragging) return;

		// Find target column at current drag position
		const elements = document.elementsFromPoint(dragX, rowY);
		const cell = elements.find((el) => el.hasAttribute('data-version-id'));
		const newVersionId = cell?.getAttribute('data-version-id') ?? null;

		// Reset state
		isDragging = false;
		lastHoveredVersion = null;
		(e.target as HTMLElement).releasePointerCapture(e.pointerId);

		// Clear hover state
		onHover?.(featureId, null);

		// Call callback
		if (newVersionId !== null) {
			onDrop(featureId, newVersionId);
		}
	}
</script>

<!-- Ghost (original position, faded when dragging) -->
<span
	bind:this={ghostElement}
	class="ghost"
	class:dragging={isDragging}
	class:draggable={isDraggable}
	role={isDraggable ? 'button' : undefined}
	tabindex={isDraggable ? 0 : undefined}
	aria-label={isDraggable ? 'Drag to change target version' : undefined}
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
	onpointercancel={handlePointerUp}
>
	<StateIcon state={featureState} size={14} />
</span>

<!-- Drag preview (follows cursor horizontally, locked to row) -->
{#if isDragging}
	<span
		class="preview"
		style:left="{dragX}px"
		style:top="{rowY}px"
	>
		<StateIcon state={featureState} size={16} />
	</span>
{/if}

<style>
	.ghost {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		touch-action: none;
		transition: opacity 0.1s ease, filter 0.1s ease;
	}

	.ghost.draggable {
		cursor: grab;
	}

	.ghost.draggable:hover {
		filter: brightness(1.2);
	}

	.ghost.dragging {
		opacity: 0.3;
		cursor: grabbing;
	}

	.preview {
		position: fixed;
		z-index: 1000;
		pointer-events: none;
		transform: translate(-50%, -50%);
	}

	.preview :global(svg path),
	.preview :global(svg circle) {
		stroke: white;
		stroke-width: 3px;
		paint-order: stroke fill;
	}
</style>
