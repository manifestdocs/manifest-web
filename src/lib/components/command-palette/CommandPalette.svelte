<script lang="ts">
  import { Dialog } from '$lib/components/ui/dialog/index.js';
  import { api } from '$lib/api/client.js';
  import { goto } from '$app/navigation';
  import type { components } from '$lib/api/schema.js';
  import { StateIcon, GroupIcon } from '$lib/components/icons/index.js';

  type FeatureSummary = components['schemas']['FeatureSummary'];
  type FeatureTreeNode = components['schemas']['FeatureTreeNode'];

  interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    projectSlug: string;
    featureTree?: FeatureTreeNode[];
    getDisplayId?: (uuid: string) => string;
  }

  let {
    open,
    onOpenChange,
    projectId,
    projectSlug,
    featureTree = [],
    getDisplayId = (uuid: string) => uuid,
  }: Props = $props();

  let query = $state('');
  let results = $state<FeatureSummary[]>([]);
  let isLoading = $state(false);
  let selectedIndex = $state(0);
  let inputRef = $state<HTMLInputElement | null>(null);
  type FilterableState = 'proposed' | 'in_progress' | 'blocked';

  let activeFilters = $state<Set<FilterableState>>(new Set());

  function toggleFilter(state: FilterableState) {
    const next = new Set(activeFilters);
    if (next.has(state)) {
      next.delete(state);
    } else {
      next.add(state);
    }
    activeFilters = next;
  }

  // Build a map of feature ID to parent path (breadcrumbs) and whether it's a group
  const featureMetaMap = $derived.by(() => {
    const map = new Map<string, { breadcrumbs: string[]; isGroup: boolean }>();

    function buildPaths(nodes: FeatureTreeNode[], path: string[] = []) {
      for (const node of nodes) {
        const isGroup = node.children.length > 0;
        map.set(node.id, { breadcrumbs: path, isGroup });
        buildPaths(node.children, [...path, node.title]);
      }
    }

    buildPaths(featureTree);
    return map;
  });

  // Results with breadcrumb paths attached, optionally filtered
  type ResultWithMeta = FeatureSummary & {
    breadcrumbs: string[];
    isGroup: boolean;
  };
  const resultsWithMeta = $derived<ResultWithMeta[]>(
    results
      .filter((result) => activeFilters.size === 0 || activeFilters.has(result.state as FilterableState))
      .map((result) => {
        const meta = featureMetaMap.get(result.id);
        return {
          ...result,
          breadcrumbs: meta?.breadcrumbs || [],
          isGroup: meta?.isGroup || false,
        };
      }),
  );

  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  const DEBOUNCE_MS = 200;

  async function handleSearch(searchQuery: string) {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (!searchQuery.trim()) {
      results = [];
      isLoading = false;
      return;
    }

    isLoading = true;

    searchTimeout = setTimeout(async () => {
      const { data, error } = await api.GET('/features/search', {
        params: {
          query: {
            q: searchQuery,
            project_id: projectId,
            limit: 20,
          },
        },
      });

      if (!error && data) {
        results = data;
        selectedIndex = 0;
      }
      isLoading = false;
    }, DEBOUNCE_MS);
  }

  $effect(() => {
    handleSearch(query);
  });

  // Reset state when dialog opens
  $effect(() => {
    if (open) {
      query = '';
      results = [];
      selectedIndex = 0;
      activeFilters = new Set();
      // Focus input after dialog animation
      setTimeout(() => inputRef?.focus(), 50);
    }
  });

  // Reset selection when filter changes
  $effect(() => {
    activeFilters;
    selectedIndex = 0;
  });

  function navigateToFeature(featureId: string) {
    goto(`/app/${projectSlug}?feature=${getDisplayId(featureId)}`);
    onOpenChange(false);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (resultsWithMeta.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % resultsWithMeta.length;
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex =
          (selectedIndex - 1 + resultsWithMeta.length) % resultsWithMeta.length;
        break;
      case 'Enter':
        e.preventDefault();
        const selected = resultsWithMeta[selectedIndex];
        if (selected) {
          navigateToFeature(selected.id);
        }
        break;
    }
  }
</script>

<Dialog.Root {open} {onOpenChange}>
  <Dialog.Portal>
    <Dialog.Overlay class="dialog-overlay" />
    <Dialog.Content class="palette-content" onkeydown={handleKeydown}>
      <Dialog.Title class="sr-only">Search Features</Dialog.Title>
      <Dialog.Description class="sr-only">
        Type to search features in this project. Use arrow keys to navigate,
        Enter to select, Escape to close.
      </Dialog.Description>

      <div class="palette-input-wrapper">
        <input
          bind:this={inputRef}
          type="text"
          class="palette-input"
          placeholder="Search features..."
          bind:value={query}
          aria-label="Search features"
        />
        <div class="filter-icons">
          <button
            type="button"
            class="filter-icon proposed"
            class:active={activeFilters.has('proposed')}
            onclick={() => toggleFilter('proposed')}
            title={activeFilters.has('proposed') ? 'Hide proposed' : 'Show proposed'}
          >
            {#if activeFilters.has('proposed')}
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L14 8L8 14L2 8L8 2Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
              </svg>
            {:else}
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L14 8L8 14L2 8L8 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
              </svg>
            {/if}
          </button>
          <button
            type="button"
            class="filter-icon in-progress"
            class:active={activeFilters.has('in_progress')}
            onclick={() => toggleFilter('in_progress')}
            title={activeFilters.has('in_progress') ? 'Hide in progress' : 'Show in progress'}
          >
            {#if activeFilters.has('in_progress')}
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" fill="currentColor" stroke="currentColor" stroke-width="1.5" />
              </svg>
            {:else}
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" />
              </svg>
            {/if}
          </button>
          <button
            type="button"
            class="filter-icon blocked"
            class:active={activeFilters.has('blocked')}
            onclick={() => toggleFilter('blocked')}
            title={activeFilters.has('blocked') ? 'Hide blocked' : 'Show blocked'}
          >
            {#if activeFilters.has('blocked')}
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="5.5" fill="currentColor" stroke="currentColor" stroke-width="1.5" />
                <line x1="4" y1="12" x2="12" y2="4" stroke="var(--background)" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            {:else}
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.5" fill="none" />
                <line x1="4" y1="12" x2="12" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            {/if}
          </button>
        </div>
      </div>

      <div class="palette-results">
        {#if isLoading}
          <div class="palette-empty">Searching...</div>
        {:else if query.trim() && resultsWithMeta.length === 0}
          <div class="palette-empty">No features found matching "{query}"</div>
        {:else if !query.trim()}
          <div class="palette-empty">Type to search features</div>
        {:else}
          {#each resultsWithMeta as result, index (result.id)}
            <button
              class="palette-item"
              class:selected={index === selectedIndex}
              onclick={() => navigateToFeature(result.id)}
              onmouseenter={() => (selectedIndex = index)}
            >
              <span class="item-icon">
                {#if result.isGroup}
                  <GroupIcon size={14} />
                {:else}
                  <StateIcon state={result.state} size={14} />
                {/if}
              </span>
              <div class="item-content">
                <div class="item-title-row">
                  <span class="item-title">{result.title}</span>
                  {#if result.isGroup}
                    <span class="item-badge">Set</span>
                  {/if}
                </div>
                {#if result.breadcrumbs.length > 0}
                  <div class="item-breadcrumbs">
                    {result.breadcrumbs.join(' / ')}
                  </div>
                {/if}
              </div>
            </button>
          {/each}
        {/if}
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  :global(.palette-content) {
    position: fixed;
    top: 200px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 51;
    width: 100%;
    max-width: 560px;
    background: var(--background-subtle);
    border: 1px solid var(--border-default);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    animation: paletteSlideIn 0.15s ease;
    overflow: hidden;
  }

  .palette-input-wrapper {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: var(--background-muted);
    border-bottom: 1px solid var(--border-default);
  }

  .palette-input {
    flex: 1;
    padding: 8px 12px;
    font-size: 14px;
    font-family: var(--font-mono, monospace);
    background: var(--background-subtle);
    border: 1px solid var(--border-default);
    border-radius: 6px;
    color: var(--foreground);
    outline: none;
    transition: border-color 0.15s ease;
  }

  .palette-input:focus {
    border-color: var(--accent-blue);
  }

  .palette-input::placeholder {
    color: var(--foreground-subtle);
  }

  .filter-icons {
    display: flex;
    gap: 1px;
    flex-shrink: 0;
  }

  .filter-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--foreground-muted);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.1s ease;
  }

  .filter-icon:hover {
    color: var(--foreground);
  }

  .filter-icon.proposed.active {
    color: var(--state-proposed);
  }

  .filter-icon.in-progress.active {
    color: var(--state-in-progress);
  }

  .filter-icon.blocked.active {
    color: var(--state-blocked);
  }

  .palette-results {
    max-height: 320px;
    overflow-y: auto;
    padding: 8px;
    background: var(--background-subtle);
  }

  .palette-empty {
    padding: 24px 16px;
    text-align: center;
    font-size: 13px;
    color: var(--foreground-muted);
  }

  .palette-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    color: var(--foreground);
    transition: background 0.1s ease;
  }

  .palette-item:hover,
  .palette-item.selected {
    background: var(--background-muted);
  }

  .item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 20px;
    flex-shrink: 0;
    position: relative;
    top: 1px;
  }

  .item-content {
    flex: 1;
    min-width: 0;
  }

  .item-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .item-title {
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-badge {
    flex-shrink: 0;
    padding: 1px 6px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--foreground-muted);
    background: var(--background-muted);
    border-radius: 3px;
  }

  .item-breadcrumbs {
    margin-top: 2px;
    font-size: 12px;
    color: var(--foreground-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @keyframes paletteSlideIn {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
</style>
