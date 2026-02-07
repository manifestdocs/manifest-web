<script lang="ts">
  import { Dialog } from '$lib/components/ui/dialog/index.js';

  interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    featureTitle: string;
    isGroup: boolean;
    childCount: number;
    onArchive: (moveChildrenToParent: boolean) => Promise<void>;
  }

  let {
    open,
    onOpenChange,
    featureTitle,
    isGroup,
    childCount,
    onArchive,
  }: Props = $props();

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
      <Dialog.Title class="dialog-title"
        >Archive {isGroup ? 'Feature Set' : 'Feature'}</Dialog.Title
      >
      <Dialog.Description class="dialog-description">
        {#if isGroup && childCount > 0}
          This feature set contains {childCount} child feature{childCount === 1
            ? ''
            : 's'}. Choose how to handle them.
        {:else}
          Archive "{featureTitle}"? You can restore it later from the Archived
          state.
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
              <span class="radio-label"
                >Archive feature set and all {childCount} child{childCount === 1
                  ? ''
                  : 'ren'}</span
              >
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
              <span class="radio-label"
                >Move {childCount} child{childCount === 1 ? '' : 'ren'} to parent
                and archive feature set</span
              >
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
  /* Styles handled by globally imported dialog.css */

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
</style>
