<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { getAuthApiContext } from '$lib/api/auth-context.js';
	import { goto } from '$app/navigation';
	import StepIndicator from './StepIndicator.svelte';

	// Get authenticated API client from context
	const authApi = getAuthApiContext();

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onCreated?: () => Promise<void>;
	}

	let { open, onOpenChange, onCreated }: Props = $props();

	// Wizard state
	let currentStep = $state(0);
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	// Form data
	let projectName = $state('');
	let projectDescription = $state('');
	let initialVersion = $state('0.1.0');
	let directoryPath = $state('');
	let gitRemote = $state('');
	let instructions = $state('');

	const steps = [
		{ label: 'Details' },
		{ label: 'Directory' },
		{ label: 'Instructions' }
	];

	// Reset form when dialog opens
	$effect(() => {
		if (open) {
			currentStep = 0;
			projectName = '';
			projectDescription = '';
			initialVersion = '0.1.0';
			directoryPath = '';
			gitRemote = '';
			instructions = '';
			error = null;
		}
	});

	function canProceed(): boolean {
		if (currentStep === 0) {
			return projectName.trim().length > 0 && initialVersion.trim().length > 0;
		}
		if (currentStep === 1) {
			return directoryPath.trim().length > 0;
		}
		return true;
	}

	function handleNext() {
		if (currentStep < steps.length - 1) {
			currentStep++;
		}
	}

	function handleBack() {
		if (currentStep > 0) {
			currentStep--;
		}
	}

	async function handleSubmit() {
		if (!projectName.trim() || !directoryPath.trim() || !initialVersion.trim()) {
			error = 'Project name, version, and directory are required';
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			const api = await authApi.getClient();

			// Create the project
			const { data: project, error: projectError } = await api.POST('/projects', {
				body: {
					name: projectName.trim(),
					description: projectDescription.trim() || null,
					instructions: instructions.trim() || null
				}
			});

			if (projectError || !project) {
				throw new Error('Failed to create project');
			}

			// Create the initial version
			const { error: versionError } = await api.POST('/projects/{id}/versions', {
				params: { path: { id: project.id } },
				body: {
					name: initialVersion.trim()
				}
			});

			if (versionError) {
				console.error('Failed to create initial version:', versionError);
				// Don't throw - project was created, version just failed
			}

			// Add the directory
			const { error: dirError } = await api.POST('/projects/{id}/directories', {
				params: { path: { id: project.id } },
				body: {
					path: directoryPath.trim(),
					git_remote: gitRemote.trim() || null,
					is_primary: true
				}
			});

			if (dirError) {
				console.error('Failed to add directory:', dirError);
				// Don't throw - project was created, directory just failed
			}

			// Refresh projects list
			if (onCreated) {
				await onCreated();
			}

			// Close dialog and navigate to new project
			onOpenChange(false);
			goto(`/app/${project.slug}`);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create project';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay class="dialog-overlay" />
		<Dialog.Content class="dialog-content wizard-content">
			<Dialog.Title class="dialog-title">Create New Project</Dialog.Title>
			<Dialog.Description class="dialog-description">
				Set up a new project to track features and capabilities.
			</Dialog.Description>

			<div class="wizard-steps">
				<StepIndicator {steps} {currentStep} />
			</div>

			<div class="wizard-body">
				{#if currentStep === 0}
					<div class="step-content">
						<div class="form-field">
							<label for="project-name" class="form-label">Project Name</label>
							<input
								id="project-name"
								type="text"
								class="form-input"
								placeholder="e.g., My App"
								bind:value={projectName}
								disabled={isSubmitting}
							/>
						</div>
						<div class="form-field">
							<label for="project-description" class="form-label">Description (optional)</label>
							<input
								id="project-description"
								type="text"
								class="form-input"
								placeholder="Brief description of the project"
								bind:value={projectDescription}
								disabled={isSubmitting}
							/>
						</div>
						<div class="form-field">
							<label for="initial-version" class="form-label">Initial Version</label>
							<input
								id="initial-version"
								type="text"
								class="form-input"
								placeholder="e.g., 0.1.0"
								bind:value={initialVersion}
								disabled={isSubmitting}
							/>
							<span class="form-hint">Semantic version for release planning (e.g., 0.1.0, 1.0.0)</span>
						</div>
					</div>
				{:else if currentStep === 1}
					<div class="step-content">
						<div class="form-field">
							<label for="directory-path" class="form-label">Working Directory</label>
							<input
								id="directory-path"
								type="text"
								class="form-input"
								placeholder="/Users/you/projects/my-app"
								bind:value={directoryPath}
								disabled={isSubmitting}
							/>
							<span class="form-hint">Absolute path to your project root</span>
						</div>
						<div class="form-field">
							<label for="git-remote" class="form-label">Git Remote (optional)</label>
							<input
								id="git-remote"
								type="text"
								class="form-input"
								placeholder="git@github.com:org/repo.git"
								bind:value={gitRemote}
								disabled={isSubmitting}
							/>
							<span class="form-hint">For linking commits to features</span>
						</div>
					</div>
				{:else}
					<div class="step-content">
						<div class="form-field">
							<label for="instructions" class="form-label">AI Instructions (optional)</label>
							<textarea
								id="instructions"
								class="form-textarea instructions-textarea"
								placeholder="Guidelines for AI agents working on this project...

Example:
- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Run tests before committing"
								rows="8"
								bind:value={instructions}
								disabled={isSubmitting}
							></textarea>
							<span class="form-hint">You can always add or edit these later in project settings</span>
						</div>
					</div>
				{/if}

				{#if error}
					<div class="form-error">{error}</div>
				{/if}
			</div>

			<div class="wizard-actions">
				<div class="actions-left">
					{#if currentStep > 0}
						<button
							type="button"
							class="btn btn-secondary"
							onclick={handleBack}
							disabled={isSubmitting}
						>
							Back
						</button>
					{/if}
				</div>
				<div class="actions-right">
					<button
						type="button"
						class="btn btn-secondary"
						onclick={() => onOpenChange(false)}
						disabled={isSubmitting}
					>
						Cancel
					</button>
					{#if currentStep < steps.length - 1}
						<button
							type="button"
							class="btn btn-primary"
							onclick={handleNext}
							disabled={!canProceed() || isSubmitting}
						>
							Next
						</button>
					{:else}
						<button
							type="button"
							class="btn btn-primary"
							onclick={handleSubmit}
							disabled={isSubmitting}
						>
							{isSubmitting ? 'Creating...' : 'Create Project'}
						</button>
					{/if}
				</div>
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

	:global(.wizard-content) {
		max-width: 480px;
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

	.wizard-steps {
		margin-bottom: 24px;
	}

	.wizard-body {
		min-height: 180px;
	}

	.step-content {
		display: flex;
		flex-direction: column;
		gap: 16px;
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
		min-height: 80px;
		font-family: inherit;
	}

	.instructions-textarea {
		min-height: 160px;
		font-family: var(--font-mono, monospace);
		font-size: 13px;
	}

	.form-hint {
		font-size: 12px;
		color: var(--foreground-muted);
	}

	.form-error {
		font-size: 13px;
		color: var(--accent-red, #f85149);
		margin-top: 8px;
	}

	.wizard-actions {
		display: flex;
		justify-content: space-between;
		margin-top: 24px;
		padding-top: 16px;
		border-top: 1px solid var(--border-default);
	}

	.actions-left,
	.actions-right {
		display: flex;
		gap: 8px;
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
