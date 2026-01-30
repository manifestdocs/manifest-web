<script lang="ts">
    import type { components } from "$lib/api/schema.js";
    import {
        BookIcon,
        GroupIcon,
        StateIcon,
    } from "$lib/components/icons/index.js";

    type Feature = components["schemas"]["Feature"];
    type FeatureState = components["schemas"]["FeatureState"];
    type Version = components["schemas"]["Version"];

    interface Props {
        feature: Feature & { is_root?: boolean };
        isRoot: boolean;
        isGroup: boolean;
        activeTab: "view" | "edit" | "diff";
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
        onApplyChanges: () => void;
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
        onApplyChanges,
    }: Props = $props();

    function formatDate(dateStr: string): string {
        return new Date(dateStr).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }
</script>

<div class="detail-header">
    <div class="header-content">
        {#if activeTab === "view"}
            <div class="header-left">
                <h1 class="feature-title">
                    {isRoot ? "Project Context" : feature.title}
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
                                    onStateChange(
                                        e.currentTarget.value as FeatureState,
                                    )}
                                disabled={isSaving}
                            >
                                {#each stateOptions as opt}
                                    <option value={opt.value}
                                        >{opt.label}</option
                                    >
                                {/each}
                            </select>
                        </div>
                    {/if}
                    <span class="meta-item"
                        >Updated {formatDate(feature.updated_at)}</span
                    >
                    {#if !isRoot && !isGroup}
                        <span class="meta-separator">·</span>
                        <span class="meta-item">
                            {currentVersion
                                ? currentVersion.name
                                : "Unassigned"}
                        </span>
                    {/if}
                </div>
            </div>
            <div class="header-right">
                {#if isLocked}
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
                        <span class="locked-text"
                            >in progress features can't be edited</span
                        >
                    </div>
                {:else if isArchived}
                    <div class="header-actions">
                        {#if onRestore}
                            <button
                                class="btn btn-primary"
                                onclick={onRestore}
                                type="button">Restore</button
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
                            <button
                                class="btn btn-warning"
                                onclick={onViewDiff}
                                type="button">Review Changes</button
                            >
                        {/if}
                        {#if onArchive && !isRoot}
                            <button
                                class="btn btn-warning-subtle"
                                onclick={onArchive}
                                type="button">Archive</button
                            >
                        {/if}
                        <button
                            class="btn btn-primary"
                            onclick={onEdit}
                            type="button">Edit</button
                        >
                    </div>
                {/if}
            </div>
        {:else if activeTab === "edit"}
            <div class="header-left">
                {#if isRoot}
                    <h1 class="feature-title">Project Context</h1>
                {:else}
                    <input
                        type="text"
                        class="title-input"
                        value={editTitle}
                        oninput={(e) =>
                            onEditTitleChange(e.currentTarget.value)}
                        placeholder="Feature title"
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
                            <span>{stateOptions.find(
                                    (o) => o.value === feature.state,
                                )?.label}</span>
                        </div>
                    {/if}
                    <span class="meta-item"
                        >Updated {formatDate(feature.updated_at)}</span
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
                        {isSaving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        {:else}
            <!-- Diff tab header -->
            <div class="header-left">
                <h1 class="feature-title">{feature.title}</h1>
                <div class="meta">
                    <span class="diff-badge">Reviewing Changes</span>
                    <span class="meta-item"
                        >Updated {formatDate(feature.updated_at)}</span
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
                    <button
                        class="btn btn-primary"
                        onclick={onApplyChanges}
                        disabled={isSaving}
                        type="button"
                    >
                        {isSaving ? "Applying..." : "Apply Changes"}
                    </button>
                </div>
            </div>
        {/if}
    </div>
</div>

<style>
    .detail-header {
        padding: 20px 36px 16px;
        border-bottom: 1px solid var(--border-default);
    }

    .header-content {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 24px;
        max-width: 800px;
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
        padding: 4px 8px 4px 6px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
    }

    .state-badge {
        background: rgba(33, 38, 45, 0.5);
        color: var(--foreground-muted);
        border: 1px solid var(--border-muted);
    }

    .state-badge[data-state="proposed"] {
        background: rgba(210, 153, 34, 0.15);
        color: var(--state-proposed);
        border-color: rgba(210, 153, 34, 0.3);
    }

    .state-badge[data-state="in_progress"] {
        background: rgba(137, 209, 133, 0.15);
        color: var(--state-in-progress);
        border-color: rgba(137, 209, 133, 0.3);
    }

    .state-badge[data-state="implemented"] {
        background: rgba(156, 220, 254, 0.15);
        color: var(--state-implemented);
        border-color: rgba(156, 220, 254, 0.3);
    }

    .state-badge[data-state="archived"] {
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

    .state-select:focus {
        text-decoration: underline;
    }

    .feature-title {
        font-size: 24px;
        font-weight: 600;
        line-height: 1.3;
        margin: 0 0 8px 0;
        color: var(--foreground);
        letter-spacing: -0.01em;
    }

    .title-input {
        font-size: 24px;
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
        font-size: 13px;
        color: var(--foreground-muted);
    }

    .meta-item {
        white-space: nowrap;
    }

    .meta-separator {
        color: var(--border-default);
    }

    .diff-badge {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
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

    .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 6px 12px;
        font-size: 13px;
        font-weight: 500;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s ease;
        border: 1px solid transparent;
        height: 32px;
    }

    .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .btn-primary {
        background: var(--accent-green);
        color: #0d1117;
        border-color: var(--accent-green);
    }

    .btn-primary:hover:not(:disabled) {
        filter: brightness(1.1);
    }

    .btn-secondary {
        background: transparent;
        color: var(--foreground);
        border-color: var(--border-default);
    }

    .btn-secondary:hover:not(:disabled) {
        background: var(--background-muted);
    }

    .btn-danger {
        background: var(--accent-red);
        color: white;
        border-color: var(--accent-red);
    }

    .btn-warning {
        background: #d29922;
        color: white;
        border-color: #d29922;
    }

    .btn-warning:hover:not(:disabled) {
        filter: brightness(1.1);
    }

    .btn-warning-subtle {
        background: transparent;
        color: #d29922;
        border-color: rgba(210, 153, 34, 0.4);
    }

    .btn-warning-subtle:hover:not(:disabled) {
        background: rgba(210, 153, 34, 0.1);
    }
</style>
