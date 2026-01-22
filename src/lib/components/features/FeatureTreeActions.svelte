<script lang="ts">
	interface Props {
		showProposedOnly: boolean;
		showAddButton?: boolean;
		onAddFeature?: () => void;
		onToggleFilter: () => void;
		onExpandAll: () => void;
		onCollapseAll: () => void;
	}

	let {
		showProposedOnly,
		showAddButton = true,
		onAddFeature,
		onToggleFilter,
		onExpandAll,
		onCollapseAll
	}: Props = $props();
</script>

<div class="tree-actions">
	{#if showAddButton && onAddFeature}
		<button class="action-btn" onclick={onAddFeature} title="Add feature" type="button">
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
				<path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
			</svg>
		</button>
	{/if}
	<button
		class="action-btn filter-btn"
		class:active={showProposedOnly}
		onclick={onToggleFilter}
		title={showProposedOnly ? 'Show all features' : 'Show proposed only'}
		type="button"
	>
		{#if showProposedOnly}
			<svg width="12" height="12" viewBox="0 0 16 16" fill="none">
				<path d="M8 2L14 8L8 14L2 8L8 2Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
			</svg>
		{:else}
			<svg width="12" height="12" viewBox="0 0 16 16" fill="none">
				<path d="M8 2L14 8L8 14L2 8L8 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
			</svg>
		{/if}
	</button>
	<button class="action-btn" onclick={onExpandAll} title="Expand all" type="button">
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
			<path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>
	</button>
	<button class="action-btn" onclick={onCollapseAll} title="Collapse all" type="button">
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
			<path d="M4 10L8 6L12 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>
	</button>
</div>

<style>
	.tree-actions {
		display: flex;
		gap: 4px;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--foreground-subtle);
		cursor: pointer;
		border-radius: 4px;
		transition: all 0.1s ease;
	}

	.action-btn:hover {
		background: var(--background-muted);
		color: var(--foreground);
	}

	.action-btn.filter-btn {
		color: var(--foreground-muted);
	}

	.action-btn.filter-btn:hover {
		background: transparent;
		color: var(--foreground);
	}

	.action-btn.filter-btn.active {
		background: transparent;
		color: var(--state-proposed);
	}
</style>
