<script lang="ts">
  import { diffLines, type Change } from 'diff';

  interface Props {
    current: string | null;
    desired: string | null;
  }

  let { current, desired }: Props = $props();

  const changes = $derived<Change[]>(diffLines(current ?? '', desired ?? ''));
</script>

<div class="diff-view">
  {#each changes as change}
    <div
      class="diff-block"
      class:added={change.added}
      class:removed={change.removed}
    >
      <span class="diff-marker"
        >{change.added ? '+' : change.removed ? '-' : ' '}</span
      >
      <pre class="diff-content">{change.value}</pre>
    </div>
  {/each}
</div>

<style>
  .diff-view {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 13px;
    line-height: 1.5;
    border: 1px solid var(--border-default);
    border-radius: 6px;
    overflow: hidden;
  }

  .diff-block {
    display: flex;
    padding: 0;
    margin: 0;
  }

  .diff-marker {
    flex-shrink: 0;
    width: 24px;
    padding: 0 8px;
    text-align: center;
    color: var(--foreground-subtle);
    user-select: none;
  }

  .diff-content {
    flex: 1;
    margin: 0;
    padding: 2px 8px 2px 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .added {
    background: rgba(46, 160, 67, 0.15);
  }

  .added .diff-marker {
    background: rgba(46, 160, 67, 0.25);
    color: var(--state-implemented);
  }

  .removed {
    background: rgba(248, 81, 73, 0.15);
  }

  .removed .diff-marker {
    background: rgba(248, 81, 73, 0.25);
    color: #f85149;
  }
</style>
