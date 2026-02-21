<script lang="ts">
  import { viewMode, type ViewMode } from '$lib/stores/viewMode.svelte.js';

  interface Props {
    /** Optional handler called instead of directly setting viewMode. Use for navigation. */
    onmode?: (mode: ViewMode) => void;
  }

  let { onmode }: Props = $props();

  function select(mode: ViewMode) {
    if (onmode) {
      onmode(mode);
    } else {
      viewMode.set(mode);
    }
  }
</script>

<div class="view-toggle" role="group" aria-label="View mode">
  <button
    class="toggle-btn"
    class:active={viewMode.value === 'portfolio'}
    aria-label="Portfolio view"
    aria-pressed={viewMode.value === 'portfolio'}
    title="Portfolio view (P)"
    onclick={() => select('portfolio')}
  >
    <!-- Three horizontal lines: portfolio / all-projects view -->
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <line x1="1" y1="3" x2="13" y2="3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="1" y1="11" x2="13" y2="11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  </button>
  <button
    class="toggle-btn"
    class:active={viewMode.value === 'project'}
    aria-label="Project view"
    aria-pressed={viewMode.value === 'project'}
    title="Project view (P)"
    onclick={() => select('project')}
  >
    <!-- Three vertical lines: project / focused view -->
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <line x1="3" y1="1" x2="3" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="11" y1="1" x2="11" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  </button>
</div>

<style>
  .view-toggle {
    display: flex;
    align-items: stretch;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--background);
    border: 1px solid var(--border-default);
    border-top: none;
    border-radius: 0;
    color: var(--foreground-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toggle-btn + .toggle-btn {
    border-left: none;
  }

  .toggle-btn:hover {
    background: var(--background-emphasis);
    color: var(--foreground);
    border-color: var(--foreground-subtle);
  }

  .toggle-btn.active {
    color: var(--state-implemented);
    background: var(--background-emphasis);
  }
</style>
