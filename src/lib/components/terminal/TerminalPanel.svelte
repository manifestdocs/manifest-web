<script lang="ts">
	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	let height = $state(50); // percentage of viewport height
	let isDragging = $state(false);

	function handleResizeStart(e: PointerEvent) {
		isDragging = true;
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}

	function handleResizeMove(e: PointerEvent) {
		if (!isDragging) return;
		const vh = window.innerHeight;
		const newHeight = ((vh - e.clientY) / vh) * 100;
		height = Math.min(90, Math.max(20, newHeight)); // Clamp between 20% and 90%
	}

	function handleResizeEnd(e: PointerEvent) {
		isDragging = false;
		(e.target as HTMLElement).releasePointerCapture(e.pointerId);
	}
</script>

{#if open}
	<div class="terminal-panel" style="height: {height}vh">
		<div class="terminal-container">
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="resize-handle"
				onpointerdown={handleResizeStart}
				onpointermove={handleResizeMove}
				onpointerup={handleResizeEnd}
				onpointercancel={handleResizeEnd}
			>
				<div class="resize-bar"></div>
			</div>
			<div class="terminal-header">
				<span class="terminal-title">Terminal</span>
				<button class="close-btn" onclick={onClose} title="Close terminal">
					<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
						<path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
					</svg>
				</button>
			</div>
			<div class="terminal-content">
				<div class="terminal-placeholder">
					<span class="placeholder-icon">
						<svg width="32" height="32" viewBox="0 0 16 16" fill="none">
							<path d="M2 4L6 8L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
							<path d="M8 12H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
						</svg>
					</span>
					<span class="placeholder-text">xterm.js terminal will render here</span>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.terminal-panel {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		z-index: 50;
		animation: slideUp 0.2s ease-out;
	}

	.terminal-container {
		width: 100%;
		min-width: 640px;
		max-width: 960px;
		height: 100%;
		display: flex;
		flex-direction: column;
		background: var(--background);
		border: 1px solid var(--border-default);
		border-bottom: none;
		border-radius: 8px 8px 0 0;
		box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.3);
		overflow: hidden;
	}

	.resize-handle {
		position: absolute;
		top: -4px;
		left: 50%;
		transform: translateX(-50%);
		width: 100%;
		max-width: 960px;
		height: 12px;
		cursor: ns-resize;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1;
	}

	.resize-bar {
		width: 48px;
		height: 4px;
		background: var(--border-default);
		border-radius: 2px;
		transition: background 0.15s ease;
	}

	.resize-handle:hover .resize-bar {
		background: var(--foreground-muted);
	}

	.terminal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		background: var(--background-subtle);
		border-bottom: 1px solid var(--border-default);
	}

	.terminal-title {
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--foreground-muted);
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--foreground-muted);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.close-btn:hover {
		background: var(--background-muted);
		color: var(--foreground);
	}

	.terminal-content {
		flex: 1;
		background: #0d1117;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.terminal-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		color: var(--foreground-subtle);
	}

	.placeholder-icon {
		opacity: 0.5;
	}

	.placeholder-text {
		font-size: 13px;
		font-family: var(--font-mono, monospace);
	}

	@keyframes slideUp {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}
</style>
