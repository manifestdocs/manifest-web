<script lang="ts">
  import { Dialog } from '$lib/components/ui/dialog/index.js';

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
      error =
        err instanceof Error ? err.message : 'Failed to create feature set';
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
          <button
            type="submit"
            class="btn btn-primary"
            disabled={isCreating || !title.trim()}
          >
            {isCreating ? 'Creating...' : 'Create Feature Set'}
          </button>
        </div>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  /* Styles handled by globally imported dialog.css */
</style>
