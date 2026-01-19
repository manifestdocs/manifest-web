<script lang="ts">
	import type { components } from '$lib/api/schema.js';

	type FeatureState = components['schemas']['FeatureState'];

	interface Props {
		featureId: string;
		featureState?: FeatureState;
		onDrop: (featureId: string, newVersionId: string | null) => void;
		onHover?: (featureId: string, versionId: string | null) => void;
	}

	let { featureId, featureState = 'implemented', onDrop, onHover }: Props = $props();

	const isDiamond = $derived(featureState === 'proposed');

	let isDragging = $state(false);
	let dragX = $state(0);
	let rowY = $state(0);
	let ghostElement: HTMLElement | null = $state(null);
	let lastHoveredVersion: string | null = $state(null);

	function handlePointerDown(e: PointerEvent) {
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
	class="marker ghost"
	class:diamond={isDiamond}
	class:dragging={isDragging}
	role="button"
	tabindex="0"
	aria-label="Drag to change target version"
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
	onpointercancel={handlePointerUp}
></span>

<!-- Drag preview (follows cursor horizontally, locked to row) -->
{#if isDragging}
	<span
		class="marker preview"
		class:diamond={isDiamond}
		style:left="{dragX}px"
		style:top="{rowY}px"
	></span>
{/if}

<style>
	.marker {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent-blue);
		cursor: grab;
		touch-action: none;
	}

	.marker.diamond {
		border-radius: 0;
		transform: rotate(45deg);
		background: var(--state-proposed);
	}

	.marker.ghost {
		position: relative;
		z-index: 1;
		transition: opacity 0.1s ease, box-shadow 0.1s ease;
	}

	.marker.ghost:hover {
		box-shadow: 0 0 0 2px white;
	}

	.marker.ghost.dragging {
		opacity: 0.3;
		cursor: grabbing;
	}

	.marker.preview {
		position: fixed;
		z-index: 1000;
		pointer-events: none;
		width: 12px;
		height: 12px;
		box-shadow: 0 0 0 2px white;
		transform: translate(-50%, -50%);
	}

	.marker.preview.diamond {
		border-radius: 0;
		transform: translate(-50%, -50%) rotate(45deg);
	}
</style>
