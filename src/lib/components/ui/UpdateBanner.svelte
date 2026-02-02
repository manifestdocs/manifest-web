<script lang="ts">
  import InfoBanner from './InfoBanner.svelte';

  interface Props {
    spacerWidth?: string;
  }

  let { spacerWidth }: Props = $props();

  let currentVersion = $state<string | null>(null);
  let latestVersion = $state<string | null>(null);
  let dismissed = $state(false);
  let loading = $state(true);

  const UPDATE_DISMISSED_KEY = 'manifest_update_dismissed';

  // Check if this version was dismissed
  function isDismissed(version: string): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(UPDATE_DISMISSED_KEY) === version;
  }

  // Dismiss the banner for this version
  function dismiss() {
    if (latestVersion && typeof localStorage !== 'undefined') {
      localStorage.setItem(UPDATE_DISMISSED_KEY, latestVersion);
    }
    dismissed = true;
  }

  // Compare semver versions (returns true if latest > current)
  function isNewerVersion(current: string, latest: string): boolean {
    const currentParts = current.replace(/^v/, '').split('.').map(Number);
    const latestParts = latest.replace(/^v/, '').split('.').map(Number);

    for (
      let i = 0;
      i < Math.max(currentParts.length, latestParts.length);
      i++
    ) {
      const c = currentParts[i] || 0;
      const l = latestParts[i] || 0;
      if (l > c) return true;
      if (l < c) return false;
    }
    return false;
  }

  // Check for updates on mount
  $effect(() => {
    checkForUpdates();
  });

  async function checkForUpdates() {
    loading = true;
    try {
      // Fetch current version from server
      const versionResponse = await fetch('/api/v1/version');
      if (!versionResponse.ok) {
        loading = false;
        return;
      }
      const versionData = await versionResponse.json();
      currentVersion = versionData.version;

      // Fetch latest version from GitHub
      const githubResponse = await fetch(versionData.releases_url);
      if (!githubResponse.ok) {
        loading = false;
        return;
      }
      const releaseData = await githubResponse.json();
      latestVersion = releaseData.tag_name?.replace(/^v/, '') || null;

      // Check if dismissed
      if (latestVersion && isDismissed(latestVersion)) {
        dismissed = true;
      }
    } catch {
      // Silent fail - don't show banner on network errors
    } finally {
      loading = false;
    }
  }

  const showBanner = $derived(
    !loading &&
      !dismissed &&
      currentVersion &&
      latestVersion &&
      isNewerVersion(currentVersion, latestVersion),
  );
</script>

{#if showBanner}
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
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    {/snippet}
    <span>
      Manifest <strong>v{latestVersion}</strong> is available (you have v{currentVersion}).
      Run <code>brew upgrade manifest</code> to update.
    </span>
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
  code {
    padding: 2px 6px;
    font-size: 12px;
    font-family: var(--font-mono, monospace);
    background: rgba(0, 0, 0, 0.15);
    border-radius: 3px;
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
