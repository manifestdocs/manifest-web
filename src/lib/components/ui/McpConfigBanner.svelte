<script lang="ts">
  import InfoBanner from './InfoBanner.svelte';
  import { getApiBaseUrl } from '$lib/api/client.js';

  interface Props {
    spacerWidth?: string;
  }

  let { spacerWidth }: Props = $props();

  let configured = $state<boolean | null>(null);
  let agent = $state('claude');
  let setupHint = $state('');
  let dismissed = $state(false);
  let loading = $state(true);
  let configuring = $state(false);

  const DISMISSED_KEY = 'manifest_mcp_dismissed';

  function isDismissed(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(DISMISSED_KEY) === 'true';
  }

  function dismiss() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DISMISSED_KEY, 'true');
    }
    dismissed = true;
  }

  $effect(() => {
    checkStatus();
  });

  async function checkStatus() {
    if (isDismissed()) {
      dismissed = true;
      loading = false;
      return;
    }

    loading = true;
    try {
      const response = await fetch(`${getApiBaseUrl()}/settings/mcp-status`);
      if (!response.ok) {
        loading = false;
        return;
      }
      const data = await response.json();
      configured = data.configured;
      agent = data.agent;
      setupHint = data.setup_hint || '';
    } catch {
      // Silent fail — don't show banner on errors
    } finally {
      loading = false;
    }
  }

  async function autoConfigure() {
    configuring = true;
    try {
      const response = await fetch(`${getApiBaseUrl()}/settings/configure-mcp`, {
        method: 'POST',
      });
      if (response.ok) {
        // Re-check status to confirm
        await checkStatus();
        // Clear dismissed state so the banner hides naturally
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(DISMISSED_KEY);
        }
        dismissed = false;
      }
    } catch {
      // Silent fail
    } finally {
      configuring = false;
    }
  }

  const showBanner = $derived(
    !loading && !dismissed && configured === false,
  );
</script>

{#if showBanner}
  <InfoBanner variant="info" {spacerWidth}>
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
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    {/snippet}
    <span>
      MCP not configured for {agent === 'claude' ? 'Claude Code' : agent}.
      Add the Manifest plugin to enable AI features in the terminal.
    </span>
    <button
      class="configure-btn"
      onclick={autoConfigure}
      disabled={configuring}
    >
      {configuring ? 'Configuring...' : 'Configure'}
    </button>
    <button class="dismiss-btn" onclick={dismiss} title="Dismiss">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  </InfoBanner>
{/if}

<style>
  .configure-btn {
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 500;
    background: var(--state-implemented);
    color: var(--background);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
    transition: opacity 0.15s ease;
  }

  .configure-btn:hover {
    opacity: 0.9;
  }

  .configure-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .dismiss-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    margin-left: auto;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--foreground-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .dismiss-btn:hover {
    background: rgba(0, 0, 0, 0.1);
    color: var(--foreground);
  }
</style>
