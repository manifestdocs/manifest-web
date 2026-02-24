<script lang="ts">
  import { viewMode, type ViewMode } from '$lib/stores/viewMode.svelte.js';

  interface Props {
    /** Optional handler called instead of directly setting viewMode. Use for navigation. */
    onmode?: (mode: ViewMode) => void;
  }

  let { onmode }: Props = $props();

  function toggle() {
    const next = viewMode.value === 'portfolio' ? 'project' : 'portfolio';
    if (onmode) {
      onmode(next);
    } else {
      viewMode.set(next);
    }
  }
</script>

<button
  class="toggle-btn"
  aria-label={viewMode.value === 'portfolio' ? 'Switch to project view' : 'Switch to portfolio view'}
  title={viewMode.value === 'portfolio' ? 'Project view (P)' : 'Portfolio view (P)'}
  onclick={toggle}
>
  {#if viewMode.value === 'portfolio'}
    <!-- Sidebar + main pane: switch to project view -->
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="1" y="2" width="4" height="10" rx="0.5" stroke="currentColor" stroke-width="1.2"/>
      <rect x="7" y="2" width="6" height="10" rx="0.5" stroke="currentColor" stroke-width="1.2"/>
    </svg>
  {:else}
    <!-- Three columns: switch to portfolio view -->
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="1" y="2" width="3" height="10" rx="0.5" stroke="currentColor" stroke-width="1.2"/>
      <rect x="5.5" y="2" width="3" height="10" rx="0.5" stroke="currentColor" stroke-width="1.2"/>
      <rect x="10" y="2" width="3" height="10" rx="0.5" stroke="currentColor" stroke-width="1.2"/>
    </svg>
  {/if}
</button>

<style>
  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--background);
    border: 1px solid var(--border-default);
    border-top: none;
    border-left: none;
    border-radius: 0;
    color: var(--foreground-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toggle-btn:hover {
    background: var(--background-emphasis);
    color: var(--foreground);
    border-color: var(--foreground-subtle);
    outline: 1px solid var(--foreground-subtle);
    outline-offset: -1px;
    z-index: 1;
  }
</style>
