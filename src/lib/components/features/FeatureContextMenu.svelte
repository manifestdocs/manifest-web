<script lang="ts">
	interface Props {
		open: boolean;
		x: number;
		y: number;
		featureTitle?: string | null;
		isRoot?: boolean;
		onClose: () => void;
		onAddChild: () => void;
		onArchive?: () => void;
	}

	let { open, x, y, featureTitle = null, isRoot = false, onClose, onAddChild, onArchive }: Props = $props();

	function handleAddChild() {
		onAddChild();
		onClose();
	}

	function handleArchive() {
		onArchive?.();
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
			{#if onArchive && !isRoot}
				<div class="menu-separator"></div>
				<button type="button" class="menu-item menu-item-warning" role="menuitem" onclick={handleArchive}>
					<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
						<path d="M6.5 8C6.22386 8 6 8.22386 6 8.5C6 8.77614 6.22386 9 6.5 9H9.5C9.77614 9 10 8.77614 10 8.5C10 8.22386 9.77614 8 9.5 8H6.5ZM1 3.5C1 2.67157 1.67157 2 2.5 2H13.5C14.3284 2 15 2.67157 15 3.5V4.5C15 5.15311 14.5826 5.70873 14 5.91465V11.5C14 12.8807 12.8807 14 11.5 14H4.5C3.11929 14 2 12.8807 2 11.5V5.91465C1.4174 5.70873 1 5.15311 1 4.5V3.5ZM2.5 3C2.22386 3 2 3.22386 2 3.5V4.5C2 4.77614 2.22386 5 2.5 5H13.5C13.7761 5 14 4.77614 14 4.5V3.5C14 3.22386 13.7761 3 13.5 3H2.5ZM3 6V11.5C3 12.3284 3.67157 13 4.5 13H11.5C12.3284 13 13 12.3284 13 11.5V6H3Z" fill="currentColor" />
					</svg>
					<span>Archive</span>
				</button>
			{/if}
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

	.menu-item-danger {
		color: #f85149;
	}

	.menu-item-danger:hover {
		background: rgba(248, 81, 73, 0.15);
	}

	.menu-item-danger svg {
		color: #f85149;
	}

	.menu-item-warning {
		color: #d29922;
	}

	.menu-item-warning:hover {
		background: rgba(210, 153, 34, 0.15);
	}

	.menu-item-warning svg {
		color: #d29922;
	}

	.menu-separator {
		height: 1px;
		background: var(--border-default);
		margin: 4px 0;
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
