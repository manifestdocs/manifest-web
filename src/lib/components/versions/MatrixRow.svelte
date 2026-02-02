<script lang="ts">
  import type { components } from '$lib/api/schema.js';
  import { GroupIcon, StateIcon } from '$lib/components/icons/index.js';
  import MatrixRow from './MatrixRow.svelte';

  type FeatureTreeNode = components['schemas']['FeatureTreeNode'];
  type Version = components['schemas']['Version'];
  type FeatureState = components['schemas']['FeatureState'];

  interface Props {
    feature: FeatureTreeNode;
    versions: Version[];
    selectedId: string | null;
    expandedIds: Set<string>;
    depth?: number;
    onSelect: (id: string) => void;
    onToggle: (id: string) => void;
  }

  let {
    feature,
    versions,
    selectedId,
    expandedIds,
    depth = 0,
    onSelect,
    onToggle,
  }: Props = $props();

  const hasChildren = $derived(feature.children && feature.children.length > 0);
  const isExpanded = $derived(expandedIds.has(feature.id));
  const isSelected = $derived(selectedId === feature.id);

  // Only show connector for non-implemented features
  const showsConnector = $derived(
    feature.state !== 'implemented' && feature.state !== 'archived',
  );

  function handleTreeClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('.toggle-btn')) {
      return;
    }
    onSelect(feature.id);
  }

  function handleToggleClick(e: MouseEvent) {
    e.stopPropagation();
    onToggle(feature.id);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(feature.id);
    } else if (e.key === 'ArrowRight' && hasChildren && !isExpanded) {
      e.preventDefault();
      onToggle(feature.id);
    } else if (e.key === 'ArrowLeft' && hasChildren && isExpanded) {
      e.preventDefault();
      onToggle(feature.id);
    }
  }
</script>

<!-- Row container using display:contents for grid layout -->
<div class="matrix-row" style="display: contents;">
  <!-- Tree cell -->
  <div
    class="tree-cell"
    class:selected={isSelected}
    style="padding-left: {depth * 16 + 8}px"
    onclick={handleTreeClick}
    onkeydown={handleKeydown}
    tabindex="0"
    role="treeitem"
    aria-selected={isSelected}
    aria-expanded={hasChildren ? isExpanded : undefined}
  >
    {#if hasChildren}
      <button
        class="toggle-btn"
        onclick={handleToggleClick}
        type="button"
        tabindex={-1}
        aria-label={isExpanded ? 'Collapse' : 'Expand'}
      >
        <svg
          class="chevron"
          class:expanded={isExpanded}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M6 4L10 8L6 12"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    {:else}
      <span class="toggle-spacer"></span>
    {/if}

    {#if hasChildren}
      <GroupIcon size={16} />
    {:else}
      <StateIcon state={feature.state} size={16} />
    {/if}

    <span class="title" title={feature.title}>{feature.title}</span>

    <!-- Connector line extends from title to version columns -->
    {#if showsConnector && feature.target_version_id}
      <span class="connector-line"></span>
    {/if}
  </div>

  <!-- Version cells -->
  {#each versions as version (version.id)}
    <div
      class="version-cell"
      class:has-connector={showsConnector &&
        feature.target_version_id === version.id}
    >
      {#if showsConnector && feature.target_version_id === version.id}
        <span class="connector-dot"></span>
      {/if}
    </div>
  {/each}

  <!-- Unassigned column -->
  <div
    class="version-cell unassigned-cell"
    class:has-connector={showsConnector && !feature.target_version_id}
  >
    {#if showsConnector && !feature.target_version_id}
      <span class="connector-dot"></span>
    {/if}
  </div>
</div>

<!-- Recursively render children -->
{#if hasChildren && isExpanded}
  {#each feature.children as child (child.id)}
    <MatrixRow
      feature={child}
      {versions}
      {selectedId}
      {expandedIds}
      depth={depth + 1}
      {onSelect}
      {onToggle}
    />
  {/each}
{/if}

<style>
  .tree-cell {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    background: transparent;
    color: var(--foreground);
    font-size: 13px;
    cursor: pointer;
    transition: background-color 0.1s ease;
    position: relative;
    min-width: 0;
  }

  .tree-cell:hover {
    background: var(--background-muted);
  }

  .tree-cell.selected {
    background: var(--background-emphasis);
  }

  .tree-cell:focus {
    outline: none;
    background: var(--background-muted);
  }

  .tree-cell:focus-visible {
    outline: 2px solid var(--accent-blue);
    outline-offset: -2px;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    color: inherit;
  }

  .toggle-btn:hover {
    color: var(--foreground);
  }

  .toggle-spacer {
    width: 16px;
    flex-shrink: 0;
  }

  .chevron {
    color: var(--foreground-subtle);
    transition: transform 0.15s ease;
  }

  .chevron.expanded {
    transform: rotate(90deg);
  }

  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .connector-line {
    flex-shrink: 0;
    height: 1px;
    flex: 0 0 auto;
    width: 16px;
    background: var(--border-default);
    border-style: dashed;
  }

  .version-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    border-left: 1px solid var(--border-default);
    min-height: 32px;
  }

  .version-cell.has-connector::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 50%;
    height: 1px;
    border-top: 1px dashed var(--foreground-muted);
  }

  .connector-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--state-proposed);
    position: relative;
    z-index: 1;
  }

  .unassigned-cell {
    background: var(--background-subtle);
  }

  .unassigned-cell .connector-dot {
    background: var(--foreground-muted);
  }
</style>
