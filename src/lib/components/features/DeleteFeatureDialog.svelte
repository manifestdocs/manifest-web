<script lang="ts">
	import { Dialog } from "$lib/components/ui/dialog/index.js";

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		featureTitle: string;
		onDelete: () => Promise<void>;
	}

	let { open, onOpenChange, featureTitle, onDelete }: Props = $props();

	let isDeleting = $state(false);
	let error = $state<string | null>(null);
	let confirmText = $state("");

	$effect(() => {
		if (open) {
			error = null;
			confirmText = "";
		}
	});

	const canDelete = $derived(confirmText === "delete");

	async function handleDelete() {
		if (!canDelete) return;

		isDeleting = true;
		error = null;

		try {
			await onDelete();
			onOpenChange(false);
		} catch (err) {
			error =
				err instanceof Error ? err.message : "Failed to delete feature";
		} finally {
			isDeleting = false;
		}
	}
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay class="dialog-overlay" />
		<Dialog.Content class="dialog-content">
			<Dialog.Title class="dialog-title"
				>Delete Feature Permanently</Dialog.Title
			>
			<Dialog.Description class="dialog-description">
				This will permanently delete "{featureTitle}" and all its
				history. This action cannot be undone.
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
						{isDeleting ? "Deleting..." : "Delete Permanently"}
					</button>
				</div>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	/* Styles handled by globally imported dialog.css */

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
		font-family: "IBM Plex Mono", monospace;
	}

	.confirm-input {
		width: 100%;
		padding: 8px 12px;
		font-size: 14px;
		font-family: "IBM Plex Mono", monospace;
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
</style>
