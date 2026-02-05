<script lang="ts">
  import { PlusIcon } from '$lib/components/icons/index.js';
  import type { VersionGroup } from './versionUtils.js';

  interface Props {
    groupedVersions: VersionGroup[];
    closingVersionId: string | null;
    onAddVersion: () => void;
  }

  let { groupedVersions, closingVersionId, onAddVersion }: Props = $props();
</script>

<div class="matrix-header">
  {#each groupedVersions as group}
    {@const isGroupClosing = group.versions.some(
      (v) => v.id === closingVersionId,
    )}
    <div
      class="header-cell group-header"
      class:closing={isGroupClosing}
      style="width: {group.versions.length * 80}px"
    >
      <span class="group-label">{group.label}</span>
    </div>
  {/each}
  <div class="header-cell group-header backlog-header" style="width: 80px">
    <span class="group-label">Backlog</span>
  </div>
  <button
    type="button"
    class="add-version-btn"
    onclick={onAddVersion}
    title="Add version"
  >
    <PlusIcon size={14} />
  </button>
</div>

<style>
  .matrix-header {
    display: flex;
    align-items: center;
    height: 36px;
    background: var(--background);
    border-bottom: 1px solid var(--border-default);
    overflow: hidden;
  }

  .header-cell {
    display: flex;
    align-items: center;
    padding: 0 12px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--foreground-muted);
  }

  .group-header {
    display: flex;
    align-items: center;
    align-self: stretch;
    justify-content: center;
    text-align: center;
    border-left: none;
    flex: none;
    transition:
      width 0.4s cubic-bezier(0.4, 0, 0.2, 1),
      opacity 0.3s ease;
    overflow: hidden;
  }

  .group-header.closing {
    width: 0 !important;
    opacity: 0;
  }

  .group-header:has(+ .backlog-header) {
    border-right: none;
  }

  .backlog-header {
    border-right: none;
  }

  .group-header:has(+ .add-version-btn) {
    border-right: none;
  }

  .group-label {
    font-weight: 600;
    color: var(--foreground);
  }

  .add-version-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    margin-left: 8px;
    background: var(--background);
    border: 1px solid var(--border-default);
    border-radius: 2px;
    color: var(--foreground-muted);
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .add-version-btn:hover {
    background: var(--background-emphasis);
    color: var(--foreground);
    border-color: var(--foreground-subtle);
  }
</style>
