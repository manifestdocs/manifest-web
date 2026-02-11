<script lang="ts">
  interface Props {
    onCreateFeature: () => void;
    hasInstructions?: boolean;
    onBreakDown?: () => void;
  }

  let { onCreateFeature, hasInstructions = false, onBreakDown }: Props = $props();
</script>

<div class="empty-guide">
  <div class="guide-icon">
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect
        x="6"
        y="10"
        width="36"
        height="28"
        rx="3"
        stroke="currentColor"
        stroke-width="2"
      />
      <path d="M6 18H42" stroke="currentColor" stroke-width="2" />
      <circle cx="12" cy="14" r="1.5" fill="currentColor" />
      <circle cx="18" cy="14" r="1.5" fill="currentColor" />
      <circle cx="24" cy="14" r="1.5" fill="currentColor" />
      <path
        d="M14 26H34"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
      <path
        d="M14 32H28"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  </div>

  {#if hasInstructions}
    <h2 class="guide-title">Break Down Your Instructions</h2>
    <p class="guide-description">
      Your project instructions are ready. An AI agent can read them and propose
      a feature tree — organized capabilities that describe what your system does.
    </p>
    <button class="btn btn-primary" onclick={onBreakDown}>
      Break Down with AI
    </button>
    <p class="guide-hint">
      or <button class="link-button" onclick={onCreateFeature}>create features manually</button>
    </p>
  {:else}
    <h2 class="guide-title">Get Started</h2>
    <p class="guide-description">
      Features are the capabilities your system provides. Unlike tasks that get
      closed, features evolve with your codebase as living documentation.
    </p>
    <button class="btn btn-primary" onclick={onCreateFeature}>
      Create Your First Feature
    </button>
    <p class="guide-hint">
      Tip: Name features by what users can do, not what you need to build. "User
      Authentication" instead of "Implement login".
    </p>
  {/if}
</div>

<style>
  .empty-guide {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 48px 32px;
    text-align: center;
    max-width: 420px;
    margin: 0 auto;
  }

  .guide-icon {
    color: var(--foreground-muted);
    margin-bottom: 24px;
  }

  .guide-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--foreground);
    margin: 0 0 12px;
  }

  .guide-description {
    font-size: 14px;
    color: var(--foreground-subtle);
    line-height: 1.6;
    margin: 0 0 24px;
  }

  /* Button styles are global from dialog.css.
     Only override padding for this larger CTA context. */
  .btn {
    padding: 10px 20px;
    font-size: 14px;
  }

  .guide-hint {
    font-size: 13px;
    color: var(--foreground-muted);
    margin-top: 24px;
    padding: 12px 16px;
    background: var(--background-subtle);
    border-radius: 6px;
    border: 1px solid var(--border-default);
  }

  .link-button {
    background: none;
    border: none;
    color: var(--accent-blue);
    cursor: pointer;
    font-size: inherit;
    padding: 0;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .link-button:hover {
    color: var(--foreground);
  }
</style>
