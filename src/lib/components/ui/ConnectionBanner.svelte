<script lang="ts">
  import InfoBanner from './InfoBanner.svelte';
  import { serverConnection } from '$lib/stores/index.js';

  interface Props {
    spacerWidth?: string;
  }

  let { spacerWidth }: Props = $props();
</script>

{#if !serverConnection.connected}
  <InfoBanner variant="warning" {spacerWidth}>
    {#snippet icon()}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 2v4" />
        <path d="m16.24 7.76-2.12 2.12" />
        <path d="M20 12h-4" />
        <path d="m16.24 16.24-2.12-2.12" />
        <path d="M12 18v4" />
        <path d="m7.76 16.24 2.12-2.12" />
        <path d="M4 12h4" />
        <path d="m7.76 7.76 2.12 2.12" />
      </svg>
    {/snippet}
    <span class="reconnecting-text">
      Reconnecting to server<span class="dots"></span>
    </span>
  </InfoBanner>
{/if}

<style>
  .reconnecting-text {
    font-weight: 500;
  }

  .dots::after {
    content: '';
    animation: dots 1.5s steps(4, end) infinite;
  }

  @keyframes dots {
    0% {
      content: '';
    }
    25% {
      content: '.';
    }
    50% {
      content: '..';
    }
    75% {
      content: '...';
    }
  }
</style>
