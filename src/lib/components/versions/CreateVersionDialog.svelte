<script lang="ts">
  import { Dialog } from '$lib/components/ui/dialog/index.js';

  interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreate: (name: string) => Promise<void>;
    suggestedName?: string;
  }

  let { open, onOpenChange, onCreate, suggestedName = '' }: Props = $props();

  let name = $state('');
  let isCreating = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    if (open) {
      name = suggestedName;
      error = null;
    }
  });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!name.trim()) {
      error = 'Version name is required';
      return;
    }

    isCreating = true;
    error = null;

    try {
      await onCreate(name.trim());
      onOpenChange(false);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create version';
    } finally {
      isCreating = false;
    }
  }
</script>

<Dialog.Root {open} {onOpenChange}>
  <Dialog.Portal>
    <Dialog.Overlay class="dialog-overlay" />
    <Dialog.Content class="dialog-content">
      <Dialog.Title class="dialog-title">Create Version</Dialog.Title>
      <Dialog.Description class="dialog-description">
        Add a new version for release planning.
      </Dialog.Description>

      <form class="dialog-form" onsubmit={handleSubmit}>
        <div class="form-field">
          <label for="version-name" class="form-label">Name</label>
          <input
            id="version-name"
            type="text"
            class="form-input"
            placeholder="e.g., 1.0.0, 2.0.0-beta"
            bind:value={name}
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
          <button
            type="submit"
            class="btn btn-primary"
            disabled={isCreating || !name.trim()}
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  /* Styles handled by globally imported dialog.css */
</style>
