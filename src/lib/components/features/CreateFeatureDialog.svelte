<script lang="ts">
  import { Dialog } from '$lib/components/ui/dialog/index.js';

  interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreate: (title: string, details: string | null) => Promise<void>;
    parentTitle?: string | null;
  }

  let { open, onOpenChange, onCreate, parentTitle = null }: Props = $props();

  let title = $state('');
  let details = $state('');
  let isCreating = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    if (open) {
      title = '';
      details = '';
      error = null;
    }
  });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!title.trim()) {
      error = 'Feature title is required';
      return;
    }

    isCreating = true;
    error = null;

    try {
      await onCreate(title.trim(), details.trim() || null);
      onOpenChange(false);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create feature';
    } finally {
      isCreating = false;
    }
  }

  const dialogTitle = $derived(
    parentTitle ? `Add Child to "${parentTitle}"` : 'Create Feature',
  );
  const dialogDescription = $derived(
    parentTitle
      ? `Add a child feature under "${parentTitle}".`
      : 'Add a new feature to the project.',
  );
</script>

<Dialog.Root {open} {onOpenChange}>
  <Dialog.Portal>
    <Dialog.Overlay class="dialog-overlay" />
    <Dialog.Content class="dialog-content">
      <Dialog.Title class="dialog-title">{dialogTitle}</Dialog.Title>
      <Dialog.Description class="dialog-description">
        {dialogDescription}
      </Dialog.Description>

      <form class="dialog-form" onsubmit={handleSubmit}>
        <div class="form-field">
          <label for="feature-title" class="form-label">Title</label>
          <input
            id="feature-title"
            type="text"
            class="form-input"
            placeholder="e.g., User Authentication"
            bind:value={title}
            disabled={isCreating}
          />
        </div>

        <div class="form-field">
          <label for="feature-details" class="form-label"
            >Details (optional)</label
          >
          <textarea
            id="feature-details"
            class="form-textarea"
            placeholder="User stories, implementation notes..."
            rows="3"
            bind:value={details}
            disabled={isCreating}
          ></textarea>
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
