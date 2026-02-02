<script lang="ts">
  import type { components } from '$lib/api/schema.js';
  import HistoryEntry from './HistoryEntry.svelte';

  type ProjectHistoryEntry = components['schemas']['ProjectHistoryEntry'];

  interface Props {
    entries: ProjectHistoryEntry[];
    isLoading?: boolean;
    gitRemote?: string;
    onFeatureClick?: (featureId: string) => void;
  }

  let {
    entries,
    isLoading = false,
    gitRemote,
    onFeatureClick,
  }: Props = $props();

  type TimeGroup = {
    label: string;
    entries: ProjectHistoryEntry[];
  };

  function getTimeBucket(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    // Compare calendar days, not just time difference
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const entryDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    const diffCalendarDays = Math.floor(
      (today.getTime() - entryDay.getTime()) / 86400000,
    );

    if (diffMins < 5) return 'just now';
    if (diffMins < 60)
      return `${Math.floor(diffMins / 15) * 15 || 15} mins ago`;
    if (diffCalendarDays === 0 && diffHours === 1) return '1 hour ago';
    if (diffCalendarDays === 0 && diffHours < 4)
      return `${diffHours} hours ago`;
    if (diffCalendarDays === 0) return 'earlier today';
    if (diffCalendarDays === 1) return 'yesterday';
    if (diffCalendarDays < 7) return `${diffCalendarDays} days ago`;
    if (diffCalendarDays < 14) return '1 week ago';
    if (diffCalendarDays < 28)
      return `${Math.floor(diffCalendarDays / 7)} weeks ago`;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  let groupedEntries = $derived.by(() => {
    if (!entries || entries.length === 0) return [];

    const groups: TimeGroup[] = [];
    let currentBucket = '';
    let currentGroup: ProjectHistoryEntry[] = [];

    for (const entry of entries) {
      const bucket = getTimeBucket(new Date(entry.created_at));
      if (bucket !== currentBucket) {
        if (currentGroup.length > 0) {
          groups.push({
            label: currentBucket,
            entries: currentGroup,
          });
        }
        currentBucket = bucket;
        currentGroup = [entry];
      } else {
        currentGroup.push(entry);
      }
    }

    if (currentGroup.length > 0) {
      groups.push({ label: currentBucket, entries: currentGroup });
    }

    return groups;
  });
</script>

<div class="history-list">
  {#if isLoading}
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Loading history...</span>
    </div>
  {:else if !entries || entries.length === 0}
    <div class="empty-state">
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <path
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <p>No history yet</p>
      <span class="empty-hint">Complete features to see their history here</span
      >
    </div>
  {:else}
    <div class="timeline">
      {#each groupedEntries as group, i (group.label + i)}
        <div class="time-group">
          <div class="time-marker">
            <span class="pill">{group.label}</span>
          </div>
          <div class="entries">
            {#each group.entries as entry (entry.id)}
              <HistoryEntry {entry} {gitRemote} {onFeatureClick} />
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .history-list {
    height: 100%;
    overflow-y: auto;
    padding: 60px 24px 20px 24px;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: var(--foreground-subtle);
    gap: 12px;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-default);
    border-top-color: var(--accent-blue);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 300px;
    color: var(--foreground-subtle);
    gap: 12px;
    text-align: center;
  }

  .empty-state svg {
    opacity: 0.5;
  }

  .empty-state p {
    margin: 0;
    font-size: 16px;
    font-weight: 500;
  }

  .empty-hint {
    font-size: 14px;
    opacity: 0.7;
  }

  .timeline {
    display: flex;
    flex-direction: column;
  }

  .time-group {
    display: grid;
    grid-template-columns: 100px 1fr;
    gap: 32px;
    position: relative;
  }

  /* Vertical connecting line - centered in the marker column */
  .time-group::before {
    content: '';
    position: absolute;
    left: 50px;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--border-default);
  }

  /* Hide line at the very top and bottom */
  .time-group:first-child::before {
    top: 12px;
  }

  .time-group:last-child::before {
    bottom: 16px;
  }

  .time-marker {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    position: relative;
    z-index: 1;
  }

  .pill {
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 500;
    text-transform: lowercase;
    color: var(--foreground-subtle);
    background: var(--background);
    border: 1px solid var(--border-default);
    border-radius: 999px;
    white-space: nowrap;
  }

  .entries {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-bottom: 16px;
  }

  .entries :global(:first-child) {
    margin-top: 0;
  }
</style>
