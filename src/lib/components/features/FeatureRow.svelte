<script lang="ts">
  import type { components } from '$lib/api/schema.js';
  import {
    BookIcon,
    GroupIcon,
    StateIcon,
  } from '$lib/components/icons/index.js';

  type FeatureTreeNode = components['schemas']['FeatureTreeNode'];

  interface Props {
    feature: FeatureTreeNode;
    depth: number;
    isSelected: boolean;
    isExpanded: boolean;
    showTrack?: boolean;
    hasProposed?: boolean;
    hasInProgress?: boolean;
    isHovered?: boolean;
    isDraggable?: boolean;
    isDragging?: boolean;
    isLongPressActive?: boolean;
    onSelect: (id: string) => void;
    onToggle: (id: string) => void;
    onContextMenu?: (id: string, x: number, y: number) => void;
    onRowPointerDown?: (featureId: string, e: PointerEvent) => void;
    shouldSuppressClick?: () => boolean;
  }

  let {
    feature,
    depth,
    isSelected,
    isExpanded,
    showTrack = false,
    hasProposed = false,
    hasInProgress = false,
    isHovered = false,
    isDraggable = false,
    isDragging = false,
    isLongPressActive = false,
    onSelect,
    onToggle,
    onContextMenu,
    onRowPointerDown,
    shouldSuppressClick,
  }: Props = $props();

  const hasChildren = $derived(feature.children && feature.children.length > 0);
  // Root can be explicitly marked, or inferred from depth 0
  const isRoot = $derived((feature.is_root ?? false) || depth === 0);

  function handleToggleClick(e: Event) {
    e.stopPropagation();
    onToggle(feature.id);
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    onContextMenu?.(feature.id, e.clientX, e.clientY);
  }

  function handlePointerDown(e: PointerEvent) {
    if (!isDraggable || isRoot) return;
    onRowPointerDown?.(feature.id, e);
  }

  function handleClick() {
    if (shouldSuppressClick?.()) return;
    onSelect(feature.id);
  }
</script>

<button
  type="button"
  class="feature-row"
  class:selected={isSelected}
  class:hovered={isHovered}
  class:is-root={isRoot}
  class:is-dragging={isDragging}
  class:long-press-active={isLongPressActive}
  style:--depth={depth}
  onclick={handleClick}
  onpointerdown={handlePointerDown}
  oncontextmenu={handleContextMenu}
>
  {#if isRoot}
    <span class="project-icon"><BookIcon size={16} /></span>
  {:else if hasChildren}
    <button
      type="button"
      class="toggle-btn"
      onclick={handleToggleClick}
      aria-label={isExpanded ? 'Collapse' : 'Expand'}
      tabindex={-1}
    >
      <svg
        class="chevron"
        class:expanded={isExpanded}
        width="15"
        height="15"
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
    <span class="set-icon"><GroupIcon size={18} /></span>
  {:else}
    <span class="toggle-spacer"></span>
    <StateIcon state={feature.state} size={15} />
  {/if}

  <span class="feature-title">{feature.title}</span>

  {#if hasChildren && !isRoot && (hasProposed || hasInProgress)}
    <span class="state-indicators">
      {#if hasProposed}
        <span class="future-work-indicator" title="Has incomplete work">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
            <path d="M8 2L14 8L8 14L2 8Z" fill="var(--state-proposed)" />
          </svg>
        </span>
      {/if}
      {#if hasInProgress}
        <span class="in-progress-indicator" title="Has work in progress">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
            <circle
              cx="8"
              cy="8"
              r="5.5"
              stroke="var(--state-in-progress)"
              stroke-width="1.5"
              fill="none"
            />
          </svg>
        </span>
      {/if}
    </span>
  {/if}

  {#if feature.desired_details}
    <span class="changes-badge" title="Has pending changes">changes</span>
  {/if}

  {#if showTrack}
    <span class="track"></span>
  {/if}
</button>

<style>
  .feature-row {
    /* Layout constants */
    --row-height: 28px;
    --indent-size: 10px;
    --base-padding: 4px;
    --root-padding: 13px;
    position: relative;
    flex: 0 0 var(--feature-col-width, 350px);
    min-width: 200px;
    height: 28px;
    min-height: 28px;
    flex-shrink: 0;
    padding-left: calc(var(--depth, 0) * var(--indent-size) + var(--base-padding));
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    color: var(--foreground);
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    overflow: hidden;
    transition:
      background-color 0.1s ease,
      opacity 0.1s ease;
  }

  .feature-row.is-root {
    padding-left: calc(var(--depth, 0) * var(--indent-size) + var(--root-padding));
    background: var(--background-subtle);
    border-bottom: 1px solid var(--border-default);
  }

  .feature-row:hover,
  .feature-row.hovered {
    background: var(--row-hover-bg, var(--background-muted));
  }

  .feature-row.selected {
    background: var(--background-emphasis);
  }

  .feature-row.is-dragging {
    opacity: 0.5;
  }

  .feature-row.long-press-active {
    background: var(--background-muted);
    cursor: grabbing;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--foreground-subtle);
    flex-shrink: 0;
  }

  .toggle-btn:hover {
    color: var(--foreground);
  }

  .toggle-spacer {
    width: 18px;
    flex-shrink: 0;
  }

  .chevron {
    transition: transform 0.15s ease;
  }

  .chevron.expanded {
    transform: rotate(90deg);
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

  .feature-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 1;
    min-width: 0;
  }

  .changes-badge {
    flex-shrink: 0;
    font-size: 10px;
    color: var(--state-proposed);
    font-weight: 500;
    opacity: 0.85;
  }

  .state-indicators {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .future-work-indicator,
  .in-progress-indicator {
    display: flex;
    align-items: center;
  }

  .track {
    flex: 1;
    height: 1px;
    border-top: 1px dashed var(--border-default);
    margin-left: 8px;
    align-self: center;
  }
</style>
