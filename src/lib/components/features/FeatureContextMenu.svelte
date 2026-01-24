<script lang="ts">
	interface Props {
		open: boolean;
		x: number;
		y: number;
		featureTitle?: string | null;
		isRoot?: boolean;
		isGroup?: boolean;
		isArchived?: boolean;
		onClose: () => void;
		onAddChild: () => void;
		onWrapInGroup?: () => void;
		onArchive?: () => void;
		onRestore?: () => void;
		onDelete?: () => void;
	}

	let {
		open,
		x,
		y,
		featureTitle = null,
		isRoot = false,
		isGroup = false,
		isArchived = false,
		onClose,
		onAddChild,
		onWrapInGroup,
		onArchive,
		onRestore,
		onDelete
	}: Props = $props();

	function handleAddChild() {
		onAddChild();
		onClose();
	}

	function handleWrapInGroup() {
		onWrapInGroup?.();
		onClose();
	}

	function handleArchive() {
		onArchive?.();
		onClose();
	}

	function handleRestore() {
		onRestore?.();
		onClose();
	}

	function handleDelete() {
		onDelete?.();
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
			{#if isArchived}
				<!-- Archived feature options -->
				{#if onRestore}
					<button type="button" class="menu-item" role="menuitem" onclick={handleRestore}>
						<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
							<path d="M2 8C2 4.68629 4.68629 2 8 2C10.5 2 12.5 3.5 13.4 5.5M14 8C14 11.3137 11.3137 14 8 14C5.5 14 3.5 12.5 2.6 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
							<path d="M13 2.5V5.5H10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
							<path d="M3 13.5V10.5H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
						<span>Restore</span>
					</button>
				{/if}
				{#if onDelete}
					<div class="menu-separator"></div>
					<button type="button" class="menu-item menu-item-danger" role="menuitem" onclick={handleDelete}>
						<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
							<path d="M5.5 5.5V12.5M8 5.5V12.5M10.5 5.5V12.5M2 4H14M6 4V2.5C6 2.22386 6.22386 2 6.5 2H9.5C9.77614 2 10 2.22386 10 2.5V4M3.5 4L4 13.5C4 14.0523 4.44772 14.5 5 14.5H11C11.5523 14.5 12 14.0523 12 13.5L12.5 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
						<span>Delete Permanently</span>
					</button>
				{/if}
			{:else}
				<!-- Normal feature options -->
				{#if isRoot || isGroup}
					<button type="button" class="menu-item" role="menuitem" onclick={handleAddChild}>
						<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
							<path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
						</svg>
						<span>{featureTitle ? 'Add Child Feature' : 'Add Feature'}</span>
					</button>
				{/if}
				{#if onWrapInGroup && !isRoot}
					<button type="button" class="menu-item" role="menuitem" onclick={handleWrapInGroup}>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
							<circle cx="5" cy="5" r="2" fill="currentColor" />
							<circle cx="11" cy="5" r="2" fill="currentColor" />
							<circle cx="5" cy="11" r="2" fill="currentColor" />
							<circle cx="11" cy="11" r="2" fill="currentColor" />
						</svg>
						<span>Group in Feature Set</span>
					</button>
				{/if}
				{#if onArchive && !isRoot}
					<div class="menu-separator"></div>
					<button type="button" class="menu-item menu-item-warning" role="menuitem" onclick={handleArchive}>
						<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
							<path d="M6.5 8C6.22386 8 6 8.22386 6 8.5C6 8.77614 6.22386 9 6.5 9H9.5C9.77614 9 10 8.77614 10 8.5C10 8.22386 9.77614 8 9.5 8H6.5ZM1 3.5C1 2.67157 1.67157 2 2.5 2H13.5C14.3284 2 15 2.67157 15 3.5V4.5C15 5.15311 14.5826 5.70873 14 5.91465V11.5C14 12.8807 12.8807 14 11.5 14H4.5C3.11929 14 2 12.8807 2 11.5V5.91465C1.4174 5.70873 1 5.15311 1 4.5V3.5ZM2.5 3C2.22386 3 2 3.22386 2 3.5V4.5C2 4.77614 2.22386 5 2.5 5H13.5C13.7761 5 14 4.77614 14 4.5V3.5C14 3.22386 13.7761 3 13.5 3H2.5ZM3 6V11.5C3 12.3284 3.67157 13 4.5 13H11.5C12.3284 13 13 12.3284 13 11.5V6H3Z" fill="currentColor" />
						</svg>
						<span>Archive</span>
					</button>
				{/if}
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
		color: #ff9492;
	}

	.menu-item-danger:hover {
		background: rgba(248, 81, 73, 0.15);
		color: #ffb3b1;
	}

	.menu-item-danger svg {
		color: currentColor;
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
