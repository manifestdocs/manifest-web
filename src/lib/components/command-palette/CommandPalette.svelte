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
  let proposedOnly = $state(false);

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
      .filter((result) => !proposedOnly || result.state === 'proposed')
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
      proposedOnly = false;
      // Focus input after dialog animation
      setTimeout(() => inputRef?.focus(), 50);
    }
  });

  // Reset selection when filter changes
  $effect(() => {
    proposedOnly;
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
        <button
          type="button"
          class="filter-btn"
          class:active={proposedOnly}
          onclick={() => (proposedOnly = !proposedOnly)}
          title={proposedOnly ? 'Show all features' : 'Show proposed only'}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            {#if proposedOnly}
              <path
                d="M8 2L14 8L8 14L2 8L8 2Z"
                fill="currentColor"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linejoin="round"
              />
            {:else}
              <path
                d="M8 2L14 8L8 14L2 8L8 2Z"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linejoin="round"
              />
            {/if}
          </svg>
          <span class="filter-label">Proposed only</span>
        </button>
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
    top: 20%;
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

  .filter-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    font-size: 12px;
    color: var(--foreground-muted);
    background: transparent;
    border: 1px solid var(--border-default);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .filter-btn:hover {
    color: var(--foreground);
    border-color: var(--foreground-subtle);
  }

  .filter-btn.active {
    color: var(--state-proposed);
    border-color: var(--state-proposed);
    background: rgba(136, 136, 136, 0.1);
  }

  .filter-label {
    font-weight: 500;
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
