<script lang="ts">
  import { Dialog } from '$lib/components/ui/dialog/index.js';
  import { getAuthApiContext } from '$lib/api/auth-context.js';
  import { API_BASE_URL } from '$lib/api/client.js';
  import type { components } from '$lib/api/schema.js';
  import DirectoryList from './DirectoryList.svelte';

  // Get authenticated API client from context
  const authApi = getAuthApiContext();

  type Project = components['schemas']['Project'];
  type ProjectDirectory = components['schemas']['ProjectDirectory'];

  interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project: Project;
    onUpdated?: () => Promise<void>;
    onDeleted?: () => Promise<void>;
  }

  let { open, onOpenChange, project, onUpdated, onDeleted }: Props = $props();

  // Tab state
  let activeTab = $state<
    'general' | 'directories' | 'defaults' | 'server' | 'delete'
  >('general');

  // Form state
  let name = $state('');
  let defaultFeatureDestination = $state<'backlog' | 'now'>('backlog');
  let detailLevel = $state<'concise' | 'standard' | 'thorough'>('standard');
  let acLevel = $state<'concise' | 'standard' | 'thorough'>('standard');
  let acFormat = $state<'checkbox' | 'gherkin'>('checkbox');
  let isSaving = $state(false);
  let error = $state<string | null>(null);

  // Directories state
  let directories = $state<ProjectDirectory[]>([]);
  let isLoadingDirectories = $state(false);

  // Delete project state
  let deleteConfirmText = $state('');
  let isDeleting = $state(false);
  let deleteError = $state<string | null>(null);

  // Server settings state
  let databasePath = $state('');
  let resolvedPath = $state('');
  let configFile = $state('');
  let defaultAgent = $state('claude');
  let isSavingServer = $state(false);
  let isSavingAgent = $state(false);
  let isLoadingServer = $state(false);
  let serverError = $state<string | null>(null);
  let agentError = $state<string | null>(null);

  // Reset form when dialog opens or project changes
  $effect(() => {
    if (open) {
      name = project.name;
      defaultFeatureDestination =
        (project.default_feature_destination as 'backlog' | 'now') ?? 'backlog';
      detailLevel =
        (project.detail_level as 'concise' | 'standard' | 'thorough') ?? 'standard';
      acLevel =
        (project.ac_level as 'concise' | 'standard' | 'thorough') ?? 'standard';
      acFormat =
        (project.ac_format as 'checkbox' | 'gherkin') ?? 'checkbox';
      error = null;
      deleteConfirmText = '';
      deleteError = null;
      activeTab = 'general';
      loadDirectories();
    }
  });

  // Load server settings when tab is selected
  $effect(() => {
    if (open && activeTab === 'server') {
      loadServerSettings();
    }
  });

  async function loadDirectories() {
    isLoadingDirectories = true;
    try {
      const api = await authApi.getClient();
      const { data, error: fetchError } = await api.GET(
        '/projects/{id}/directories',
        {
          params: { path: { id: project.id } },
        },
      );
      if (fetchError) {
        console.error('Failed to load directories:', fetchError);
        directories = [];
        return;
      }
      directories = data;
    } finally {
      isLoadingDirectories = false;
    }
  }

  async function handleSaveGeneral() {
    if (!name.trim()) {
      error = 'Project name is required';
      return;
    }

    isSaving = true;
    error = null;

    try {
      const api = await authApi.getClient();
      // Only update the name (syncs to root feature title on server)
      const { error: updateError } = await api.PUT('/projects/{id}', {
        params: { path: { id: project.id } },
        body: {
          name: name.trim(),
        },
      });

      if (updateError) {
        throw new Error('Failed to update project');
      }

      if (onUpdated) {
        await onUpdated();
      }

      onOpenChange(false);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to save changes';
    } finally {
      isSaving = false;
    }
  }

  async function handleSaveDefaults() {
    isSaving = true;
    error = null;

    try {
      const api = await authApi.getClient();
      const { error: updateError } = await api.PUT('/projects/{id}', {
        params: { path: { id: project.id } },
        body: {
          default_feature_destination: defaultFeatureDestination,
          detail_level: detailLevel,
          ac_level: acLevel,
          ac_format: acFormat,
        },
      });

      if (updateError) {
        throw new Error('Failed to update project defaults');
      }

      if (onUpdated) {
        await onUpdated();
      }

      onOpenChange(false);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to save changes';
    } finally {
      isSaving = false;
    }
  }

  async function handleAddDirectory(path: string, gitRemote: string | null) {
    const api = await authApi.getClient();
    const { error: addError } = await api.POST('/projects/{id}/directories', {
      params: { path: { id: project.id } },
      body: {
        path,
        git_remote: gitRemote,
        is_primary: directories.length === 0,
      },
    });

    if (addError) {
      throw new Error('Failed to add directory');
    }

    await loadDirectories();
  }

  async function handleRemoveDirectory(directoryId: string) {
    const api = await authApi.getClient();
    const { error: removeError } = await api.DELETE('/directories/{id}', {
      params: { path: { id: directoryId } },
    });

    if (removeError) {
      throw new Error('Failed to remove directory');
    }

    await loadDirectories();
  }

  const canDelete = $derived(
    deleteConfirmText === project.name && !isDeleting,
  );

  async function handleDeleteProject() {
    if (!canDelete) return;

    isDeleting = true;
    deleteError = null;

    try {
      const api = await authApi.getClient();
      const { error: deleteErr } = await api.DELETE('/projects/{id}', {
        params: { path: { id: project.id } },
      });

      if (deleteErr) {
        throw new Error('Failed to delete project');
      }

      onOpenChange(false);
      if (onDeleted) {
        await onDeleted();
      }
    } catch (err) {
      deleteError =
        err instanceof Error ? err.message : 'Failed to delete project';
    } finally {
      isDeleting = false;
    }
  }

  async function loadServerSettings() {
    isLoadingServer = true;
    serverError = null;
    try {
      const res = await fetch(`${API_BASE_URL}/settings`);
      if (!res.ok) {
        throw new Error('Failed to load settings');
      }
      const data = await res.json();
      databasePath = data.database_path ?? '';
      resolvedPath = data.database_path_resolved;
      configFile = data.config_file;
      defaultAgent = data.default_agent ?? 'claude';
    } catch (e) {
      serverError = e instanceof Error ? e.message : 'Failed to load settings';
    } finally {
      isLoadingServer = false;
    }
  }

  async function handleSaveAgent() {
    isSavingAgent = true;
    agentError = null;
    try {
      const res = await fetch(`${API_BASE_URL}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_agent: defaultAgent,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? 'Failed to save agent setting');
      }
      const data = await res.json();
      defaultAgent = data.default_agent ?? 'claude';
    } catch (e) {
      agentError =
        e instanceof Error ? e.message : 'Failed to save agent setting';
    } finally {
      isSavingAgent = false;
    }
  }

  async function handleSaveServer() {
    isSavingServer = true;
    serverError = null;
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
      const data = await res.json();
      resolvedPath = data.database_path_resolved;

      if (data.restart_required) {
        onOpenChange(false);
      }
    } catch (e) {
      serverError = e instanceof Error ? e.message : 'Failed to save settings';
    } finally {
      isSavingServer = false;
    }
  }
</script>

<Dialog.Root {open} {onOpenChange}>
  <Dialog.Portal>
    <Dialog.Overlay class="dialog-overlay" />
    <Dialog.Content class="dialog-content settings-content">
      <Dialog.Title class="dialog-title">Settings</Dialog.Title>
      <Dialog.Description class="dialog-description">
        Configure {project.name} and server
      </Dialog.Description>

      <div class="tabs">
        <button
          type="button"
          class="tab"
          class:active={activeTab === 'general'}
          onclick={() => (activeTab = 'general')}
        >
          Project Name
        </button>
        <button
          type="button"
          class="tab"
          class:active={activeTab === 'directories'}
          onclick={() => (activeTab = 'directories')}
        >
          Working Directories
        </button>
        <button
          type="button"
          class="tab"
          class:active={activeTab === 'defaults'}
          onclick={() => (activeTab = 'defaults')}
        >
          Defaults
        </button>
        <button
          type="button"
          class="tab"
          class:active={activeTab === 'server'}
          onclick={() => (activeTab = 'server')}
        >
          Server
        </button>
        <button
          type="button"
          class="tab tab-danger"
          class:active={activeTab === 'delete'}
          onclick={() => (activeTab = 'delete')}
        >
          Delete Project
        </button>
      </div>

      <div class="tab-content">
        {#if activeTab === 'general'}
          <div class="general-form">
            <div class="form-field">
              <label for="project-name" class="form-label">Name</label>
              <input
                id="project-name"
                type="text"
                class="form-input"
                bind:value={name}
                disabled={isSaving}
              />
              <span class="form-hint"
                >The project name is shown in the feature tree and synced to the
                root feature title.</span
              >
            </div>

            <div class="form-field instructions-notice">
              <p class="notice-text">
                Project instructions are now managed through the root feature in
                the feature tree. Select the project root (with the folder icon)
                to edit instructions.
              </p>
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
                onclick={handleSaveGeneral}
                disabled={isSaving || !name.trim()}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        {:else if activeTab === 'directories'}
          <div class="directories-section">
            {#if isLoadingDirectories}
              <div class="loading-state">Loading directories...</div>
            {:else}
              <DirectoryList
                {directories}
                onAdd={handleAddDirectory}
                onRemove={handleRemoveDirectory}
              />
            {/if}
          </div>
        {:else if activeTab === 'defaults'}
          <div class="general-form">
            <div class="form-field">
              <span class="form-label">Where should new features go?</span>
              <div class="radio-group">
                <label class="radio-option">
                  <input
                    type="radio"
                    name="feature-destination"
                    value="backlog"
                    bind:group={defaultFeatureDestination}
                    disabled={isSaving}
                  />
                  <div class="radio-content">
                    <span class="radio-label">Backlog</span>
                    <span class="form-hint"
                      >New features start unscheduled until manually assigned to
                      a version.</span
                    >
                  </div>
                </label>
                <label class="radio-option">
                  <input
                    type="radio"
                    name="feature-destination"
                    value="now"
                    bind:group={defaultFeatureDestination}
                    disabled={isSaving}
                  />
                  <div class="radio-content">
                    <span class="radio-label">Now</span>
                    <span class="form-hint"
                      >New features go directly into the current version.</span
                    >
                  </div>
                </label>
              </div>
            </div>

            <hr class="section-divider" />

            <div class="form-field">
              <span class="form-label">Feature set detail level</span>
              <span class="form-hint">How detailed guidance should be for feature sets and project context.</span>
              <div class="radio-group">
                <label class="radio-option">
                  <input
                    type="radio"
                    name="detail-level"
                    value="concise"
                    bind:group={detailLevel}
                    disabled={isSaving}
                  />
                  <div class="radio-content">
                    <span class="radio-label">Concise</span>
                  </div>
                </label>
                <label class="radio-option">
                  <input
                    type="radio"
                    name="detail-level"
                    value="standard"
                    bind:group={detailLevel}
                    disabled={isSaving}
                  />
                  <div class="radio-content">
                    <span class="radio-label">Standard</span>
                  </div>
                </label>
                <label class="radio-option">
                  <input
                    type="radio"
                    name="detail-level"
                    value="thorough"
                    bind:group={detailLevel}
                    disabled={isSaving}
                  />
                  <div class="radio-content">
                    <span class="radio-label">Thorough</span>
                  </div>
                </label>
              </div>
            </div>

            <hr class="section-divider" />

            <div class="form-field">
              <span class="form-label">Spec detail level</span>
              <span class="form-hint">How detailed guidance should be for leaf feature specifications.</span>
              <div class="radio-group">
                <label class="radio-option">
                  <input
                    type="radio"
                    name="ac-level"
                    value="concise"
                    bind:group={acLevel}
                    disabled={isSaving}
                  />
                  <div class="radio-content">
                    <span class="radio-label">Concise</span>
                  </div>
                </label>
                <label class="radio-option">
                  <input
                    type="radio"
                    name="ac-level"
                    value="standard"
                    bind:group={acLevel}
                    disabled={isSaving}
                  />
                  <div class="radio-content">
                    <span class="radio-label">Standard</span>
                  </div>
                </label>
                <label class="radio-option">
                  <input
                    type="radio"
                    name="ac-level"
                    value="thorough"
                    bind:group={acLevel}
                    disabled={isSaving}
                  />
                  <div class="radio-content">
                    <span class="radio-label">Thorough</span>
                  </div>
                </label>
              </div>
            </div>

            <hr class="section-divider" />

            <div class="form-field">
              <span class="form-label">Acceptance criteria format</span>
              <span class="form-hint">Output format for acceptance criteria.</span>
              <div class="radio-group">
                <label class="radio-option">
                  <input
                    type="radio"
                    name="ac-format"
                    value="checkbox"
                    bind:group={acFormat}
                    disabled={isSaving}
                  />
                  <div class="radio-content">
                    <span class="radio-label">Checkbox</span>
                  </div>
                </label>
                <label class="radio-option">
                  <input
                    type="radio"
                    name="ac-format"
                    value="gherkin"
                    bind:group={acFormat}
                    disabled={isSaving}
                  />
                  <div class="radio-content">
                    <span class="radio-label">Gherkin</span>
                  </div>
                </label>
              </div>
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
                onclick={handleSaveDefaults}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        {:else if activeTab === 'server'}
          {#if isLoadingServer}
            <div class="loading-state">Loading settings...</div>
          {:else}
            <div class="server-sections">
              <!-- Agent selection -->
              <div class="server-section">
                <div class="form-field">
                  <span class="form-label">CLI Agent</span>
                  <div class="radio-group">
                    <label class="radio-option">
                      <input
                        type="radio"
                        name="default-agent"
                        value="claude"
                        bind:group={defaultAgent}
                        disabled={isSavingAgent}
                      />
                      <div class="radio-content">
                        <span class="radio-label">Claude</span>
                        <span class="form-hint">Anthropic Claude Code CLI</span>
                      </div>
                    </label>
                    <label class="radio-option disabled">
                      <input
                        type="radio"
                        name="default-agent"
                        value="gemini"
                        disabled
                      />
                      <div class="radio-content">
                        <span class="radio-label">Gemini</span>
                        <span class="form-hint"
                          >Google Gemini CLI (coming soon)</span
                        >
                      </div>
                    </label>
                    <label class="radio-option disabled">
                      <input
                        type="radio"
                        name="default-agent"
                        value="copilot"
                        disabled
                      />
                      <div class="radio-content">
                        <span class="radio-label">Copilot</span>
                        <span class="form-hint"
                          >GitHub Copilot CLI (coming soon)</span
                        >
                      </div>
                    </label>
                  </div>
                </div>

                {#if agentError}
                  <div class="form-error">{agentError}</div>
                {/if}

                <div class="form-actions">
                  <button
                    type="button"
                    class="btn btn-primary"
                    onclick={handleSaveAgent}
                    disabled={isSavingAgent}
                  >
                    {isSavingAgent ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>

              <hr class="section-divider" />

              <!-- Database path -->
              <div class="server-section">
                <div class="form-field">
                  <label for="db-path" class="form-label">Database Path</label>
                  <input
                    id="db-path"
                    type="text"
                    class="form-input"
                    bind:value={databasePath}
                    placeholder={resolvedPath}
                    disabled={isSavingServer}
                  />
                  <span class="form-hint">
                    Leave empty to use the default location.
                  </span>
                  <dl class="info-list">
                    <dt>Resolved path</dt>
                    <dd>{resolvedPath}</dd>
                    <dt>Config file</dt>
                    <dd>{configFile}</dd>
                  </dl>
                </div>

                <div class="restart-warning">
                  Changing the database path will restart the server. The page
                  will reconnect automatically.
                </div>

                {#if serverError}
                  <div class="form-error">{serverError}</div>
                {/if}

                <div class="form-actions">
                  <button
                    type="button"
                    class="btn btn-secondary"
                    onclick={() => onOpenChange(false)}
                    disabled={isSavingServer}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    class="btn btn-primary"
                    onclick={handleSaveServer}
                    disabled={isSavingServer}
                  >
                    {isSavingServer ? 'Saving...' : 'Apply & Restart'}
                  </button>
                </div>
              </div>
            </div>
          {/if}
        {:else if activeTab === 'delete'}
          <div class="delete-section">
            <div class="danger-zone">
              <p class="danger-zone-description">
                Permanently delete <strong>{project.name}</strong> and all its
                features, history, and versions. This action cannot be undone.
              </p>
              <div class="confirm-field">
                <label class="confirm-label" for="confirm-delete-project">
                  Type <strong>{project.name}</strong> to confirm:
                </label>
                <input
                  id="confirm-delete-project"
                  type="text"
                  class="form-input"
                  bind:value={deleteConfirmText}
                  placeholder={project.name}
                  disabled={isDeleting}
                  autocomplete="off"
                />
              </div>

              {#if deleteError}
                <div class="form-error">{deleteError}</div>
              {/if}

              <button
                type="button"
                class="btn btn-danger"
                onclick={handleDeleteProject}
                disabled={!canDelete}
              >
                {isDeleting ? 'Deleting...' : 'Delete Project'}
              </button>
            </div>
          </div>
        {/if}
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  /* Styles handled by globally imported dialog.css */

  :global(.settings-content) {
    width: 1000px;
    min-width: 640px;
    max-width: calc(100vw - 40px);
    height: calc(100vh - 80px);
    max-height: none;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border-radius: 0;
  }

  .tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 20px;
    border-bottom: 1px solid var(--border-default);
    padding-bottom: 0;
  }

  .tab {
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    color: var(--foreground-muted);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .tab:hover {
    color: var(--foreground);
  }

  .tab.active {
    color: var(--foreground);
    border-bottom-color: var(--accent-blue);
  }

  .tab-danger {
    margin-left: auto;
  }

  .tab-danger.active {
    color: #f85149;
    border-bottom-color: #f85149;
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  .general-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
  }

  .instructions-notice {
    padding: 16px;
    background: var(--background-subtle);
    border: 1px solid var(--border-default);
    border-radius: 6px;
  }

  .notice-text {
    margin: 0;
    font-size: 13px;
    color: var(--foreground-muted);
    line-height: 1.5;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }

  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .radio-option {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--border-default);
    border-radius: 6px;
    cursor: pointer;
    transition: border-color 0.15s ease;
  }

  .radio-option:hover {
    border-color: var(--foreground-subtle);
  }

  .radio-option:has(input:checked) {
    border-color: var(--accent-blue);
    background: color-mix(in srgb, var(--accent-blue) 5%, transparent);
  }

  .radio-option input[type='radio'] {
    margin-top: 2px;
    accent-color: var(--accent-blue);
  }

  .radio-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .radio-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--foreground);
  }

  .directories-section {
    min-height: 200px;
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100px;
    color: var(--foreground-subtle);
    font-size: 13px;
  }

  .info-list {
    margin: 4px 0 0;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 12px;
    font-size: 12px;
  }

  .info-list dt {
    color: var(--foreground-subtle);
  }

  .info-list dd {
    margin: 0;
    font-family: var(--font-mono, monospace);
    color: var(--foreground-muted);
    word-break: break-all;
  }

  .server-sections {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
  }

  .server-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .section-divider {
    border: none;
    border-top: 1px solid var(--border-default);
    margin: 4px 0;
  }

  .radio-option.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .radio-option.disabled input[type='radio'] {
    cursor: not-allowed;
  }

  .delete-section {
    max-width: 480px;
  }

  .danger-zone {
    padding: 16px;
    border: 1px solid rgba(248, 81, 73, 0.4);
    border-radius: 6px;
    background: rgba(248, 81, 73, 0.05);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .danger-zone-description {
    margin: 0;
    font-size: 13px;
    color: var(--foreground-muted);
    line-height: 1.5;
  }

  .danger-zone-description strong {
    color: var(--foreground);
  }

  .confirm-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .confirm-label {
    font-size: 13px;
    color: var(--foreground-muted);
  }

  .confirm-label strong {
    color: var(--foreground);
    font-family: var(--font-mono, monospace);
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
</style>
