<script lang="ts">
  import { base } from '$app/paths';
  import { getContext } from 'svelte';

  type Scenario = 'no-projects' | 'no-directory';

  interface Props {
    scenario: Scenario;
    projectName?: string;
  }

  let { scenario, projectName }: Props = $props();

  const isNoProjects = $derived(scenario === 'no-projects');

  const wizardContext = getContext<{ open: () => void } | undefined>(
    'newProjectWizard',
  );
</script>

<div class="onboarding-guide">
  {#if isNoProjects}
    <div class="guide-icon">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <path
          d="M8 14V38C8 39.1046 8.89543 40 10 40H38C39.1046 40 40 39.1046 40 38V18C40 16.8954 39.1046 16 38 16H24L20 10H10C8.89543 10 8 10.8954 8 12V14Z"
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <path
          d="M20 28L24 24L28 28"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M24 24V34"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    </div>

    <h2 class="guide-title">Create Your First Project</h2>
    <div class="method-cards">
      <div class="method-panel">
        <h3 class="method-title">Web UI</h3>
        <p class="method-description">
          Use the setup wizard to create a project.
        </p>
        <button
          type="button"
          class="btn btn-primary method-action"
          onclick={() => wizardContext?.open()}
        >
          Create Project
        </button>
      </div>

      <div class="method-separator"></div>

      <div class="method-panel">
        <h3 class="method-title">CLI Coding Agent</h3>
        <p class="method-description">
          Initialize from your codebase with automatic code and git analysis.
        </p>
        <div class="steps">
          <div class="step">
            <span class="step-number">1</span>
            <div class="step-content">
              <span class="step-title">Open your project in a coding agent</span
              >
            </div>
          </div>
          <div class="step">
            <span class="step-number">2</span>
            <div class="step-content">
              <code class="step-command"
                >"Initialize this project in Manifest"</code
              >
            </div>
          </div>
        </div>
      </div>
    </div>

    <a href="{base}/docs/getting-started" class="docs-link">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path
          d="M6 3H3C2.44772 3 2 3.44772 2 4V13C2 13.5523 2.44772 14 3 14H12C12.5523 14 13 13.5523 13 13V10"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
        <path
          d="M7 9L14 2"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
        <path
          d="M10 2H14V6"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      View setup documentation
    </a>
  {:else}
    <div class="directory-guide">
      <div class="guide-icon">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect
            x="8"
            y="8"
            width="32"
            height="32"
            rx="4"
            stroke="currentColor"
            stroke-width="2"
          />
          <path
            d="M16 20L20 24L16 28"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M24 28H32"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </div>

      <h2 class="guide-title">Link a Working Directory</h2>

      <p class="guide-description">
        <strong>{projectName}</strong> needs a working directory to enable codebase
        analysis and feature discovery.
      </p>

      <div class="steps">
        <div class="step">
          <span class="step-number">1</span>
          <div class="step-content">
            <span class="step-title">Open your project directory</span>
            <span class="step-detail"
              >In Claude Code or another CLI-based coding agent</span
            >
          </div>
        </div>

        <div class="step">
          <span class="step-number">2</span>
          <div class="step-content">
            <span class="step-title">Ask your assistant</span>
            <code class="step-command">
              "Link this directory to {projectName} in Manifest"
            </code>
          </div>
        </div>
      </div>

      <p class="guide-note">
        This is a one-time setup. Once linked, your directory will be recognized
        automatically.
      </p>

      <a href="{base}/docs/getting-started" class="docs-link">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M6 3H3C2.44772 3 2 3.44772 2 4V13C2 13.5523 2.44772 14 3 14H12C12.5523 14 13 13.5523 13 13V10"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <path
            d="M7 9L14 2"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <path
            d="M10 2H14V6"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        View setup documentation
      </a>
    </div>
  {/if}
</div>

<style>
  .onboarding-guide {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 32px 12vh;
    text-align: center;
    width: 100%;
    max-width: 960px;
  }

  .guide-title {
    font-size: 22px;
    font-weight: 600;
    color: var(--foreground);
    margin: 0 0 8px;
  }

  .guide-description {
    font-size: 14px;
    color: var(--foreground-subtle);
    line-height: 1.6;
    margin: 0 0 32px;
  }

  .guide-description strong {
    color: var(--foreground);
  }

  /* Method cards layout */
  .method-cards {
    display: flex;
    align-items: flex-start;
    gap: 0;
    width: 100%;
    margin-bottom: 28px;
  }

  .method-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 0 24px;
  }

  .method-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--foreground);
    margin: 0 0 8px;
  }

  .method-description {
    font-size: 13px;
    color: var(--foreground-subtle);
    line-height: 1.5;
    margin: 0 0 16px;
  }

  .method-action {
    margin-top: 0;
  }

  .method-separator {
    width: 1px;
    align-self: stretch;
    background: var(--border-default);
    flex-shrink: 0;
    margin: 0 24px;
  }

  /* Directory guide (no-directory scenario) */
  .directory-guide {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .guide-icon {
    color: var(--foreground-muted);
    margin-bottom: 24px;
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    max-width: 480px;
    text-align: left;
    margin-bottom: 24px;
  }

  .step {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
    background: var(--background-subtle);
    border: 1px solid var(--border-default);
    border-radius: 6px;
  }

  .step-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    font-size: 12px;
    font-weight: 600;
    color: var(--background);
    background: var(--foreground-muted);
    border-radius: 50%;
    flex-shrink: 0;
  }

  .step-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .step-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--foreground);
  }

  .step-detail {
    font-size: 13px;
    color: var(--foreground-muted);
  }

  .step-command {
    display: block;
    padding: 8px 12px;
    font-size: 13px;
    font-family: var(--font-mono, monospace);
    color: var(--accent-green);
    background: var(--background);
    border: 1px solid var(--border-default);
    border-radius: 4px;
    margin-top: 4px;
  }

  .guide-note {
    font-size: 13px;
    color: var(--foreground-muted);
    margin: 0 0 20px;
    padding: 10px 16px;
    background: color-mix(in srgb, var(--accent-blue) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-blue) 30%, transparent);
    border-radius: 6px;
  }

  .docs-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 500;
    color: var(--accent-blue);
    text-decoration: none;
    transition: opacity 0.15s ease;
  }

  .docs-link:hover {
    opacity: 0.8;
  }
</style>
