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
    <!-- Three vertical lines: currently in portfolio (vertical swim lanes), switch to project -->
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <line x1="3" y1="1" x2="3" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="11" y1="1" x2="11" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  {:else}
    <!-- Three horizontal lines: currently in project (horizontal rows), switch to portfolio -->
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <line x1="1" y1="3" x2="13" y2="3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="1" y1="11" x2="13" y2="11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
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
