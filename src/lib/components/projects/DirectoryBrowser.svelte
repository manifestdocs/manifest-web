<script lang="ts">
  import { tick, onMount } from 'svelte';
  import type { components } from '$lib/api/schema.js';
  import { getAuthApiContext } from '$lib/api/auth-context.js';

  type DirectoryEntry = components['schemas']['DirectoryEntry'];

  interface Props {
    value: string;
    onSelect: (path: string) => void;
    onNavigate?: (path: string) => void;
    disabled?: boolean;
  }

  let { value, onSelect, onNavigate, disabled = false }: Props = $props();

  const authApi = getAuthApiContext();

  // State for the current browsing location
  let currentPath = $state('');
  let parentPath = $state<string | null>(null);
  let entries = $state<DirectoryEntry[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Track expanded directories for tree display
  let expandedDirs = $state<Map<string, DirectoryEntry[]>>(new Map());
  let loadingDirs = $state<Set<string>>(new Set());
  let entriesContainer = $state<HTMLDivElement | undefined>();

  // Load the initial directory on mount only (not on every value change)
  onMount(() => {
    const startPath = value.trim() || undefined;
    loadDirectory(startPath);
  });

  async function loadDirectory(path?: string) {
    loading = true;
    error = null;

    try {
      const api = await authApi.getClient();
      const { data, error: apiError } = await api.GET('/filesystem/browse', {
        params: { query: path ? { path } : {} },
      });

      if (apiError || !data) {
        // If the path doesn't exist, try the parent directory
        if (path) {
          const parent = path.replace(/\/[^/]+\/?$/, '') || '/';
          if (parent !== path) {
            loading = false;
            return loadDirectory(parent);
          }
        }
        throw new Error('Failed to browse directory');
      }

      currentPath = data.path;
      parentPath = data.parent ?? null;
      entries = data.entries;
      expandedDirs = new Map();
      loadingDirs = new Set();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to browse directory';
    } finally {
      loading = false;
    }
  }

  async function toggleExpand(entry: DirectoryEntry) {
    if (disabled) return;

    const path = entry.path;

    if (expandedDirs.has(path)) {
      // Collapse
      const next = new Map(expandedDirs);
      // Remove this dir and any children that were expanded under it
      for (const key of next.keys()) {
        if (key === path || key.startsWith(path + '/')) {
          next.delete(key);
        }
      }
      expandedDirs = next;
      return;
    }

    // Expand — load children
    const nextLoading = new Set(loadingDirs);
    nextLoading.add(path);
    loadingDirs = nextLoading;

    try {
      const api = await authApi.getClient();
      const { data, error: apiError } = await api.GET('/filesystem/browse', {
        params: { query: { path } },
      });

      if (apiError || !data) {
        throw new Error('Failed to load directory');
      }

      const next = new Map(expandedDirs);
      next.set(path, data.entries);
      expandedDirs = next;

      // Notify parent of navigation (auto-fill input)
      onNavigate?.(path);

      // Scroll the expanded row to the top of the visible area
      await tick();
      const row = entriesContainer?.querySelector(
        `[data-path="${CSS.escape(path)}"]`,
      );
      row?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch {
      // Silently fail — directory may not be readable
    } finally {
      const nextLoading = new Set(loadingDirs);
      nextLoading.delete(path);
      loadingDirs = nextLoading;
    }
  }

  function handleSelect(path: string) {
    if (disabled) return;
    onSelect(path);
  }

  function handleGoUp() {
    if (parentPath && !disabled) {
      loadDirectory(parentPath);
    }
  }

  function isExpanded(path: string): boolean {
    return expandedDirs.has(path);
  }

  function getChildren(path: string): DirectoryEntry[] {
    return expandedDirs.get(path) ?? [];
  }

  function isLoading(path: string): boolean {
    return loadingDirs.has(path);
  }
</script>

<div class="browser" class:browser-disabled={disabled}>
  {#if loading}
    <div class="browser-loading">Loading...</div>
  {:else if error}
    <div class="browser-error">{error}</div>
  {:else}
    <div class="browser-header">
      <span class="browser-path" title={currentPath}>{currentPath}</span>
    </div>
    <div class="browser-entries" bind:this={entriesContainer}>
      {#if parentPath}
        <button
          type="button"
          class="browser-row"
          onclick={handleGoUp}
          {disabled}
        >
          <span class="row-chevron">&nbsp;</span>
          <span class="row-icon">..</span>
          <span class="row-name">Go up</span>
        </button>
      {/if}
      {#each entries as entry (entry.path)}
        {@render directoryRow(entry, 0)}
      {/each}
    </div>
  {/if}
</div>

{#snippet directoryRow(entry: DirectoryEntry, depth: number)}
  <div class="browser-row-group" data-path={entry.path}>
    <div class="browser-row-line" style:padding-left="{depth * 20}px">
      <button
        type="button"
        class="row-toggle"
        onclick={() => toggleExpand(entry)}
        {disabled}
        aria-label={isExpanded(entry.path) ? 'Collapse' : 'Expand'}
      >
        {#if isLoading(entry.path)}
          <span class="row-chevron row-spinner">...</span>
        {:else if entry.has_children}
          <span
            class="row-chevron"
            class:row-chevron-open={isExpanded(entry.path)}>&#9656;</span
          >
        {:else}
          <span class="row-chevron">&nbsp;</span>
        {/if}
        <span class="row-icon">&#128193;</span>
        <span class="row-name">{entry.name}</span>
      </button>
      <button
        type="button"
        class="row-select-btn"
        onclick={() => handleSelect(entry.path)}
        {disabled}
      >
        Select
      </button>
    </div>
    {#if isExpanded(entry.path)}
      {#each getChildren(entry.path) as child (child.path)}
        {@render directoryRow(child, depth + 1)}
      {/each}
    {/if}
  </div>
{/snippet}

<style>
  .browser {
    border: 1px solid var(--border-default);
    border-radius: 6px;
    background: var(--background-subtle);
    overflow: hidden;
  }

  .browser-disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  .browser-header {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-default);
    background: var(--background);
  }

  .browser-path {
    font-size: 12px;
    font-family: var(--font-mono, monospace);
    color: var(--foreground-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: block;
  }

  .browser-entries {
    max-height: 250px;
    overflow-y: auto;
  }

  .browser-loading,
  .browser-error {
    padding: 24px;
    text-align: center;
    font-size: 13px;
    color: var(--foreground-muted);
  }

  .browser-error {
    color: var(--accent-red, #f85149);
  }

  /* Go up row */
  .browser-row {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 6px 12px;
    font-size: 13px;
    color: var(--foreground-muted);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border-default);
    cursor: pointer;
    text-align: left;
  }

  .browser-row:hover:not(:disabled) {
    background: var(--background-muted);
  }

  /* Tree row with expand + select */
  .browser-row-group {
    border-bottom: 1px solid var(--border-default);
  }

  .browser-row-group:last-child {
    border-bottom: none;
  }

  .browser-row-line {
    display: flex;
    align-items: center;
    gap: 0;
  }

  .row-toggle {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 0 6px 12px;
    font-size: 13px;
    color: var(--foreground);
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    min-width: 0;
  }

  .row-toggle:hover:not(:disabled) {
    background: var(--background-muted);
  }

  .row-chevron {
    display: inline-block;
    width: 14px;
    font-size: 11px;
    text-align: center;
    transition: transform 0.15s ease;
    flex-shrink: 0;
    color: var(--foreground-muted);
  }

  .row-chevron-open {
    transform: rotate(90deg);
  }

  .row-spinner {
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.4;
    }
    50% {
      opacity: 1;
    }
  }

  .row-icon {
    flex-shrink: 0;
    font-size: 14px;
    width: 20px;
    text-align: center;
  }

  .row-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row-select-btn {
    flex-shrink: 0;
    padding: 3px 10px;
    margin-right: 8px;
    font-size: 11px;
    font-weight: 500;
    color: var(--foreground-muted);
    background: transparent;
    border: 1px solid var(--border-default);
    border-radius: 4px;
    cursor: pointer;
    opacity: 0;
    transition:
      opacity 0.1s ease,
      background 0.1s ease;
  }

  .browser-row-line:hover .row-select-btn {
    opacity: 1;
  }

  .row-select-btn:hover {
    background: var(--accent-green);
    color: #000;
    border-color: var(--accent-green);
  }
</style>
