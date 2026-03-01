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
    initialTab?: 'project' | 'features' | 'system' | 'delete';
    onUpdated?: () => Promise<void>;
    onDeleted?: () => Promise<void>;
  }

  let { open, onOpenChange, project, initialTab, onUpdated, onDeleted }: Props = $props();

  // Tab state
  let activeTab = $state<'project' | 'features' | 'system' | 'delete'>(
    'project',
  );

  // Form state
  let name = $state('');
  let defaultFeatureDestination = $state<'backlog' | 'now'>('backlog');
  let detailLevel = $state<'concise' | 'standard' | 'thorough'>('standard');
  let acFormat = $state<'checkbox' | 'gherkin'>('checkbox');
  let testingPolicy = $state<'none' | 'advisory' | 'tdd'>('advisory');
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
  let isLoadingServer = $state(false);
  let serverError = $state<string | null>(null);

  // Reset form when dialog opens or project changes
  $effect(() => {
    if (open) {
      name = project.name;
      defaultFeatureDestination =
        (project.default_feature_destination as 'backlog' | 'now') ?? 'backlog';
      detailLevel =
        (project.detail_level as 'concise' | 'standard' | 'thorough') ?? 'standard';
      acFormat =
        (project.ac_format as 'checkbox' | 'gherkin') ?? 'checkbox';
      testingPolicy =
        (project.testing_policy as 'none' | 'advisory' | 'tdd') ?? 'advisory';
      error = null;
      deleteConfirmText = '';
      deleteError = null;
      activeTab = initialTab ?? 'project';
      loadDirectories();
    }
  });

  // Load server settings when tab is selected
  $effect(() => {
    if (open && activeTab === 'system') {
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
          ac_level: detailLevel,
          ac_format: acFormat,
          testing_policy: testingPolicy,
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

  async function handleSaveSystem() {
    isSavingServer = true;
    serverError = null;
    try {
      const res = await fetch(`${API_BASE_URL}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_agent: defaultAgent,
          database_path: databasePath.trim() || null,
        }),
      });
      if (!res.ok) {
        throw new Error('Failed to save settings');
      }
      const data = await res.json();
      defaultAgent = data.default_agent ?? 'claude';
      resolvedPath = data.database_path_resolved;
      onOpenChange(false);
    } catch (e) {
      serverError = e instanceof Error ? e.message : 'Failed to save settings';
    } finally {
      isSavingServer = false;
    }
  }

  const anySaving = $derived(isSaving || isSavingServer);

  const saveDisabled = $derived(
    activeTab === 'project' ? (isSaving || !name.trim()) :
    activeTab === 'features' ? isSaving :
    activeTab === 'system' ? isSavingServer :
    true
  );

  function handleSave() {
    switch (activeTab) {
      case 'project': return handleSaveGeneral();
      case 'features': return handleSaveDefaults();
      case 'system': return handleSaveSystem();
    }
  }
</script>

<Dialog.Root {open} {onOpenChange}>
  <Dialog.Portal>
    <Dialog.Overlay class="dialog-overlay" />
    <Dialog.Content class="dialog-content settings-content">
      <div class="dialog-header">
        <div>
          <Dialog.Title class="dialog-title">Settings</Dialog.Title>
          <Dialog.Description class="dialog-description">
            Configure {project.name}
          </Dialog.Description>
        </div>
        {#if activeTab !== 'delete'}
          <div class="header-actions">
            <button
              type="button"
              class="btn btn-secondary"
              onclick={() => onOpenChange(false)}
              disabled={anySaving}
            >
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-primary"
              onclick={handleSave}
              disabled={saveDisabled}
            >
              {anySaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        {/if}
      </div>

      <div class="tabs">
        <button
          type="button"
          class="tab"
          class:active={activeTab === 'project'}
          onclick={() => (activeTab = 'project')}
        >
          Project
        </button>
        <button
          type="button"
          class="tab"
          class:active={activeTab === 'features'}
          onclick={() => (activeTab = 'features')}
        >
          Features
        </button>
        <button
          type="button"
          class="tab"
          class:active={activeTab === 'system'}
          onclick={() => (activeTab = 'system')}
        >
          System
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
        <div class="tab-panel" class:active={activeTab === 'project'}>
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
            </div>

            {#if error}
              <div class="form-error">{error}</div>
            {/if}

            <hr class="section-divider" />

            <span class="form-label">Working Directories</span>
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
          </div>
        </div>

        <div class="tab-panel" class:active={activeTab === 'features'}>
          <div class="general-form">
            <div class="setting-row">
              <div class="setting-info">
                <span class="form-label">New feature destination</span>
                <span class="form-hint">
                  {#if defaultFeatureDestination !== 'now'}
                    New features start unscheduled until manually assigned to a version.
                  {:else}
                    New features go directly into the next version.
                  {/if}
                </span>
              </div>
              <div class="segmented-control" role="radiogroup" aria-label="Feature destination">
                <label class="segment" class:active={defaultFeatureDestination === 'backlog'}>
                  <input type="radio" name="feature-destination" value="backlog" bind:group={defaultFeatureDestination} disabled={isSaving} />
                  Backlog
                </label>
                <label class="segment" class:active={defaultFeatureDestination === 'now'}>
                  <input type="radio" name="feature-destination" value="now" bind:group={defaultFeatureDestination} disabled={isSaving} />
                  Next
                </label>
              </div>
            </div>

            <hr class="section-divider" />

            <div class="setting-row">
              <div class="setting-info">
                <span class="form-label">Detail depth</span>
                <span class="form-hint">How much detail agents write for features and specifications.</span>
              </div>
              <div class="segmented-control" role="radiogroup" aria-label="Detail level">
                <label class="segment" class:active={detailLevel === 'concise'}>
                  <input type="radio" name="detail-level" value="concise" bind:group={detailLevel} disabled={isSaving} />
                  Concise
                </label>
                <label class="segment" class:active={detailLevel === 'standard'}>
                  <input type="radio" name="detail-level" value="standard" bind:group={detailLevel} disabled={isSaving} />
                  Standard
                </label>
                <label class="segment" class:active={detailLevel === 'thorough'}>
                  <input type="radio" name="detail-level" value="thorough" bind:group={detailLevel} disabled={isSaving} />
                  Thorough
                </label>
              </div>
            </div>

            <hr class="section-divider" />

            <div class="setting-row">
              <div class="setting-info">
                <span class="form-label">Acceptance criteria</span>
                <span class="form-hint">Format used for acceptance criteria in specs.</span>
              </div>
              <div class="segmented-control" role="radiogroup" aria-label="AC format">
                <label class="segment" class:active={acFormat === 'checkbox'}>
                  <input type="radio" name="ac-format" value="checkbox" bind:group={acFormat} disabled={isSaving} />
                  Checkbox
                </label>
                <label class="segment" class:active={acFormat === 'gherkin'}>
                  <input type="radio" name="ac-format" value="gherkin" bind:group={acFormat} disabled={isSaving} />
                  Gherkin
                </label>
              </div>
            </div>

            <hr class="section-divider" />

            <div class="setting-row">
              <div class="setting-info">
                <span class="form-label">Testing policy</span>
                <span class="form-hint">
                  {#if testingPolicy === 'none'}
                    Agents are not prompted to write tests.
                  {:else if testingPolicy === 'advisory'}
                    Agents are prompted to write tests before implementing.
                  {:else}
                    Agents must record passing tests before completing a feature.
                  {/if}
                </span>
              </div>
              <div class="segmented-control" role="radiogroup" aria-label="Testing policy">
                <label class="segment" class:active={testingPolicy === 'none'}>
                  <input type="radio" name="testing-policy" value="none" bind:group={testingPolicy} disabled={isSaving} />
                  Off
                </label>
                <label class="segment" class:active={testingPolicy === 'advisory'}>
                  <input type="radio" name="testing-policy" value="advisory" bind:group={testingPolicy} disabled={isSaving} />
                  Advisory
                </label>
                <label class="segment" class:active={testingPolicy === 'tdd'}>
                  <input type="radio" name="testing-policy" value="tdd" bind:group={testingPolicy} disabled={isSaving} />
                  TDD
                </label>
              </div>
            </div>

            {#if error}
              <div class="form-error">{error}</div>
            {/if}
          </div>
        </div>

        <div class="tab-panel" class:active={activeTab === 'system'}>
          {#if isLoadingServer}
            <div class="loading-state">Loading settings...</div>
          {:else}
            <div class="server-sections">
              <!-- Agent selection -->
              <div class="server-section">
                <div class="setting-row">
                  <div class="setting-info">
                    <span class="form-label">CLI Agent</span>
                    <span class="form-hint">AI agent used for chat sessions.</span>
                  </div>
                  <div class="segmented-control" role="radiogroup" aria-label="CLI Agent">
                    <label class="segment" class:active={defaultAgent === 'claude'}>
                      <input type="radio" name="default-agent" value="claude" bind:group={defaultAgent} disabled={isSavingServer} />
                      Claude
                    </label>
                    <label class="segment segment-disabled">
                      <input type="radio" name="default-agent" value="gemini" disabled />
                      Gemini
                    </label>
                    <label class="segment segment-disabled">
                      <input type="radio" name="default-agent" value="copilot" disabled />
                      Copilot
                    </label>
                  </div>
                </div>

                {#if serverError}
                  <div class="form-error">{serverError}</div>
                {/if}
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
              </div>
            </div>
          {/if}
        </div>

        <div class="tab-panel" class:active={activeTab === 'delete'}>
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
        </div>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  /* Styles handled by globally imported dialog.css */

  :global(.settings-content) {
    width: 640px;
    min-width: 480px;
    max-width: calc(100vw - 40px);
    max-height: calc(100vh - 80px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border-radius: 12px;
  }

  .dialog-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .dialog-header :global(.dialog-title) {
    margin: 0 0 4px;
  }

  .dialog-header :global(.dialog-description) {
    margin: 0 0 0;
  }

  .header-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .tabs {
    display: flex;
    gap: 4px;
    margin-top: 16px;
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
    display: grid;
    min-height: 0;
  }

  .tab-panel {
    grid-row: 1;
    grid-column: 1;
    visibility: hidden;
    pointer-events: none;
  }

  .tab-panel.active {
    visibility: visible;
    pointer-events: auto;
  }

  .general-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .segmented-control {
    display: flex;
    gap: 2px;
    padding: 3px;
    background: var(--background-subtle);
    border: 1px solid var(--border-default);
    border-radius: 6px;
    flex-shrink: 0;
  }

  .segment {
    display: flex;
    align-items: center;
    padding: 5px 12px;
    font-size: 13px;
    font-weight: 500;
    color: var(--foreground-muted);
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .segment input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  .segment:hover {
    color: var(--foreground);
  }

  .segment.active {
    background: rgba(156, 220, 254, 0.2);
    color: var(--state-implemented);
  }

  .segment-disabled {
    opacity: 0.4;
    cursor: not-allowed;
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
