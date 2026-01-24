<script lang="ts">
	import { Dialog } from 'bits-ui';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		featureTitle: string;
		onDelete: () => Promise<void>;
	}

	let { open, onOpenChange, featureTitle, onDelete }: Props = $props();

	let isDeleting = $state(false);
	let error = $state<string | null>(null);
	let confirmText = $state('');

	$effect(() => {
		if (open) {
			error = null;
			confirmText = '';
		}
	});

	const canDelete = $derived(confirmText === 'delete');

	async function handleDelete() {
		if (!canDelete) return;

		isDeleting = true;
		error = null;

		try {
			await onDelete();
			onOpenChange(false);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete feature';
		} finally {
			isDeleting = false;
		}
	}
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay class="dialog-overlay" />
		<Dialog.Content class="dialog-content">
			<Dialog.Title class="dialog-title">Delete Feature Permanently</Dialog.Title>
			<Dialog.Description class="dialog-description">
				This will permanently delete "{featureTitle}" and all its history. This action cannot be undone.
			</Dialog.Description>

			<div class="dialog-body">
				<div class="confirm-field">
					<label class="confirm-label" for="confirm-delete">
						Type <strong>delete</strong> to confirm:
					</label>
					<input
						id="confirm-delete"
						type="text"
						class="confirm-input"
						bind:value={confirmText}
						placeholder="delete"
						disabled={isDeleting}
						autocomplete="off"
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
						disabled={isDeleting}
					>
						Cancel
					</button>
					<button
						type="button"
						class="btn btn-danger"
						onclick={handleDelete}
						disabled={isDeleting || !canDelete}
					>
						{isDeleting ? 'Deleting...' : 'Delete Permanently'}
					</button>
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

	.dialog-body {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.confirm-field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.confirm-label {
		font-size: 13px;
		color: var(--foreground-muted);
	}

	.confirm-label strong {
		color: var(--foreground);
		font-family: 'IBM Plex Mono', monospace;
	}

	.confirm-input {
		width: 100%;
		padding: 8px 12px;
		font-size: 14px;
		font-family: 'IBM Plex Mono', monospace;
		background: var(--background-subtle);
		border: 1px solid var(--border-default);
		border-radius: 4px;
		color: var(--foreground);
	}

	.confirm-input:focus {
		outline: none;
		border-color: var(--accent-blue);
	}

	.confirm-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
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

	.btn-danger {
		background: #f85149;
		color: #fff;
		border-color: #f85149;
	}

	.btn-danger:hover:not(:disabled) {
		background: #ff6b61;
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
