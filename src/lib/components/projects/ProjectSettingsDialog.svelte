<script lang="ts">
  import { Dialog } from '$lib/components/ui/dialog/index.js';
  import { getAuthApiContext } from '$lib/api/auth-context.js';
  import { API_BASE_URL } from '$lib/api/client.js';
  import type { components } from '$lib/api/schema.js';
  import DirectoryList from './DirectoryList.svelte';
  import MarkdownEditor from '$lib/components/markdown/MarkdownEditor.svelte';
  import { DEFAULT_TEMPLATE } from '$lib/constants/template.js';

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
  let activeTab = $state<'settings' | 'template'>('settings');

  // Form state
  let name = $state('');
  let defaultFeatureDestination = $state<'backlog' | 'now'>('backlog');
  let isSaving = $state(false);
  let error = $state<string | null>(null);

  // Directories state
  let directories = $state<ProjectDirectory[]>([]);
  let isLoadingDirectories = $state(false);

  // Template state
  let templateContent = $state('');
  let isLoadingTemplate = $state(false);
  let templateError = $state<string | null>(null);

  // Delete project state
  let deleteConfirmText = $state('');
  let isDeleting = $state(false);
  let deleteError = $state<string | null>(null);

  // Server settings state
  let databasePath = $state('');
  let resolvedPath = $state('');
  let configFile = $state('');
  let defaultAgent = $state('claude');
  let isLoadingServer = $state(false);
  let serverError = $state<string | null>(null);

  // Reset form when dialog opens
  $effect(() => {
    if (open) {
      name = project.name;
      defaultFeatureDestination =
        (project.default_feature_destination as 'backlog' | 'now') ?? 'backlog';
      error = null;
      templateError = null;
      deleteConfirmText = '';
      deleteError = null;
      activeTab = 'settings';
      loadDirectories();
      loadTemplate();
      loadServerSettings();
    }
  });

  async function loadDirectories() {
    isLoadingDirectories = true;
    try {
      const api = await authApi.getClient();
      const { data, error: fetchError } = await api.GET(
        '/projects/{id}/directories',
        { params: { path: { id: project.id } } },
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
    if (addError) throw new Error('Failed to add directory');
    await loadDirectories();
  }

  async function handleRemoveDirectory(directoryId: string) {
    const api = await authApi.getClient();
    const { error: removeError } = await api.DELETE('/directories/{id}', {
      params: { path: { id: directoryId } },
    });
    if (removeError) throw new Error('Failed to remove directory');
    await loadDirectories();
  }

  async function loadTemplate() {
    isLoadingTemplate = true;
    templateError = null;
    try {
      const api = await authApi.getClient();
      const { data, error: fetchError } = await api.GET(
        '/projects/{id}/template',
        { params: { path: { id: project.id } } },
      );
      if (fetchError) {
        console.error('Failed to load template:', fetchError);
        return;
      }
      templateContent = data ? data.content : DEFAULT_TEMPLATE;
    } finally {
      isLoadingTemplate = false;
    }
  }

  function handleResetTemplate() {
    if (
      !confirm(
        'Reset to the default template? Your current content will be replaced.',
      )
    )
      return;
    templateContent = DEFAULT_TEMPLATE;
  }

  const canDelete = $derived(deleteConfirmText === project.name && !isDeleting);

  async function handleDeleteProject() {
    if (!canDelete) return;
    isDeleting = true;
    deleteError = null;
    try {
      const api = await authApi.getClient();
      const { error: deleteErr } = await api.DELETE('/projects/{id}', {
        params: { path: { id: project.id } },
      });
      if (deleteErr) throw new Error('Failed to delete project');
      onOpenChange(false);
      if (onDeleted) await onDeleted();
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
      if (!res.ok) throw new Error('Failed to load settings');
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

  const saveDisabled = $derived(isSaving || !name.trim());

  async function handleSave() {
    if (!name.trim()) {
      error = 'Project name is required';
      return;
    }

    isSaving = true;
    error = null;
    serverError = null;

    try {
      const api = await authApi.getClient();

      // Save project settings
      const { error: projectError } = await api.PUT('/projects/{id}', {
        params: { path: { id: project.id } },
        body: {
          name: name.trim(),
          default_feature_destination: defaultFeatureDestination,
        },
      });
      if (projectError) throw new Error('Failed to update project');

      // Save template
      if (templateContent.trim()) {
        const { error: templateErr } = await api.PUT(
          '/projects/{id}/template',
          {
            params: { path: { id: project.id } },
            body: { name: 'Default', description: null, content: templateContent },
          },
        );
        if (templateErr) throw new Error('Failed to save template');
      }

      // Save system settings
      const res = await fetch(`${API_BASE_URL}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_agent: defaultAgent,
          database_path: databasePath.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to save system settings');
      const sysData = await res.json();
      defaultAgent = sysData.default_agent ?? 'claude';
      resolvedPath = sysData.database_path_resolved;

      if (onUpdated) await onUpdated();
      onOpenChange(false);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to save changes';
    } finally {
      isSaving = false;
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
        <div class="header-actions">
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
            disabled={saveDisabled}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div class="tabs">
        <button
          type="button"
          class="tab"
          class:active={activeTab === 'settings'}
          onclick={() => (activeTab = 'settings')}
        >
          Settings
        </button>
        <button
          type="button"
          class="tab"
          class:active={activeTab === 'template'}
          onclick={() => (activeTab = 'template')}
        >
          Spec Template
        </button>
      </div>

      <div class="tab-content">
        <!-- SETTINGS TAB -->
        <div class="tab-panel" class:active={activeTab === 'settings'}>
          <div class="settings-body">
            <!-- GENERAL -->
            <div class="settings-section">
              <span class="section-label">General</span>

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

              <div class="setting-row">
                <div class="setting-info">
                  <span class="form-label">New feature destination</span>
                  <span class="form-hint">
                    {#if defaultFeatureDestination !== 'now'}
                      New features start unscheduled until manually assigned to
                      a version.
                    {:else}
                      New features go directly into the next version.
                    {/if}
                  </span>
                </div>
                <div
                  class="segmented-control"
                  role="radiogroup"
                  aria-label="Feature destination"
                >
                  <label
                    class="segment"
                    class:active={defaultFeatureDestination === 'backlog'}
                  >
                    <input
                      type="radio"
                      name="feature-destination"
                      value="backlog"
                      bind:group={defaultFeatureDestination}
                      disabled={isSaving}
                    />
                    Backlog
                  </label>
                  <label
                    class="segment"
                    class:active={defaultFeatureDestination === 'now'}
                  >
                    <input
                      type="radio"
                      name="feature-destination"
                      value="now"
                      bind:group={defaultFeatureDestination}
                      disabled={isSaving}
                    />
                    Next
                  </label>
                </div>
              </div>

              {#if error}
                <div class="form-error">{error}</div>
              {/if}
            </div>

            <hr class="section-divider" />

            <!-- WORKING DIRECTORIES -->
            <div class="settings-section">
              <span class="section-label">Working Directories</span>
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

            <hr class="section-divider" />

            <!-- SYSTEM -->
            <div class="settings-section">
              <span class="section-label">System</span>

              {#if isLoadingServer}
                <div class="loading-state">Loading settings...</div>
              {:else}
                <div class="setting-row">
                  <div class="setting-info">
                    <span class="form-label">CLI Agent</span>
                    <span class="form-hint"
                      >AI agent used for chat sessions.</span
                    >
                  </div>
                  <div
                    class="segmented-control"
                    role="radiogroup"
                    aria-label="CLI Agent"
                  >
                    <label
                      class="segment"
                      class:active={defaultAgent === 'claude'}
                    >
                      <input
                        type="radio"
                        name="default-agent"
                        value="claude"
                        bind:group={defaultAgent}
                        disabled={isSaving}
                      />
                      Claude
                    </label>
                    <label class="segment segment-disabled">
                      <input
                        type="radio"
                        name="default-agent"
                        value="gemini"
                        disabled
                      />
                      Gemini
                    </label>
                    <label class="segment segment-disabled">
                      <input
                        type="radio"
                        name="default-agent"
                        value="copilot"
                        disabled
                      />
                      Copilot
                    </label>
                  </div>
                </div>

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
              {/if}
            </div>

            <hr class="section-divider" />

            <!-- DANGER ZONE -->
            <div class="settings-section">
              <span class="section-label">Danger Zone</span>
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

        <!-- SPEC TEMPLATE TAB -->
        <div class="tab-panel template-panel" class:active={activeTab === 'template'}>
          <div class="template-header">
            <span class="form-hint">
              This template guides AI agents when writing feature specs.
              Agents see it as a starting point when a feature has no
              specification yet.
            </span>
            <button
              type="button"
              class="btn-text"
              onclick={handleResetTemplate}
              disabled={isSaving}
            >
              Reset to Default
            </button>
          </div>

          {#if templateError}
            <div class="form-error">{templateError}</div>
          {/if}

          {#if isLoadingTemplate}
            <div class="loading-state">Loading template...</div>
          {:else}
            <div class="template-editor-container">
              <MarkdownEditor
                bind:value={templateContent}
                placeholder="Write your spec template in Markdown..."
                rows={16}
              />
            </div>
          {/if}
        </div>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  :global(.settings-content) {
    top: 120px;
    transform: translateX(-50%);
    width: 800px;
    min-width: 480px;
    max-width: calc(100vw - 40px);
    max-height: calc(100vh - 160px);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    border-radius: 12px;
    animation: settingsSlideIn 0.15s ease;
  }

  @keyframes settingsSlideIn {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%);
    }
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
    margin: 0;
  }

  .header-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  /* --- Tabs --- */

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

  .tab-content {
    min-height: 0;
    overflow-y: auto;
  }

  .tab-panel {
    display: none;
  }

  .tab-panel.active {
    display: block;
  }

  /* --- Settings tab --- */

  .settings-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .section-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--foreground-subtle);
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
    min-height: 0;
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

  .section-divider {
    border: none;
    border-top: 1px solid var(--border-default);
    margin: 4px 0;
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

  /* --- Template tab --- */

  .template-panel {
    display: none;
    flex-direction: column;
    gap: 12px;
  }

  .template-panel.active {
    display: flex;
  }

  .template-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .btn-text {
    background: none;
    border: none;
    font-size: 12px;
    font-weight: 500;
    color: var(--foreground-muted);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }

  .btn-text:hover {
    color: var(--foreground);
    background: var(--background-emphasis);
  }

  .btn-text:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .template-editor-container :global(.markdown-editor) {
    border-radius: 6px;
  }
</style>
