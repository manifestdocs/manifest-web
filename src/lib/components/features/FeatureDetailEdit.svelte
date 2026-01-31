<script lang="ts">
    import type { components } from "$lib/api/schema.js";
    import { MarkdownEditor } from "$lib/components/markdown/index.js";
    type Feature = components["schemas"]["Feature"];
    type Version = components["schemas"]["Version"];

    interface Props {
        feature: Feature & { is_root?: boolean };
        isRoot: boolean;
        isGroup: boolean;
        editDetails: string;
        unreleasedVersions: Version[];
        isSavingVersion: boolean;
        onDetailsChange: (value: string) => void;
        onVersionChange: (versionId: string | null) => Promise<void>;
    }

    let {
        feature,
        isRoot,
        isGroup,
        editDetails,
        unreleasedVersions,
        isSavingVersion,
        onDetailsChange,
        onVersionChange,
    }: Props = $props();

    function handleVersionSelect(e: Event) {
        const select = e.target as HTMLSelectElement;
        const versionId = select.value || null;
        onVersionChange(versionId);
    }
</script>

<div class="details-edit" class:with-sidebar={!isRoot && !isGroup}>
    <div class="editor-main">
        <MarkdownEditor
            value={editDetails}
            onchange={onDetailsChange}
            placeholder={isRoot
                ? "Project-wide instructions.\n\n## Tech Stack\nLanguage, framework, database...\n\n## Conventions\nCoding patterns, error handling, naming...\n\n## Decisions\nKey architectural choices and rationale...\n\n## Boundaries\nSecurity constraints, what agents should never do..."
                : isGroup
                    ? "Shared context for child features.\n\n## Architecture\nHow this area is structured...\n\n## Patterns\nShared interfaces, common approaches...\n\n## Constraints\nCross-cutting requirements for all children..."
                    : "Feature specification.\n\n## Story\nAs a [user], I can [capability] so that [benefit].\n\n## Acceptance Criteria\n- Given [precondition], when [action], then [expected outcome]\n\n## Constraints\n- Technical constraints, performance requirements..."}
            rows={20}
        />
    </div>
    {#if !isRoot && !isGroup}
        <div class="editor-sidebar">
            <div class="sidebar-field">
                <label class="field-label" for="version-select">Version</label>
                <select
                    id="version-select"
                    class="version-select"
                    value={feature.target_version_id ?? ""}
                    onchange={handleVersionSelect}
                    disabled={isSavingVersion}
                >
                    <option value="">Unassigned</option>
                    {#each unreleasedVersions as version (version.id)}
                        <option value={version.id}>{version.name}</option>
                    {/each}
                </select>
            </div>
        </div>
    {/if}
</div>

<style>
    .details-edit {
        display: flex;
        gap: 24px;
        height: 100%;
        min-height: 0;
    }

    .editor-main {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
    }

    .editor-sidebar {
        width: 240px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        gap: 24px;
        padding-left: 24px;
        border-left: 1px solid var(--border-default);
    }

    .sidebar-field {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .field-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--foreground-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .version-select {
        width: 100%;
        padding: 6px 8px;
        font-size: 13px;
        border-radius: 4px;
        border: 1px solid var(--border-default);
        background: var(--background-subtle);
        color: var(--foreground);
    }


</style>
