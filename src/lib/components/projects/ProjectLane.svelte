<script lang="ts">
  import type { components } from '$lib/api/schema.js';

  type PortfolioProject = components['schemas']['PortfolioProject'];

  interface Props {
    project: PortfolioProject;
    onProjectClick: (slug: string) => void;
    onFeatureClick: (slug: string, featureId: string) => void;
    onBlockerClick: (slug: string) => void;
  }

  let { project, onProjectClick, onFeatureClick, onBlockerClick }: Props = $props();

  // Dot progress bar — up to 5 dots
  const MAX_DOTS = 5;
  const dotProgress = $derived(() => {
    const v = project.next_version;
    if (!v || v.feature_count === 0) return null;
    const total = Math.min(v.feature_count, MAX_DOTS);
    const filled = Math.round((v.implemented_count / v.feature_count) * total);
    return { filled, empty: total - filled, complete: v.implemented_count >= v.feature_count };
  });

  // Stalled: no activity in >14 days
  const STALLED_DAYS = 14;
  const stalledInfo = $derived(() => {
    if (!project.last_activity_at) return null;
    const last = new Date(project.last_activity_at).getTime();
    const days = Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24));
    return days >= STALLED_DAYS ? days : null;
  });

  const isStalled = $derived(stalledInfo() !== null);
  const isVersionComplete = $derived(
    !!project.next_version &&
      project.next_version.implemented_count >= project.next_version.feature_count &&
      project.next_version.feature_count > 0,
  );

  const overflowCount = $derived(project.in_progress_total - project.in_progress.length);
</script>

<div class="lane" class:stalled={isStalled}>
  <!-- Lane header -->
  <div class="lane-header">
    <button
      class="project-name"
      onclick={() => onProjectClick(project.slug)}
      title="Open {project.name}"
    >
      {project.name}
    </button>

    {#if project.next_version}
      <div class="version-row">
        <span class="version-name">{project.next_version.name}</span>
        {#if isVersionComplete}
          <span class="version-complete">✓ complete</span>
        {:else if dotProgress()}
          <span class="dot-bar" aria-label="{project.next_version.implemented_count} of {project.next_version.feature_count} done">
            {#each { length: dotProgress()!.filled } as _}
              <span class="dot filled">●</span>
            {/each}
            {#each { length: dotProgress()!.empty } as _}
              <span class="dot empty">○</span>
            {/each}
          </span>
        {/if}
      </div>
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
        <span class="feature-dot proposed">◇</span>
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
          <span class="feature-dot in-progress">○</span>
          <span class="feature-title">{f.title}</span>
        </button>
      {/each}
      {#if overflowCount > 0}
        <div class="overflow-label">+{overflowCount} more</div>
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
          <span class="feature-dot blocked">✗</span>
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
          <span class="feature-dot implemented">●</span>
          <span class="feature-title">{f.title}</span>
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

  .project-name {
    display: block;
    width: 100%;
    text-align: left;
    font-size: 13px;
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

  .version-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
  }

  .version-name {
    font-size: 11px;
    color: var(--foreground-subtle);
    font-family: var(--font-mono, monospace);
  }

  .dot-bar {
    display: flex;
    gap: 2px;
    font-size: 10px;
    line-height: 1;
  }

  .dot.filled {
    color: var(--state-implemented);
  }

  .dot.empty {
    color: var(--foreground-subtle);
  }

  .version-complete {
    font-size: 11px;
    color: var(--accent-green);
    font-weight: 500;
  }

  /* --- Sections --- */

  .section {
    padding: 8px 0 4px;
  }

  .section-label {
    padding: 0 14px 4px;
    font-size: 10px;
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
    align-items: baseline;
    gap: 6px;
    width: 100%;
    padding: 4px 14px;
    font-size: 12px;
    text-align: left;
    background: none;
    border: none;
    color: var(--foreground-muted);
    cursor: pointer;
    transition: background 0.1s ease, color 0.1s ease;
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

  .feature-dot {
    flex-shrink: 0;
    font-size: 10px;
    line-height: 1;
    margin-top: 1px;
  }

  .feature-dot.proposed { color: var(--state-proposed); }
  .feature-dot.in-progress { color: var(--state-in-progress); }
  .feature-dot.blocked { color: var(--state-blocked); }
  .feature-dot.implemented { color: var(--state-implemented); }

  .feature-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .backlog-badge {
    flex-shrink: 0;
    font-size: 10px;
    color: var(--foreground-subtle);
    background: var(--background-muted);
    border: 1px solid var(--border-default);
    border-radius: 3px;
    padding: 0 4px;
    line-height: 1.6;
  }

  .overflow-label {
    padding: 2px 14px 4px;
    font-size: 11px;
    color: var(--foreground-subtle);
  }

  .stalled-label {
    padding: 2px 14px 4px;
    font-size: 11px;
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
