<script lang="ts">
	import { Dialog } from 'bits-ui';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		featureTitle: string;
		isGroup: boolean;
		childCount: number;
		onArchive: (moveChildrenToParent: boolean) => Promise<void>;
	}

	let { open, onOpenChange, featureTitle, isGroup, childCount, onArchive }: Props = $props();

	let isArchiving = $state(false);
	let error = $state<string | null>(null);
	let moveChildren = $state(false);

	$effect(() => {
		if (open) {
			error = null;
			moveChildren = false;
		}
	});

	async function handleArchive() {
		isArchiving = true;
		error = null;

		try {
			await onArchive(moveChildren);
			onOpenChange(false);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to archive feature';
		} finally {
			isArchiving = false;
		}
	}
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay class="dialog-overlay" />
		<Dialog.Content class="dialog-content">
			<Dialog.Title class="dialog-title">Archive {isGroup ? 'Group' : 'Feature'}</Dialog.Title>
			<Dialog.Description class="dialog-description">
				{#if isGroup && childCount > 0}
					This group contains {childCount} child feature{childCount === 1 ? '' : 's'}. Choose how to handle them.
				{:else}
					Archive "{featureTitle}"? You can restore it later from the Archived state.
				{/if}
			</Dialog.Description>

			<div class="dialog-body">
				{#if isGroup && childCount > 0}
					<div class="radio-group">
						<label class="radio-option">
							<input
								type="radio"
								name="archive-option"
								value="cascade"
								checked={!moveChildren}
								onchange={() => (moveChildren = false)}
								disabled={isArchiving}
							/>
							<span class="radio-label">Archive group and all {childCount} child{childCount === 1 ? '' : 'ren'}</span>
						</label>
						<label class="radio-option">
							<input
								type="radio"
								name="archive-option"
								value="move"
								checked={moveChildren}
								onchange={() => (moveChildren = true)}
								disabled={isArchiving}
							/>
							<span class="radio-label">Move {childCount} child{childCount === 1 ? '' : 'ren'} to parent and archive group</span>
						</label>
					</div>
				{/if}

				{#if error}
					<div class="form-error">{error}</div>
				{/if}

				<div class="dialog-actions">
					<button
						type="button"
						class="btn btn-secondary"
						onclick={() => onOpenChange(false)}
						disabled={isArchiving}
					>
						Cancel
					</button>
					<button
						type="button"
						class="btn btn-warning"
						onclick={handleArchive}
						disabled={isArchiving}
					>
						{isArchiving ? 'Archiving...' : 'Archive'}
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

	.radio-group {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.radio-option {
		display: flex;
		align-items: center;
		gap: 10px;
		cursor: pointer;
	}

	.radio-option input[type='radio'] {
		width: 16px;
		height: 16px;
		accent-color: var(--accent-blue);
		cursor: pointer;
	}

	.radio-option input[type='radio']:disabled {
		cursor: not-allowed;
	}

	.radio-label {
		font-size: 14px;
		color: var(--foreground);
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

	.btn-warning {
		background: rgba(210, 153, 34, 0.2);
		color: #d29922;
		border-color: #d29922;
	}

	.btn-warning:hover:not(:disabled) {
		background: rgba(210, 153, 34, 0.3);
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
