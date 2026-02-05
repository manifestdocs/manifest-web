<script lang="ts">
  import type { components } from '$lib/api/schema.js';
  import { MarkdownView } from '$lib/components/markdown/index.js';
  import { InfoBanner } from '$lib/components/ui/index.js';

  type Feature = components['schemas']['Feature'];

  interface Props {
    feature: Feature & { is_root?: boolean };
    isRoot: boolean;
    isGroup: boolean;
    hasPendingChanges: boolean;
    showHighlight: boolean;
    onViewDiff: () => void;
  }

  let {
    feature,
    isRoot,
    isGroup,
    hasPendingChanges,
    showHighlight,
    onViewDiff,
  }: Props = $props();
</script>

{#if isRoot}
  <InfoBanner class="content-banner">
    Project instructions — all agents read this. Include tech stack,
    conventions, and decisions.
  </InfoBanner>
{:else if isGroup}
  <InfoBanner class="content-banner">
    Shared context — flows to all child features. Include architecture and
    constraints for this area.
  </InfoBanner>
{/if}

{#if hasPendingChanges}
  <InfoBanner variant="warning" class="content-banner">
    This feature has pending changes that need to be implemented by an agent. <button
      class="banner-link"
      onclick={onViewDiff}
      type="button">Review changes</button
    > or discard them.
  </InfoBanner>
{/if}

<div class="details-view" class:highlight={showHighlight}>
  {#if feature.details}
    <MarkdownView content={feature.details} />
  {:else}
    <p class="no-details">
      {isRoot
        ? 'No project instructions yet. Click Edit to add tech stack, conventions, and decisions.'
        : isGroup
          ? 'No shared context yet. Click Edit to add architectural decisions and constraints for child features.'
          : 'No specification yet. Click Edit to describe what this feature does — goal, constraints, and key interfaces.'}
    </p>
  {/if}
</div>

<style>
  :global(.content-banner) {
    margin: -20px -26px 24px;
  }

  :global(.content-banner .banner-content) {
    padding-left: 26px;
  }

  :global(.content-banner + .content-banner) {
    margin-top: -24px;
  }

  .banner-link {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
    color: inherit;
  }

  .details-view {
    font-size: 14px;
    line-height: 1.6;
    color: var(--foreground);
    transition: background-color 0.3s ease;
    border-radius: 8px;
    padding: 4px;
    margin: -4px;
  }

  .details-view.highlight {
    background-color: rgba(210, 153, 34, 0.1);
  }

  .no-details {
    color: var(--foreground-subtle);
    font-style: italic;
    text-align: center;
    padding: 40px 0;
  }
</style>
