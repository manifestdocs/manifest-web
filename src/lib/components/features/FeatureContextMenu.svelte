<script lang="ts">
	interface Props {
		open: boolean;
		x: number;
		y: number;
		featureTitle?: string | null;
		onClose: () => void;
		onAddChild: () => void;
	}

	let { open, x, y, featureTitle = null, onClose, onAddChild }: Props = $props();

	function handleAddChild() {
		onAddChild();
		onClose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}

	function handleClickOutside(e: MouseEvent) {
		onClose();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="context-menu-backdrop" onclick={handleClickOutside} onkeydown={handleKeydown}>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="context-menu"
			style="left: {x}px; top: {y}px"
			role="menu"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<button type="button" class="menu-item" role="menuitem" onclick={handleAddChild}>
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
					<path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
				</svg>
				<span>{featureTitle ? 'Add Child Feature' : 'Add Feature'}</span>
			</button>
		</div>
	</div>
{/if}

<style>
	.context-menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
	}

	.context-menu {
		position: fixed;
		z-index: 101;
		min-width: 160px;
		background: var(--background);
		border: 1px solid var(--border-default);
		border-radius: 8px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
		padding: 4px;
		animation: fadeIn 0.1s ease;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 12px;
		font-size: 13px;
		color: var(--foreground);
		background: transparent;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		text-align: left;
	}

	.menu-item:hover {
		background: var(--background-muted);
	}

	.menu-item svg {
		color: var(--foreground-subtle);
		flex-shrink: 0;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
