<script lang="ts">
  import { Dialog } from '$lib/components/ui/dialog/index.js';
  import { API_BASE_URL } from '$lib/api/client.js';

  interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }

  interface SettingsResponse {
    database_path: string | null;
    database_path_resolved: string;
    config_file: string;
    restart_required?: boolean;
  }

  let { open, onOpenChange }: Props = $props();

  let databasePath = $state('');
  let resolvedPath = $state('');
  let configFile = $state('');
  let isSaving = $state(false);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  // Load settings when dialog opens
  $effect(() => {
    if (open) {
      loadSettings();
    }
  });

  async function loadSettings() {
    isLoading = true;
    error = null;
    try {
      const res = await fetch(`${API_BASE_URL}/settings`);
      if (!res.ok) {
        throw new Error('Failed to load settings');
      }
      const data: SettingsResponse = await res.json();
      databasePath = data.database_path ?? '';
      resolvedPath = data.database_path_resolved;
      configFile = data.config_file;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load settings';
    } finally {
      isLoading = false;
    }
  }

  async function handleSave() {
    isSaving = true;
    error = null;
    try {
      const res = await fetch(`${API_BASE_URL}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          database_path: databasePath.trim() || null,
        }),
      });
      if (!res.ok) {
        throw new Error('Failed to save settings');
      }
      const data: SettingsResponse = await res.json();
      resolvedPath = data.database_path_resolved;

      if (data.restart_required) {
        onOpenChange(false);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to save settings';
    } finally {
      isSaving = false;
    }
  }
</script>

<Dialog.Root {open} {onOpenChange}>
  <Dialog.Portal>
    <Dialog.Overlay class="dialog-overlay" />
    <Dialog.Content class="dialog-content">
      <Dialog.Title class="dialog-title">Server Settings</Dialog.Title>
      <Dialog.Description class="dialog-description">
        Configure the Manifest server
      </Dialog.Description>

      {#if isLoading}
        <div class="loading-state">Loading settings...</div>
      {:else}
        <div class="settings-form">
          <div class="form-field">
            <label for="db-path" class="form-label">Database Path</label>
            <input
              id="db-path"
              type="text"
              class="form-input"
              bind:value={databasePath}
              placeholder={resolvedPath}
              disabled={isSaving}
            />
            <span class="form-hint">
              Leave empty to use the default location. Currently resolves to:
            </span>
            <code class="resolved-path">{resolvedPath}</code>
          </div>

          <div class="form-field">
            <span class="form-label">Config File</span>
            <code class="resolved-path">{configFile}</code>
          </div>

          <div class="restart-warning">
            Changing the database path will restart the server. The page will
            reconnect automatically.
          </div>

          {#if error}
            <div class="form-error">{error}</div>
          {/if}

          <div class="form-actions">
            <button
              type="button"
              class="btn btn-secondary"
              onclick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-primary"
              onclick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Apply & Restart'}
            </button>
          </div>
        </div>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  .settings-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .resolved-path {
    display: block;
    padding: 6px 10px;
    font-size: 12px;
    font-family: var(--font-mono, monospace);
    background: var(--background-subtle);
    border: 1px solid var(--border-default);
    border-radius: 4px;
    color: var(--foreground-muted);
    word-break: break-all;
    margin-top: 4px;
  }

  .restart-warning {
    padding: 10px 14px;
    font-size: 13px;
    color: var(--foreground-muted);
    background: rgba(204, 167, 0, 0.1);
    border: 1px solid rgba(204, 167, 0, 0.25);
    border-radius: 6px;
    line-height: 1.4;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100px;
    color: var(--foreground-subtle);
    font-size: 13px;
  }
</style>
