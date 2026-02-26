<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
    icon?: Snippet;
    spacerWidth?: string;
    variant?: 'info' | 'warning' | 'error' | 'changes';
    class?: string;
  }

  let {
    children,
    icon,
    spacerWidth,
    variant = 'info',
    class: className = '',
  }: Props = $props();
</script>

<div class="info-banner {className}" data-variant={variant}>
  {#if spacerWidth}
    <div
      class="banner-spacer"
      style="flex: 0 0 {spacerWidth}; min-width: 200px;"
    ></div>
  {/if}
  <div class="banner-content" class:has-spacer={!!spacerWidth}>
    {#if icon}
      <span class="banner-icon">
        {@render icon()}
      </span>
    {:else}
      <svg
        class="banner-icon"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    {/if}
    <span class="banner-text">
      {@render children()}
    </span>
  </div>
</div>

<style>
  .info-banner {
    display: flex;
    border-bottom: 1px solid var(--border-default);
  }

  .banner-spacer {
    background: var(--background);
  }

  .banner-content {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: rgba(156, 220, 254, 0.2);
    color: var(--foreground);
    font-size: 13px;
    line-height: 1.4;
  }

  .banner-content.has-spacer {
    border-left: 1px solid var(--border-default);
  }

  .banner-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    color: var(--state-implemented);
  }

  .banner-text {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .info-banner[data-variant='warning'] .banner-content {
    background: rgba(204, 167, 0, 0.15);
    color: var(--foreground);
  }

  .info-banner[data-variant='warning'] .banner-icon {
    color: var(--state-proposed);
  }

  .info-banner[data-variant='error'] .banner-content {
    background: rgba(248, 81, 73, 0.15);
    color: var(--foreground);
  }

  .info-banner[data-variant='error'] .banner-icon {
    color: #f85149;
  }

  .info-banner[data-variant='changes'] .banner-content {
    background: rgba(163, 113, 247, 0.15);
    color: var(--foreground);
  }

  .info-banner[data-variant='changes'] .banner-icon {
    color: var(--accent-purple);
  }
</style>
