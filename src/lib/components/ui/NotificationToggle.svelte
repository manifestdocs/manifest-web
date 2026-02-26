<script lang="ts">
  import { BellIcon } from '$lib/components/icons/index.js';
  import { notifications } from '$lib/stores/notifications.svelte.js';

  const permission = $derived(notifications.permission);
  const isActive = $derived(notifications.isActive);
  const isDenied = $derived(permission === 'denied');
  const isSupported = $derived(notifications.isSupported);

  const label = $derived.by(() => {
    if (!isSupported) return 'Notifications not supported';
    if (isDenied) return 'Notifications blocked by browser';
    if (isActive) return 'Notifications enabled';
    return 'Enable notifications';
  });

  async function handleClick() {
    if (!isSupported || isDenied) return;
    await notifications.toggle();
  }
</script>

<button
  class="notification-btn"
  class:active={isActive}
  class:denied={isDenied}
  class:unsupported={!isSupported}
  onclick={handleClick}
  title={label}
  aria-label={label}
  disabled={isDenied || !isSupported}
>
  <BellIcon size={16} muted={!isActive} />
</button>

<style>
  .notification-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--background);
    border: 1px solid var(--border-default);
    border-top: none;
    border-left: none;
    border-radius: 0;
    color: var(--foreground-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .notification-btn:hover:not(:disabled) {
    background: var(--background-emphasis);
    color: var(--foreground);
    border-color: var(--foreground-subtle);
    outline: 1px solid var(--foreground-subtle);
    outline-offset: -1px;
    z-index: 1;
  }

  .notification-btn.active {
    color: var(--state-implemented);
  }

  .notification-btn.active:hover {
    color: var(--state-implemented);
  }

  .notification-btn.denied,
  .notification-btn.unsupported {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
