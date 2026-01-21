<script lang="ts">
	import type { components } from '$lib/api/schema.js';
	import { TrashIcon } from '$lib/components/icons/index.js';

	type ProjectDirectory = components['schemas']['ProjectDirectory'];

	interface Props {
		directory: ProjectDirectory;
		onRemove: (id: string) => void;
		disabled?: boolean;
	}

	let { directory, onRemove, disabled = false }: Props = $props();

	let confirmingRemove = $state(false);

	function handleRemoveClick() {
		if (confirmingRemove) {
			onRemove(directory.id);
			confirmingRemove = false;
		} else {
			confirmingRemove = true;
		}
	}

	function handleCancelRemove() {
		confirmingRemove = false;
	}
</script>

<div class="directory-item">
	<div class="directory-info">
		<div class="directory-path">
			{directory.path}
			{#if directory.is_primary}
				<span class="primary-badge">Primary</span>
			{/if}
		</div>
		{#if directory.git_remote}
			<div class="directory-remote">{directory.git_remote}</div>
		{/if}
	</div>
	<div class="directory-actions">
		{#if confirmingRemove}
			<button
				type="button"
				class="btn btn-danger btn-small"
				onclick={handleRemoveClick}
				disabled={disabled}
			>
				Confirm
			</button>
			<button
				type="button"
				class="btn btn-secondary btn-small"
				onclick={handleCancelRemove}
				disabled={disabled}
			>
				Cancel
			</button>
		{:else}
			<button
				type="button"
				class="btn btn-ghost btn-small"
				onclick={handleRemoveClick}
				disabled={disabled}
				title="Remove directory"
			>
				<TrashIcon size={14} />
			</button>
		{/if}
	</div>
</div>

<style>
	.directory-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 12px;
		background: var(--background-subtle);
		border: 1px solid var(--border-default);
		border-radius: 6px;
	}

	.directory-info {
		flex: 1;
		min-width: 0;
	}

	.directory-path {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		font-family: var(--font-mono, monospace);
		color: var(--foreground);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.primary-badge {
		font-size: 10px;
		font-family: var(--font-sans, system-ui);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 2px 6px;
		background: var(--accent-blue);
		color: #fff;
		border-radius: 4px;
		flex-shrink: 0;
	}

	.directory-remote {
		font-size: 12px;
		color: var(--foreground-muted);
		margin-top: 2px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.directory-actions {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 6px 12px;
		font-size: 12px;
		font-weight: 500;
		border-radius: 4px;
		border: 1px solid transparent;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-small {
		padding: 4px 8px;
	}

	.btn-secondary {
		background: transparent;
		color: var(--foreground);
		border-color: var(--border-default);
	}

	.btn-secondary:hover:not(:disabled) {
		background: var(--background-muted);
	}

	.btn-ghost {
		background: transparent;
		color: var(--foreground-muted);
		border-color: transparent;
		padding: 4px;
	}

	.btn-ghost:hover:not(:disabled) {
		color: var(--foreground);
		background: var(--background-muted);
	}

	.btn-danger {
		background: var(--accent-red, #f85149);
		color: #fff;
		border-color: var(--accent-red, #f85149);
	}

	.btn-danger:hover:not(:disabled) {
		filter: brightness(1.1);
	}
</style>
