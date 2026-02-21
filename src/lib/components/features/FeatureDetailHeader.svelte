<script lang="ts">
  import type { components } from '$lib/api/schema.js';
  import {
    BookIcon,
    GroupIcon,
    StateIcon,
  } from '$lib/components/icons/index.js';

  type Feature = components['schemas']['Feature'];
  type FeatureState = components['schemas']['FeatureState'];
  type Version = components['schemas']['Version'];

  interface Props {
    feature: Feature & { is_root?: boolean };
    isRoot: boolean;
    isGroup: boolean;
    activeTab: 'view' | 'edit' | 'diff';
    isSaving: boolean;
    isLocked: boolean;
    isArchived: boolean;
    hasPendingChanges: boolean;
    currentVersion: Version | null | undefined;
    editTitle: string;
    stateOptions: { value: FeatureState; label: string }[];
    onEditTitleChange: (value: string) => void;
    onStateChange: (state: FeatureState) => void;
    onRestore?: () => void;
    onDeleteRequest: () => void;
    onArchive?: () => void;
    onViewDiff: () => void;
    onEdit: () => void;
    onCancel: () => void;
    onSave: () => void;
    onDiscardChanges: () => void;
    onStartWorking?: () => void;
  }

  let {
    feature,
    isRoot,
    isGroup,
    activeTab,
    isSaving,
    isLocked,
    isArchived,
    hasPendingChanges,
    currentVersion,
    editTitle,
    stateOptions,
    onEditTitleChange,
    onStateChange,
    onRestore,
    onDeleteRequest,
    onArchive,
    onViewDiff,
    onEdit,
    onCancel,
    onSave,
    onDiscardChanges,
    onStartWorking,
  }: Props = $props();

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
</script>

<div class="detail-header">
  <div class="header-content">
    {#if activeTab === 'view'}
      <div class="header-left">
        <h1 class="feature-title">
          {isRoot ? 'Project Context' : feature.title}
        </h1>
        <div class="meta">
          {#if isRoot}
            <div class="project-badge">
              <BookIcon size={14} />
              <span>Project Context</span>
            </div>
          {:else if isGroup}
            <div class="group-badge">
              <GroupIcon size={14} />
              <span>Feature Set</span>
            </div>
          {:else}
            <div class="state-badge" data-state={feature.state}>
              <StateIcon state={feature.state} size={14} />
              <select
                class="state-select"
                value={feature.state}
                onchange={(e) =>
                  onStateChange(e.currentTarget.value as FeatureState)}
                disabled={isSaving}
                aria-label="Feature state"
              >
                {#each stateOptions as opt}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
            </div>
          {/if}
          {#if hasPendingChanges}
            <span class="changes-badge">changes</span>
          {/if}
          <span class="meta-item">Updated {formatDate(feature.updated_at)}</span
          >
          {#if !isRoot && !isGroup}
            <span class="meta-separator">·</span>
            <span class="meta-item">
              {currentVersion ? currentVersion.name : 'Unassigned'}
            </span>
          {/if}
        </div>
      </div>
      <div class="header-right">
        {#if isRoot || isGroup}
          <div class="header-actions">
            <button class="btn btn-primary" onclick={onEdit} type="button"
              >Edit</button
            >
          </div>
        {:else if isLocked}
          <div class="locked-indicator">
            <svg
              class="lock-icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span class="locked-text">in progress features can't be edited</span
            >
          </div>
        {:else if isArchived}
          <div class="header-actions">
            {#if onRestore}
              <button class="btn btn-primary" onclick={onRestore} type="button"
                >Restore</button
              >
            {/if}
            {#if onDeleteRequest}
              <button
                class="btn btn-danger"
                onclick={onDeleteRequest}
                type="button">Delete Permanently</button
              >
            {/if}
          </div>
        {:else}
          <div class="header-actions">
            {#if hasPendingChanges}
              <button class="btn btn-warning" onclick={onViewDiff} type="button"
                >Review Changes</button
              >
            {/if}
            {#if onArchive}
              <button
                class="btn btn-warning-subtle"
                onclick={onArchive}
                type="button">Archive</button
              >
            {/if}
            <button class="btn btn-primary" onclick={onEdit} type="button"
              >Edit</button
            >
            {#if onStartWorking}
              <button
                class="btn btn-agent"
                onclick={onStartWorking}
                type="button"
              >Implement</button>
            {/if}
          </div>
        {/if}
      </div>
    {:else if activeTab === 'edit'}
      <div class="header-left">
        {#if isRoot}
          <h1 class="feature-title">Project Context</h1>
        {:else}
          <input
            type="text"
            class="title-input"
            value={editTitle}
            oninput={(e) => onEditTitleChange(e.currentTarget.value)}
            placeholder="Feature title"
            aria-label="Feature title"
          />
        {/if}
        <div class="meta">
          {#if isRoot}
            <div class="project-badge">
              <BookIcon size={14} />
              <span>Project Context</span>
            </div>
          {:else if isGroup}
            <div class="group-badge">
              <GroupIcon size={14} />
              <span>Feature Set</span>
            </div>
          {:else}
            <div class="state-badge" data-state={feature.state}>
              <StateIcon state={feature.state} size={14} />
              <span
                >{stateOptions.find((o) => o.value === feature.state)
                  ?.label}</span
              >
            </div>
          {/if}
          <span class="meta-item">Updated {formatDate(feature.updated_at)}</span
          >
        </div>
      </div>
      <div class="header-right">
        <div class="title-actions">
          <button
            class="btn btn-secondary"
            onclick={onCancel}
            disabled={isSaving}
            type="button">Cancel</button
          >
          <button
            class="btn btn-primary"
            onclick={onSave}
            disabled={isSaving}
            type="button"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    {:else}
      <!-- Diff tab header -->
      <div class="header-left">
        <h1 class="feature-title">{feature.title}</h1>
        <div class="meta">
          <span class="diff-badge">Pending Changes</span>
          <span class="meta-item">Updated {formatDate(feature.updated_at)}</span
          >
        </div>
      </div>
      <div class="header-right">
        <div class="title-actions">
          <button
            class="btn btn-secondary"
            onclick={onCancel}
            disabled={isSaving}
            type="button">Cancel</button
          >
          <button
            class="btn btn-danger"
            onclick={onDiscardChanges}
            disabled={isSaving}
            type="button">Discard</button
          >
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .detail-header {
    box-sizing: border-box;
    min-height: 91px;
    padding: 20px 21px 0 26px;
    border-bottom: 1px solid var(--border-default);
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
  }

  .header-left {
    flex: 1;
    min-width: 0;
  }

  .header-right {
    flex-shrink: 0;
  }

  .project-badge,
  .group-badge,
  .state-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px 2px 6px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 500;
  }

  .state-badge {
    background: rgba(33, 38, 45, 0.5);
    color: var(--foreground-muted);
    border: 1px solid var(--border-muted);
  }

  .state-badge[data-state='proposed'] {
    background: rgba(210, 153, 34, 0.15);
    color: var(--state-proposed);
    border-color: rgba(210, 153, 34, 0.3);
  }

  .state-badge[data-state='in_progress'] {
    background: rgba(137, 209, 133, 0.15);
    color: var(--state-in-progress);
    border-color: rgba(137, 209, 133, 0.3);
  }

  .state-badge[data-state='implemented'] {
    background: rgba(156, 220, 254, 0.15);
    color: var(--state-implemented);
    border-color: rgba(156, 220, 254, 0.3);
  }

  .state-badge[data-state='blocked'] {
    background: rgba(248, 81, 73, 0.15);
    color: var(--state-blocked);
    border-color: rgba(248, 81, 73, 0.3);
  }

  .state-badge[data-state='archived'] {
    background: rgba(110, 118, 129, 0.15);
    color: var(--state-archived);
    border-color: rgba(110, 118, 129, 0.3);
  }

  .project-badge,
  .group-badge {
    background: var(--background-muted);
    color: var(--foreground);
    border: 1px solid var(--border-muted);
  }

  .state-select {
    appearance: none;
    background: transparent;
    color: inherit;
    border: none;
    font-size: inherit;
    font-weight: inherit;
    padding: 0;
    margin: 0;
    cursor: pointer;
    outline: none;
  }

  .state-select:focus-visible {
    outline: 2px solid var(--accent-blue);
    outline-offset: 2px;
    border-radius: 2px;
  }

  .feature-title {
    font-size: 22px;
    font-weight: 600;
    line-height: 1.3;
    margin: 0 0 8px 0;
    color: var(--foreground);
    letter-spacing: -0.01em;
  }

  .title-input {
    font-size: 22px;
    font-weight: 600;
    line-height: 1.3;
    margin: 0 0 8px 0;
    color: var(--foreground);
    background: transparent;
    border: none;
    width: 100%;
    outline: none;
    padding: 0;
  }

  .title-input:focus {
    /* Show simple underline on focus instead of box */
    box-shadow: 0 1px 0 0 var(--accent-blue);
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--foreground-muted);
  }

  .meta-item {
    white-space: nowrap;
  }

  .meta-separator {
    color: var(--border-default);
  }

  .changes-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 10px;
    font-weight: 500;
    background: rgba(210, 153, 34, 0.15);
    color: #d29922;
    border: 1px solid rgba(210, 153, 34, 0.3);
  }

  .diff-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 10px;
    font-weight: 500;
    background: rgba(210, 153, 34, 0.15);
    color: #d29922;
    border: 1px solid rgba(210, 153, 34, 0.3);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .title-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }

  .locked-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--background-subtle);
    border: 1px solid var(--border-default);
    border-radius: 6px;
    color: var(--foreground-muted);
  }

  .locked-text {
    font-size: 13px;
  }

  /* Button styles are global from dialog.css */
</style>
