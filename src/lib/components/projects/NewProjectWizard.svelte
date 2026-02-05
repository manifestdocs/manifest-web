<script lang="ts">
  import { untrack } from 'svelte';
  import { Dialog } from '$lib/components/ui/dialog/index.js';
  import { getAuthApiContext } from '$lib/api/auth-context.js';
  import { goto } from '$app/navigation';
  import StepIndicator from './StepIndicator.svelte';


  // Get authenticated API client from context
  const authApi = getAuthApiContext();

  interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated?: () => Promise<void>;
  }

  let { open, onOpenChange, onCreated }: Props = $props();

  // Wizard state
  let currentStep = $state(0);
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);

  // Form data
  let projectName = $state('');
  let initialVersion = $state('0.1.0');
  let directoryPath = $state('');
  let gitRemote = $state('');
  let instructions = $state('');

  // Directory existence state
  let dirExists = $state<boolean | null>(null);
  let checkingDir = $state(false);
  let checkTimeout: ReturnType<typeof setTimeout> | undefined;

  const steps = [
    { label: 'Details' },
    { label: 'Directory' },
    { label: 'Instructions' },
  ];

  // Reset form when dialog opens, pre-fill home directory
  $effect(() => {
    if (open) {
      // Use untrack so the $state writes don't become tracked dependencies.
      // Without this, fetchHomeDir setting directoryPath would re-trigger
      // this effect, creating an infinite reset loop.
      untrack(() => {
        currentStep = 0;
        projectName = '';
        initialVersion = '0.1.0';
        directoryPath = '';
        gitRemote = '';
        instructions = '';
        dirExists = null;
        checkingDir = false;
        error = null;
      });
      fetchHomeDir();
    }
  });

  async function fetchHomeDir() {
    try {
      const api = await authApi.getClient();
      const { data } = await api.GET('/filesystem/browse', {});
      if (open && data?.path) {
        directoryPath = data.path + '/';
      }
    } catch {
      // Leave directoryPath empty if we can't fetch home dir
    }
  }

  // Debounced directory existence check
  $effect(() => {
    const path = directoryPath.trim();
    clearTimeout(checkTimeout);

    if (!path || !path.startsWith('/')) {
      dirExists = null;
      return;
    }

    checkingDir = true;
    checkTimeout = setTimeout(() => checkDirectoryExists(path), 400);

    return () => clearTimeout(checkTimeout);
  });

  async function checkDirectoryExists(path: string) {
    try {
      const api = await authApi.getClient();
      const { error: apiError } = await api.GET('/filesystem/browse', {
        params: { query: { path } },
      });
      dirExists = !apiError;
    } catch {
      dirExists = false;
    } finally {
      checkingDir = false;
    }
  }

  function canProceed(): boolean {
    if (currentStep === 0) {
      return projectName.trim().length > 0 && initialVersion.trim().length > 0;
    }
    if (currentStep === 1) {
      return directoryPath.trim().length > 0;
    }
    return true;
  }

  function handleNext() {
    if (currentStep < steps.length - 1) {
      currentStep++;
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      currentStep--;
    }
  }

  async function handleSubmit() {
    if (
      !projectName.trim() ||
      !directoryPath.trim() ||
      !initialVersion.trim()
    ) {
      error = 'Project name, version, and directory are required';
      return;
    }

    isSubmitting = true;
    error = null;

    try {
      const api = await authApi.getClient();

      // Ensure directory exists (idempotent — works whether it exists or not)
      const { error: mkdirError } = await api.POST('/filesystem/mkdir', {
        body: { path: directoryPath.trim() },
      });
      if (mkdirError) {
        throw new Error('Failed to create directory');
      }

      // Create the project
      const { data: project, error: projectError } = await api.POST(
        '/projects',
        {
          body: {
            name: projectName.trim(),
            instructions: instructions.trim() || null,
          },
        },
      );

      if (projectError || !project) {
        throw new Error('Failed to create project');
      }

      // Create the initial version
      const { error: versionError } = await api.POST(
        '/projects/{id}/versions',
        {
          params: { path: { id: project.id } },
          body: {
            name: initialVersion.trim(),
          },
        },
      );

      if (versionError) {
        console.error('Failed to create initial version:', versionError);
        // Don't throw - project was created, version just failed
      }

      // Add the directory
      const { error: dirError } = await api.POST('/projects/{id}/directories', {
        params: { path: { id: project.id } },
        body: {
          path: directoryPath.trim(),
          git_remote: gitRemote.trim() || null,
          is_primary: true,
        },
      });

      if (dirError) {
        console.error('Failed to add directory:', dirError);
        // Don't throw - project was created, directory just failed
      }

      // Refresh projects list
      if (onCreated) {
        await onCreated();
      }

      // Close dialog and navigate to new project
      onOpenChange(false);
      goto(`/app/${project.slug}`);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create project';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<Dialog.Root {open} {onOpenChange}>
  <Dialog.Portal>
    <Dialog.Overlay class="dialog-overlay" />
    <Dialog.Content class="dialog-content wizard-content">
      <Dialog.Title class="dialog-title">Create New Project</Dialog.Title>
      <Dialog.Description class="dialog-description">
        Set up a new project to track features and capabilities.
      </Dialog.Description>

      <div class="wizard-steps">
        <StepIndicator {steps} {currentStep} />
      </div>

      <div class="wizard-body">
        {#if currentStep === 0}
          <div class="step-content">
            <div class="form-field">
              <label for="project-name" class="form-label">Project Name</label>
              <input
                id="project-name"
                type="text"
                class="form-input"
                placeholder="e.g., My App"
                bind:value={projectName}
                disabled={isSubmitting}
              />
            </div>
            <div class="form-field">
              <label for="initial-version" class="form-label"
                >Initial Version</label
              >
              <input
                id="initial-version"
                type="text"
                class="form-input"
                placeholder="e.g., 0.1.0"
                bind:value={initialVersion}
                disabled={isSubmitting}
              />
              <span class="form-hint"
                >Semantic version for release planning (e.g., 0.1.0, 1.0.0)</span
              >
            </div>
          </div>
        {:else if currentStep === 1}
          <div class="step-content">
            <div class="form-field">
              <label for="directory-path" class="form-label"
                >Working Directory</label
              >
              <input
                id="directory-path"
                type="text"
                class="form-input"
                placeholder="/Users/you/projects/my-app"
                bind:value={directoryPath}
                disabled={isSubmitting}
              />
              {#if checkingDir}
                <span class="form-hint">Checking path...</span>
              {:else if dirExists === false && directoryPath
                  .trim()
                  .startsWith('/')}
                <span class="form-hint form-hint-create"
                  >This directory will be created</span
                >
              {:else}
                <span class="form-hint">Absolute path to your project root</span
                >
              {/if}
            </div>
            <div class="form-field">
              <label for="git-remote" class="form-label"
                >Git Remote (optional)</label
              >
              <input
                id="git-remote"
                type="text"
                class="form-input"
                placeholder="git@github.com:org/repo.git"
                bind:value={gitRemote}
                disabled={isSubmitting}
              />
              <span class="form-hint">For linking commits to features</span>
            </div>
          </div>
        {:else}
          <div class="step-content">
            <div class="form-field">
              <label for="instructions" class="form-label"
                >AI Instructions (optional)</label
              >
              <textarea
                id="instructions"
                class="form-textarea instructions-textarea"
                placeholder="Guidelines for AI agents working on this project...

Example:
- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Run tests before committing"
                rows="8"
                bind:value={instructions}
                disabled={isSubmitting}
              ></textarea>
              <span class="form-hint"
                >You can always add or edit these later in project settings</span
              >
            </div>
          </div>
        {/if}

        {#if error}
          <div class="form-error">{error}</div>
        {/if}
      </div>

      <div class="wizard-actions">
        <div class="actions-left">
          {#if currentStep > 0}
            <button
              type="button"
              class="btn btn-secondary"
              onclick={handleBack}
              disabled={isSubmitting}
            >
              Back
            </button>
          {/if}
        </div>
        <div class="actions-right">
          <button
            type="button"
            class="btn btn-secondary"
            onclick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          {#if currentStep < steps.length - 1}
            <button
              type="button"
              class="btn btn-primary"
              onclick={handleNext}
              disabled={!canProceed() || isSubmitting}
            >
              Next
            </button>
          {:else}
            <button
              type="button"
              class="btn btn-primary"
              onclick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Project'}
            </button>
          {/if}
        </div>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  /* Styles handled by globally imported dialog.css */

  :global(.wizard-content) {
    max-width: 480px;
  }

  .wizard-steps {
    margin-bottom: 24px;
  }

  .wizard-body {
    min-height: 180px;
  }

  .step-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-hint-create {
    color: var(--accent-green, #3fb950);
  }

  .instructions-textarea {
    min-height: 160px;
    font-family: var(--font-mono, monospace);
    font-size: 13px;
  }

  .wizard-actions {
    display: flex;
    justify-content: space-between;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--border-default);
  }

  .actions-left,
  .actions-right {
    display: flex;
    gap: 8px;
  }
</style>
