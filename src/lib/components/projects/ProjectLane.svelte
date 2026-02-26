<script lang="ts">
  import type { components } from '$lib/api/schema.js';
  import { StateIcon } from '$lib/components/icons/index.js';
  import { getTimeBucket } from '$lib/utils/index.js';

  type PortfolioProject = components['schemas']['PortfolioProject'];

  interface Props {
    project: PortfolioProject;
    onProjectClick: (slug: string) => void;
    onFeatureClick: (slug: string, featureId: string) => void;
    onBlockerClick: (slug: string) => void;
    onClose?: (id: string) => void;
  }

  let {
    project,
    onProjectClick,
    onFeatureClick,
    onBlockerClick,
    onClose,
  }: Props = $props();

  // Stalled: no activity in >14 days
  const STALLED_DAYS = 14;
  const stalledInfo = $derived(() => {
    if (!project.last_activity_at) return null;
    const last = new Date(project.last_activity_at).getTime();
    const days = Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24));
    return days >= STALLED_DAYS ? days : null;
  });

  const isStalled = $derived(stalledInfo() !== null);

  const overflowCount = $derived(
    project.in_progress_total - project.in_progress.length,
  );
</script>

<div class="lane" class:stalled={isStalled}>
  <!-- Lane header -->
  <div class="lane-header">
    <div class="header-top">
      <button
        class="project-name"
        onclick={() => onProjectClick(project.slug)}
        title="Open {project.name}"
      >
        {project.name}
      </button>
      {#if onClose}
        <button
          class="close-btn"
          onclick={() => onClose!(project.id)}
          title="Hide {project.name}"
          aria-label="Hide {project.name}"
        >
          ×
        </button>
      {/if}
    </div>

    {#if project.next_version}
      <div class="version-row">
        <span class="version-name">{project.next_version.name}</span>
        {#if project.next_version.feature_count > 0}
          <span class="version-count"
            >{project.next_version.implemented_count}/{project.next_version
              .feature_count}</span
          >
        {/if}
      </div>
      {#if project.next_version.feature_count > 0}
        <div class="version-progress-bar">
          <div
            class="version-progress-fill"
            class:complete={project.next_version.implemented_count ===
              project.next_version.feature_count}
            style="width: {(project.next_version.implemented_count /
              project.next_version.feature_count) *
              100}%"
          ></div>
        </div>
      {/if}
    {/if}
  </div>

  <!-- Next feature -->
  {#if project.next_feature}
    <div class="section">
      <div class="section-label">Next</div>
      <button
        class="feature-row next-feature"
        onclick={() => onFeatureClick(project.slug, project.next_feature!.id)}
        title={project.next_feature.title}
      >
        <StateIcon state="proposed" size={12} />
        <span class="feature-title">{project.next_feature.title}</span>
        {#if !project.next_feature.in_version}
          <span class="backlog-badge">backlog</span>
        {/if}
      </button>
    </div>
    <div class="rule"></div>
  {/if}

  <!-- In progress -->
  {#if project.in_progress.length > 0}
    <div class="section">
      <div class="section-label">In Progress</div>
      {#each project.in_progress as f (f.id)}
        <button
          class="feature-row"
          onclick={() => onFeatureClick(project.slug, f.id)}
          title={f.title}
        >
          <StateIcon state="in_progress" size={12} />
          <span class="feature-title">{f.title}</span>
        </button>
      {/each}
      {#if overflowCount > 0}
        <button
          class="overflow-label"
          onclick={() => onProjectClick(project.slug)}
          title="View all in {project.name}">+{overflowCount} more</button
        >
      {/if}
    </div>
    <div class="rule"></div>
  {/if}

  <!-- Blocked -->
  {#if project.blocked.length > 0}
    <div class="section">
      <div class="section-label blocked-label">Blocked</div>
      {#each project.blocked as f (f.id)}
        <button
          class="feature-row"
          onclick={() => onBlockerClick(project.slug)}
          title={f.title}
        >
          <StateIcon state="blocked" size={12} />
          <span class="feature-title">{f.title}</span>
        </button>
      {/each}
    </div>
    <div class="rule"></div>
  {/if}

  <!-- Recent completions -->
  {#if project.recent_completions.length > 0 || isStalled}
    <div class="section">
      <div class="section-label">Recent</div>
      {#if isStalled && project.recent_completions.length === 0}
        <div class="stalled-label">stalled ({stalledInfo()}d)</div>
      {/if}
      {#each project.recent_completions as f (f.id)}
        <button
          class="feature-row completed"
          onclick={() => onFeatureClick(project.slug, f.id)}
          title={f.title}
        >
          <StateIcon state="implemented" size={12} />
          <span class="feature-title">{f.title}</span>
          {#if f.completed_at}
            <span class="timestamp"
              >{getTimeBucket(new Date(f.completed_at))}</span
            >
          {/if}
        </button>
      {/each}
      {#if isStalled && project.recent_completions.length > 0}
        <div class="stalled-label">stalled ({stalledInfo()}d)</div>
      {/if}
    </div>
  {/if}

  <!-- Empty state -->
  {#if !project.next_feature && project.in_progress.length === 0 && project.blocked.length === 0 && project.recent_completions.length === 0}
    <div class="empty-lane">No active features</div>
  {/if}
</div>

<style>
  .lane {
    height: 100%;
    overflow-y: auto;
    border-right: 1px solid var(--border-default);
    display: flex;
    flex-direction: column;
    background: var(--background);
  }

  .lane.stalled .lane-header {
    opacity: 0.7;
  }

  /* --- Header --- */

  .lane-header {
    padding: 12px 14px 10px;
    border-bottom: 1px solid var(--border-default);
    background: var(--background-subtle);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .header-top {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .project-name {
    flex: 1;
    min-width: 0;
    text-align: left;
    font-size: 15px;
    font-weight: 600;
    color: var(--foreground);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.15s ease;
  }

  .project-name:hover {
    color: var(--accent-blue);
  }

  .close-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    font-size: 16px;
    line-height: 1;
    color: var(--foreground-subtle);
    background: none;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    opacity: 0;
    transition:
      opacity 0.1s ease,
      color 0.1s ease,
      background 0.1s ease;
  }

  .lane-header:hover .close-btn {
    opacity: 1;
  }

  .close-btn:hover {
    color: var(--foreground);
    background: var(--background-emphasis);
  }

  .version-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
  }

  .version-name {
    font-size: 12px;
    color: var(--foreground-subtle);
    font-family: var(--font-mono, monospace);
  }

  .version-count {
    font-size: 11px;
    color: var(--foreground-subtle);
    font-family: var(--font-mono, monospace);
  }

  .version-progress-bar {
    height: 3px;
    background: var(--border-default);
    border-radius: 2px;
    margin-top: 6px;
    overflow: hidden;
  }

  .version-progress-fill {
    height: 100%;
    background: var(--accent-blue);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .version-progress-fill.complete {
    background: var(--state-implemented);
  }

  /* --- Sections --- */

  .section {
    padding: 8px 0 4px;
  }

  .section-label {
    padding: 0 14px 4px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--foreground-subtle);
  }

  .blocked-label {
    color: var(--state-blocked);
  }

  .rule {
    height: 1px;
    background: var(--border-muted);
    margin: 0 14px;
  }

  /* --- Feature rows --- */

  .feature-row {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 6px 14px;
    font-size: 13px;
    text-align: left;
    background: none;
    border: none;
    color: var(--foreground-muted);
    cursor: pointer;
    transition:
      background 0.1s ease,
      color 0.1s ease;
    white-space: nowrap;
    overflow: hidden;
  }

  .feature-row:hover {
    background: var(--background-muted);
    color: var(--foreground);
  }

  .next-feature {
    color: var(--foreground);
  }

  .completed {
    opacity: 0.6;
  }

  .completed:hover {
    opacity: 1;
  }

  .feature-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .timestamp {
    font-size: 11px;
    color: var(--foreground-subtle);
    flex-shrink: 0;
  }

  .backlog-badge {
    flex-shrink: 0;
    font-size: 11px;
    color: var(--foreground-subtle);
    background: var(--background-muted);
    border: 1px solid var(--border-default);
    border-radius: 3px;
    padding: 0 4px;
    line-height: 1.6;
  }

  .overflow-label {
    display: block;
    width: 100%;
    padding: 2px 14px 4px;
    font-size: 12px;
    text-align: left;
    color: var(--foreground-subtle);
    background: none;
    border: none;
    cursor: pointer;
    transition: color 0.1s ease;
  }

  .overflow-label:hover {
    color: var(--accent-blue);
  }

  .stalled-label {
    padding: 2px 14px 4px;
    font-size: 12px;
    color: var(--accent-orange);
  }

  .empty-lane {
    padding: 24px 14px;
    font-size: 12px;
    color: var(--foreground-subtle);
    text-align: center;
    flex: 1;
  }
</style>
