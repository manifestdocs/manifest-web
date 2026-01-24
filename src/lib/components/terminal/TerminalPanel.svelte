<script lang="ts">
	import '@xterm/xterm/css/xterm.css';
	import { TerminalService, type ConnectionState } from '$lib/services/terminal';

	interface Props {
		open: boolean;
		projectId: string;
		onClose: () => void;
	}

	let { open, projectId, onClose }: Props = $props();

	let height = $state(50); // percentage of viewport height
	let isDragging = $state(false);
	let connectionState = $state<ConnectionState>('disconnected');
	let connectionMessage = $state<string | undefined>();
	let terminalContainer = $state<HTMLDivElement | null>(null);
	let terminalService: TerminalService | null = null; // Not reactive to avoid effect loops
	let currentProjectId: string | null = null; // Track which project the terminal is connected to

	function initializeTerminal() {
		if (!terminalContainer || !projectId) return;

		// Clean up existing terminal if any
		if (terminalService) {
			terminalService.dispose();
			terminalService = null;
		}

		currentProjectId = projectId;

		terminalService = new TerminalService({
			projectId,
			sessionId: crypto.randomUUID(),
			onConnectionStateChange: (state, message) => {
				connectionState = state;
				connectionMessage = message;
			}
		});

		terminalService.mount(terminalContainer);
		terminalService.connect();
	}

	function cleanupTerminal() {
		if (terminalService) {
			terminalService.dispose();
			terminalService = null;
		}
		currentProjectId = null;
		connectionState = 'disconnected';
		connectionMessage = undefined;
	}

	// Initialize when container mounts and panel is open
	$effect(() => {
		if (open && terminalContainer && projectId) {
			// Only initialize if not already connected to this project
			if (currentProjectId !== projectId) {
				initializeTerminal();
			}
		}
	});

	// Clean up when closing
	$effect(() => {
		if (!open) {
			cleanupTerminal();
		}
	});

	function handleReconnect() {
		if (terminalService) {
			terminalService.connect();
		}
	}

	function handleClear() {
		terminalService?.clear();
	}

	function handleResizeStart(e: PointerEvent) {
		isDragging = true;
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}

	function handleResizeMove(e: PointerEvent) {
		if (!isDragging) return;
		const vh = window.innerHeight;
		const newHeight = ((vh - e.clientY) / vh) * 100;
		height = Math.min(70, Math.max(20, newHeight)); // Clamp between 20% and 70%
		// Notify terminal of resize
		terminalService?.fit();
	}

	function handleResizeEnd(e: PointerEvent) {
		isDragging = false;
		(e.target as HTMLElement).releasePointerCapture(e.pointerId);
	}

	function handleClose() {
		terminalService?.dispose();
		terminalService = null;
		currentProjectId = null;
		onClose();
	}

	const statusColor = $derived.by(() => {
		switch (connectionState) {
			case 'connected':
				return 'var(--state-implemented)';
			case 'connecting':
			case 'reconnecting':
				return 'var(--state-in-progress)';
			case 'disconnected':
				return 'var(--state-deprecated)';
		}
	});

	const statusLabel = $derived.by(() => {
		switch (connectionState) {
			case 'connected':
				return 'Connected';
			case 'connecting':
				return 'Connecting...';
			case 'reconnecting':
				return 'Reconnecting...';
			case 'disconnected':
				return connectionMessage || 'Disconnected';
		}
	});
</script>

{#if open}
	<div class="terminal-panel" style="height: {height}vh">
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
		<div class="terminal-container">
			<div class="terminal-header">
				<div class="header-left">
					<span class="terminal-title">Terminal</span>
					<span class="status-indicator" style="background: {statusColor}"></span>
					<span class="status-text">{statusLabel}</span>
				</div>
				<div class="header-actions">
					{#if connectionState === 'disconnected'}
						<button class="action-btn" onclick={handleReconnect} title="Reconnect">
							<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
								<path
									d="M1.5 8a6.5 6.5 0 1 1 1.5 4.15"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linecap="round"
								/>
								<path
									d="M1 4.5V8h3.5"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						</button>
					{/if}
					<button class="action-btn" onclick={handleClear} title="Clear terminal">
						<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
							<path d="M2 4h12M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
							<path d="M13 4v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
						</svg>
					</button>
					<button class="close-btn" onclick={handleClose} title="Close terminal">
						<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
							<path
								d="M4 4L12 12M12 4L4 12"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linecap="round"
							/>
						</svg>
					</button>
				</div>
			</div>
			<div class="terminal-content" bind:this={terminalContainer}></div>
		</div>
	</div>
{/if}

<style>
	.terminal-panel {
		position: fixed;
		right: 0;
		bottom: 0;
		width: 960px;
		display: flex;
		flex-direction: column;
		z-index: 50;
		animation: slideIn 0.2s ease-out;
	}

	.resize-handle {
		width: 100%;
		height: 12px;
		cursor: ns-resize;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
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

	.terminal-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: var(--background);
		border-top: 1px solid var(--border-default);
		border-left: 1px solid var(--border-default);
		box-shadow: -4px -4px 24px rgba(0, 0, 0, 0.3);
		overflow: hidden;
	}

	.terminal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 36px;
		padding: 0 12px;
		background: var(--background-subtle);
		border-bottom: 1px solid var(--border-default);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.terminal-title {
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--foreground-muted);
	}

	.status-indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.status-text {
		font-size: 11px;
		color: var(--foreground-subtle);
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.action-btn {
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

	.action-btn:hover {
		background: var(--background-muted);
		color: var(--foreground);
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
		padding: 8px;
		overflow: hidden;
	}

	/* Override xterm.js styles to ensure proper sizing */
	.terminal-content :global(.xterm) {
		height: 100%;
	}

	.terminal-content :global(.xterm-viewport) {
		overflow-y: auto !important;
	}

	@keyframes slideIn {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}
</style>
