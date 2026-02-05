<script lang="ts">
  import { Dialog } from '$lib/components/ui/dialog/index.js';

  interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    featureTitle: string;
    onDelete: () => Promise<void>;
  }

  let { open, onOpenChange, featureTitle, onDelete }: Props = $props();

  let isDeleting = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    if (open) {
      error = null;
    }
  });

  async function handleDelete() {
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
      <Dialog.Title class="dialog-title"
        >Delete Feature Permanently</Dialog.Title
      >
      <Dialog.Description class="dialog-description">
        Are you sure you want to permanently delete "{featureTitle}" and all its
        history? This action cannot be undone.
      </Dialog.Description>

      <div class="dialog-body">
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
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Yes, Delete Permanently'}
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
</style>
