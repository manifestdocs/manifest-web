<script lang="ts">
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
        <line x1="24" y1="24" x2="24" y2="34" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        <line x1="19" y1="29" x2="29" y2="29" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    </div>

    <h2 class="guide-title">Add Your First Project</h2>
    <p class="guide-subtitle">Point Manifest at an existing project directory to start tracking features.</p>
    <div class="steps">
      <div class="step">
        <span class="step-number">1</span>
        <div class="step-content">
          <span class="step-title">Open your project in a coding agent</span>
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

    <p class="guide-alt">
      Or <button type="button" class="link-button" onclick={() => wizardContext?.open()}>create a project manually</button> from the web UI. For existing codebases, you'll need to ask your coding agent to plan the feature tree.
    </p>

    <a href="https://manifestdocs.ai/docs/cli/initialize" target="_blank" rel="noopener noreferrer" class="docs-link">
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

      <a href="https://manifestdocs.ai/docs/cli/initialize" target="_blank" rel="noopener noreferrer" class="docs-link">
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

  .guide-subtitle {
    font-size: 14px;
    color: var(--foreground-subtle);
    line-height: 1.5;
    margin: 0 0 28px;
    max-width: 480px;
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

  .guide-alt {
    font-size: 13px;
    color: var(--foreground-muted);
    margin: 0 0 24px;
  }

  .link-button {
    all: unset;
    color: var(--accent-blue);
    cursor: pointer;
    font-size: inherit;
  }

  .link-button:hover {
    text-decoration: underline;
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
