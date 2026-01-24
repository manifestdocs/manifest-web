<script lang="ts">
	import { Dialog } from 'bits-ui';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onCreate: (title: string) => Promise<void>;
		featureTitle: string;
	}

	let { open, onOpenChange, onCreate, featureTitle }: Props = $props();

	let title = $state('');
	let isCreating = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (open) {
			title = '';
			error = null;
		}
	});

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!title.trim()) {
			error = 'Feature set name is required';
			return;
		}

		isCreating = true;
		error = null;

		try {
			await onCreate(title.trim());
			onOpenChange(false);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create feature set';
		} finally {
			isCreating = false;
		}
	}
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay class="dialog-overlay" />
		<Dialog.Content class="dialog-content">
			<Dialog.Title class="dialog-title">Group in Feature Set</Dialog.Title>
			<Dialog.Description class="dialog-description">
				Create a new feature set containing "{featureTitle}".
			</Dialog.Description>

			<form class="dialog-form" onsubmit={handleSubmit}>
				<div class="form-field">
					<label for="group-title" class="form-label">Feature Set Name</label>
					<input
						id="group-title"
						type="text"
						class="form-input"
						placeholder="e.g., Authentication"
						bind:value={title}
						disabled={isCreating}
					/>
				</div>

				{#if error}
					<div class="form-error">{error}</div>
				{/if}

				<div class="dialog-actions">
					<button
						type="button"
						class="btn btn-secondary"
						onclick={() => onOpenChange(false)}
						disabled={isCreating}
					>
						Cancel
					</button>
					<button type="submit" class="btn btn-primary" disabled={isCreating || !title.trim()}>
						{isCreating ? 'Creating...' : 'Create Feature Set'}
					</button>
				</div>
			</form>
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

	.dialog-form {
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

	.form-input {
		padding: 8px 12px;
		font-size: 14px;
		background: var(--background-subtle);
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
		font-size: 13px;
		color: var(--accent-red, #f85149);
	}

	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 8px;
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
