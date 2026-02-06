<script lang="ts">
  import type { components } from '$lib/api/schema.js';
  import { getFlatIndex, type VersionGroup } from './versionUtils.js';

  type Version = components['schemas']['Version'];

  interface Props {
    groupedVersions: VersionGroup[];
    closingVersionId: string | null;
    isNowFeatureComplete: boolean;
    totalVersionColumns: number;
  }

  let {
    groupedVersions,
    closingVersionId,
    isNowFeatureComplete,
    totalVersionColumns,
  }: Props = $props();
</script>

<div class="matrix-subheader" class:complete={isNowFeatureComplete}>
  {#each groupedVersions as group, groupIndex}
    {#each group.versions as version, versionIndex}
      {@const colIndex = getFlatIndex(
        groupIndex,
        versionIndex,
        groupedVersions,
      )}
      <div
        class="subheader-cell version-name"
        class:group-start={versionIndex === 0}
        class:zebra={colIndex % 2 === 0}
        class:feature-complete={isNowFeatureComplete && group.label === 'Next'}
        class:closing={version.id === closingVersionId}
        title={version.description || ''}
      >
        {version.name}
      </div>
    {/each}
  {/each}
  <div
    class="subheader-cell version-name backlog-name group-start"
    class:zebra={totalVersionColumns % 2 === 0}
  >
    &mdash;
  </div>
</div>

<style>
  .matrix-subheader {
    display: flex;
    height: 27px;
    background: var(--background);
    border-bottom: 1px solid var(--border-default);
    overflow: hidden;
  }

  .subheader-cell {
    display: flex;
    align-items: center;
    padding: 0 12px;
    font-size: 11px;
    font-weight: 500;
    color: var(--foreground-muted);
  }

  .version-name {
    flex: 0 0 80px;
    justify-content: center;
    border-left: 1px solid var(--border-subtle);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition:
      flex-basis 0.4s cubic-bezier(0.4, 0, 0.2, 1),
      opacity 0.3s ease;
  }

  .version-name.closing {
    flex-basis: 0;
    opacity: 0;
  }

  .version-name.group-start {
    border-left: 1px solid var(--border-subtle);
  }

  .version-name:last-child,
  .version-name.backlog-name {
    border-right: 1px solid var(--border-subtle);
  }

  .version-name.zebra {
    background: rgba(128, 128, 128, 0.04);
  }

  .matrix-subheader.complete {
    border-bottom: none;
  }

  .matrix-subheader.complete .subheader-cell {
    border-bottom: 1px solid var(--border-default);
  }

  .matrix-subheader.complete .version-name.feature-complete {
    background: var(--state-implemented);
    color: var(--background);
    border-bottom: none;
  }
</style>
