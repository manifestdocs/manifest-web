<script lang="ts">
  import { MarkdownEditor } from '$lib/components/markdown/index.js';

  interface Props {
    isRoot: boolean;
    isGroup: boolean;
    editDetails: string;
    onDetailsChange: (value: string) => void;
  }

  let {
    isRoot,
    isGroup,
    editDetails,
    onDetailsChange,
  }: Props = $props();
</script>

<div class="details-edit">
  <MarkdownEditor
    value={editDetails}
    onchange={onDetailsChange}
    placeholder={isRoot
      ? 'Project-wide instructions.\n\n## Tech Stack\nLanguage, framework, database...\n\n## Conventions\nCoding patterns, error handling, naming...\n\n## Decisions\nKey architectural choices and rationale...\n\n## Boundaries\nSecurity constraints, what agents should never do...'
      : isGroup
        ? 'Shared context for child features.\n\n## Architecture\nHow this area is structured...\n\n## Patterns\nShared interfaces, common approaches...\n\n## Constraints\nCross-cutting requirements for all children...'
        : 'Feature specification.\n\n## Goal\nWhat this feature does and why.\n\n## Constraints\nPerformance, security, compatibility requirements.\n\n## Interfaces\nKey function signatures (if applicable).\n\n## Examples\n1-3 concrete examples of expected behavior (if helpful).'}
  />
</div>

<style>
  .details-edit {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
</style>
