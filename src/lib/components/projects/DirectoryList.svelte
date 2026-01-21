<script lang="ts">
	import type { components } from '$lib/api/schema.js';
	import { PlusIcon } from '$lib/components/icons/index.js';
	import DirectoryItem from './DirectoryItem.svelte';

	type ProjectDirectory = components['schemas']['ProjectDirectory'];

	interface Props {
		directories: ProjectDirectory[];
		onAdd: (path: string, gitRemote: string | null) => Promise<void>;
		onRemove: (id: string) => Promise<void>;
		disabled?: boolean;
	}

	let { directories, onAdd, onRemove, disabled = false }: Props = $props();

	let isAdding = $state(false);
	let newPath = $state('');
	let newGitRemote = $state('');
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	function handleStartAdd() {
		isAdding = true;
		newPath = '';
		newGitRemote = '';
		error = null;
	}

	function handleCancelAdd() {
		isAdding = false;
		newPath = '';
		newGitRemote = '';
		error = null;
	}

	async function handleSubmitAdd() {
		if (!newPath.trim()) {
			error = 'Directory path is required';
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			await onAdd(newPath.trim(), newGitRemote.trim() || null);
			isAdding = false;
			newPath = '';
			newGitRemote = '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to add directory';
		} finally {
			isSubmitting = false;
		}
	}

	async function handleRemove(id: string) {
		try {
			await onRemove(id);
		} catch (err) {
			console.error('Failed to remove directory:', err);
		}
	}
</script>

<div class="directory-list">
	{#if directories.length === 0 && !isAdding}
		<div class="empty-state">
			<span>No directories configured</span>
		</div>
	{/if}

	{#each directories as directory (directory.id)}
		<DirectoryItem {directory} onRemove={handleRemove} disabled={disabled || isSubmitting} />
	{/each}

	{#if isAdding}
		<div class="add-form">
			<div class="form-field">
				<label for="new-path" class="form-label">Directory Path</label>
				<input
					id="new-path"
					type="text"
					class="form-input"
					placeholder="/Users/you/projects/my-app"
					bind:value={newPath}
					disabled={isSubmitting}
				/>
			</div>
			<div class="form-field">
				<label for="new-remote" class="form-label">Git Remote (optional)</label>
				<input
					id="new-remote"
					type="text"
					class="form-input"
					placeholder="git@github.com:org/repo.git"
					bind:value={newGitRemote}
					disabled={isSubmitting}
				/>
			</div>
			{#if error}
				<div class="form-error">{error}</div>
			{/if}
			<div class="add-form-actions">
				<button
					type="button"
					class="btn btn-secondary"
					onclick={handleCancelAdd}
					disabled={isSubmitting}
				>
					Cancel
				</button>
				<button
					type="button"
					class="btn btn-primary"
					onclick={handleSubmitAdd}
					disabled={isSubmitting || !newPath.trim()}
				>
					{isSubmitting ? 'Adding...' : 'Add Directory'}
				</button>
			</div>
		</div>
	{:else}
		<button
			type="button"
			class="add-btn"
			onclick={handleStartAdd}
			disabled={disabled}
		>
			<PlusIcon size={14} />
			Add Directory
		</button>
	{/if}
</div>

<style>
	.directory-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.empty-state {
		padding: 24px;
		text-align: center;
		color: var(--foreground-muted);
		font-size: 13px;
		background: var(--background-subtle);
		border: 1px dashed var(--border-default);
		border-radius: 6px;
	}

	.add-form {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--background-subtle);
		border: 1px solid var(--border-default);
		border-radius: 6px;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.form-label {
		font-size: 12px;
		font-weight: 500;
		color: var(--foreground);
	}

	.form-input {
		padding: 8px 12px;
		font-size: 13px;
		background: var(--background);
		border: 1px solid var(--border-default);
		border-radius: 6px;
		color: var(--foreground);
		transition: border-color 0.15s ease;
	}

	.form-input:focus {
		outline: none;
		border-color: var(--accent-blue);
	}

	.form-input:disabled {
		opacity: 0.6;
	}

	.form-error {
		font-size: 12px;
		color: var(--accent-red, #f85149);
	}

	.add-form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 4px;
	}

	.add-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 10px;
		font-size: 13px;
		font-weight: 500;
		color: var(--foreground-muted);
		background: transparent;
		border: 1px dashed var(--border-default);
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.add-btn:hover:not(:disabled) {
		color: var(--foreground);
		border-color: var(--foreground-subtle);
		background: var(--background-subtle);
	}

	.add-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
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

	.btn-primary {
		background: var(--accent-green);
		color: #000;
		border-color: var(--accent-green);
	}

	.btn-primary:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.btn-secondary {
		background: transparent;
		color: var(--foreground);
		border-color: var(--border-default);
	}

	.btn-secondary:hover:not(:disabled) {
		background: var(--background-muted);
	}
</style>
