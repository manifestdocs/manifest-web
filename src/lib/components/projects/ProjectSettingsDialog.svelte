<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { api } from '$lib/api/client.js';
	import type { components } from '$lib/api/schema.js';
	import { MarkdownEditor } from '$lib/components/markdown/index.js';
	import DirectoryList from './DirectoryList.svelte';

	type Project = components['schemas']['Project'];
	type ProjectDirectory = components['schemas']['ProjectDirectory'];

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		project: Project;
		onUpdated?: () => Promise<void>;
	}

	let { open, onOpenChange, project, onUpdated }: Props = $props();

	// Tab state
	let activeTab = $state<'general' | 'directories'>('general');

	// Form state
	let name = $state('');
	let description = $state('');
	let instructions = $state('');
	let isSaving = $state(false);
	let error = $state<string | null>(null);

	// Directories state
	let directories = $state<ProjectDirectory[]>([]);
	let isLoadingDirectories = $state(false);

	// Reset form when dialog opens or project changes
	$effect(() => {
		if (open) {
			name = project.name;
			description = project.description || '';
			instructions = project.instructions || '';
			error = null;
			activeTab = 'general';
			loadDirectories();
		}
	});

	async function loadDirectories() {
		isLoadingDirectories = true;
		try {
			const { data, error: fetchError } = await api.GET('/projects/{id}/directories', {
				params: { path: { id: project.id } }
			});
			if (fetchError) {
				console.error('Failed to load directories:', fetchError);
				directories = [];
				return;
			}
			directories = data;
		} finally {
			isLoadingDirectories = false;
		}
	}

	async function handleSaveGeneral() {
		if (!name.trim()) {
			error = 'Project name is required';
			return;
		}

		isSaving = true;
		error = null;

		try {
			const { error: updateError } = await api.PUT('/projects/{id}', {
				params: { path: { id: project.id } },
				body: {
					name: name.trim(),
					description: description.trim() || null,
					instructions: instructions.trim() || null
				}
			});

			if (updateError) {
				throw new Error('Failed to update project');
			}

			if (onUpdated) {
				await onUpdated();
			}

			onOpenChange(false);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save changes';
		} finally {
			isSaving = false;
		}
	}

	async function handleAddDirectory(path: string, gitRemote: string | null) {
		const { error: addError } = await api.POST('/projects/{id}/directories', {
			params: { path: { id: project.id } },
			body: {
				path,
				git_remote: gitRemote,
				is_primary: directories.length === 0
			}
		});

		if (addError) {
			throw new Error('Failed to add directory');
		}

		await loadDirectories();
	}

	async function handleRemoveDirectory(directoryId: string) {
		const { error: removeError } = await api.DELETE('/directories/{id}', {
			params: { path: { id: directoryId } }
		});

		if (removeError) {
			throw new Error('Failed to remove directory');
		}

		await loadDirectories();
	}
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay class="dialog-overlay" />
		<Dialog.Content class="dialog-content settings-content">
			<Dialog.Title class="dialog-title">Project Settings</Dialog.Title>
			<Dialog.Description class="dialog-description">
				Configure {project.name}
			</Dialog.Description>

			<div class="tabs">
				<button
					type="button"
					class="tab"
					class:active={activeTab === 'general'}
					onclick={() => (activeTab = 'general')}
				>
					Project Wide Context
				</button>
				<button
					type="button"
					class="tab"
					class:active={activeTab === 'directories'}
					onclick={() => (activeTab = 'directories')}
				>
					Working Directories
				</button>
			</div>

			<div class="tab-content">
				{#if activeTab === 'general'}
					<div class="general-form">
						<div class="form-field">
							<label for="project-name" class="form-label">Name</label>
							<input
								id="project-name"
								type="text"
								class="form-input"
								bind:value={name}
								disabled={isSaving}
							/>
						</div>
						<div class="form-field">
							<label for="project-description" class="form-label">Description</label>
							<input
								id="project-description"
								type="text"
								class="form-input"
								placeholder="Brief description of the project"
								bind:value={description}
								disabled={isSaving}
							/>
						</div>
						<div class="form-field form-field-grow">
							<label class="form-label">AI Instructions</label>
							<div class="editor-wrapper">
								<MarkdownEditor
									bind:value={instructions}
									placeholder="Guidelines for AI agents working on this project..."
									rows={12}
								/>
							</div>
							<span class="form-hint">These instructions are provided to AI agents when they work on features in this project.</span>
						</div>

						{#if error}
							<div class="form-error">{error}</div>
						{/if}

						<div class="form-actions">
							<button
								type="button"
								class="btn btn-secondary"
								onclick={() => onOpenChange(false)}
								disabled={isSaving}
							>
								Cancel
							</button>
							<button
								type="button"
								class="btn btn-primary"
								onclick={handleSaveGeneral}
								disabled={isSaving || !name.trim()}
							>
								{isSaving ? 'Saving...' : 'Save Changes'}
							</button>
						</div>
					</div>
				{:else}
					<div class="directories-section">
						{#if isLoadingDirectories}
							<div class="loading-state">Loading directories...</div>
						{:else}
							<DirectoryList
								{directories}
								onAdd={handleAddDirectory}
								onRemove={handleRemoveDirectory}
							/>
						{/if}
					</div>
				{/if}
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	:global(.dialog-overlay) {
		position: fixed;
		inset: 0;
		z-index: 50;
		background: rgba(0, 0, 0, 0.5);
		animation: fadeIn 0.15s ease;
	}

	:global(.dialog-content) {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 51;
		width: 100%;
		max-width: 420px;
		background: var(--background);
		border: 1px solid var(--border-default);
		border-radius: 12px;
		padding: 24px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
		animation: slideIn 0.15s ease;
	}

	:global(.settings-content) {
		width: 1000px;
		min-width: 640px;
		max-width: calc(100vw - 40px);
		height: calc(100vh - 80px);
		max-height: none;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		border-radius: 0;
	}

	:global(.dialog-title) {
		font-size: 18px;
		font-weight: 600;
		color: var(--foreground);
		margin: 0 0 4px;
	}

	:global(.dialog-description) {
		font-size: 13px;
		color: var(--foreground-subtle);
		margin: 0 0 20px;
	}

	.tabs {
		display: flex;
		gap: 4px;
		margin-bottom: 20px;
		border-bottom: 1px solid var(--border-default);
		padding-bottom: 0;
	}

	.tab {
		padding: 8px 16px;
		font-size: 13px;
		font-weight: 500;
		color: var(--foreground-muted);
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.tab:hover {
		color: var(--foreground);
	}

	.tab.active {
		color: var(--foreground);
		border-bottom-color: var(--accent-blue);
	}

	.tab-content {
		flex: 1;
		overflow-y: auto;
		min-height: 0;
	}

	.general-form {
		display: flex;
		flex-direction: column;
		gap: 16px;
		height: 100%;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.form-label {
		font-size: 13px;
		font-weight: 500;
		color: var(--foreground);
	}

	.form-input,
	.form-textarea {
		padding: 8px 12px;
		font-size: 14px;
		background: var(--background-subtle);
		border: 1px solid var(--border-default);
		border-radius: 6px;
		color: var(--foreground);
		transition: border-color 0.15s ease;
	}

	.form-input:focus,
	.form-textarea:focus {
		outline: none;
		border-color: var(--accent-blue);
	}

	.form-input:disabled,
	.form-textarea:disabled {
		opacity: 0.6;
	}

	.form-textarea {
		resize: vertical;
		min-height: 100px;
		font-family: inherit;
	}

	.form-field-grow {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.editor-wrapper {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.editor-wrapper :global(.markdown-editor) {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.editor-wrapper :global(.editor-body) {
		flex: 1;
		min-height: 0;
	}

	.editor-wrapper :global(.editor-textarea) {
		height: 100%;
		min-height: 200px;
	}

	.form-hint {
		font-size: 12px;
		color: var(--foreground-muted);
	}

	.form-error {
		font-size: 13px;
		color: var(--accent-red, #f85149);
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 8px;
	}

	.directories-section {
		min-height: 200px;
	}

	.loading-state {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100px;
		color: var(--foreground-subtle);
		font-size: 13px;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 8px 16px;
		font-size: 13px;
		font-weight: 500;
		border-radius: 2px;
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

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translate(-50%, -48%);
		}
		to {
			opacity: 1;
			transform: translate(-50%, -50%);
		}
	}
</style>
