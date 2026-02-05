<script lang="ts">
  import type { components } from '$lib/api/schema.js';
  import { BookIcon, GroupIcon } from '$lib/components/icons/index.js';

  type FeatureTreeNode = components['schemas']['FeatureTreeNode'];

  interface Props {
    features: FeatureTreeNode[];
    projectTitle: string;
    selectedId: string | null;
    width?: number;
    onSelect: (id: string | null) => void;
  }

  let {
    features,
    projectTitle,
    selectedId,
    width = 350,
    onSelect,
  }: Props = $props();

  const MAX_DEPTH = 3;

  // Get group children of root nodes (excluding root itself and leaves)
  function getTopLevelGroups(nodes: FeatureTreeNode[]): FeatureTreeNode[] {
    return nodes
      .flatMap((n) => (n.is_root ? n.children : [n]))
      .filter((n) => n.children.length > 0);
  }

  function getChildGroups(nodes: FeatureTreeNode[]): FeatureTreeNode[] {
    return nodes.filter((n) => n.children.length > 0);
  }
</script>

<nav class="activity-nav" style="width: {width}px">
  <div class="nav-header">
    <span class="nav-title">Activity Log</span>
  </div>

  <div class="nav-subheader"></div>

  <div class="nav-content">
    <button
      class="nav-row project-row"
      class:active={!selectedId}
      onclick={() => onSelect(null)}
    >
      <span class="project-icon"><BookIcon size={16} /></span>
      <span class="row-title">{projectTitle}</span>
    </button>

    {#each getTopLevelGroups(features) as feature}
      {@render featureItem(feature, 0)}
    {/each}
  </div>
</nav>

{#snippet featureItem(node: FeatureTreeNode, depth: number)}
  <button
    class="nav-row"
    class:active={selectedId === node.id}
    style="padding-left: {6 + (depth + 1) * 14}px"
    onclick={() => onSelect(node.id)}
  >
    <span class="set-icon"><GroupIcon size={18} /></span>
    <span class="row-title">{node.title}</span>
  </button>
  {#if depth < MAX_DEPTH - 1}
    {#each getChildGroups(node.children) as child}
      {@render featureItem(child, depth + 1)}
    {/each}
  {/if}
{/snippet}

<style>
  .activity-nav {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    height: 100%;
    overflow: hidden;
    background: var(--background);
    border-right: 1px solid var(--border-default);
  }

  .nav-header {
    display: flex;
    align-items: center;
    height: 36px;
    padding: 0 12px;
    background: var(--background-subtle);
    border-bottom: 1px solid var(--border-default);
  }

  .nav-title {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--foreground-muted);
  }

  .nav-subheader {
    height: 27px;
    background: var(--background);
    border-bottom: 1px solid var(--border-default);
  }

  .nav-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
  }

  .nav-row {
    display: flex;
    align-items: center;
    gap: 7px;
    height: 28px;
    min-height: 28px;
    padding-left: 6px;
    font-size: 14px;
    color: var(--foreground);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border-subtle);
    cursor: pointer;
    text-align: left;
    transition: background-color 0.1s ease;
  }

  .nav-row:hover {
    background: var(--background-muted);
  }

  .nav-row.active {
    background: var(--background-emphasis);
  }

  .nav-row.project-row {
    background: var(--background-subtle);
    border-bottom: 1px solid var(--border-default);
  }

  .nav-row.project-row.active {
    background: var(--background-emphasis);
  }

  .project-icon {
    display: flex;
    position: relative;
    top: 1px;
  }

  .set-icon {
    display: flex;
    position: relative;
  }

  .row-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
