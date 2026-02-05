/**
 * Reactive connection state store.
 * Tracks whether the server is reachable, surfaces startup errors,
 * and triggers reconnection polling.
 */

import { API_BASE_URL } from '$lib/api/client.js';

const POLL_INTERVAL_MS = 2000;

function createConnectionStore() {
  let connected = $state(true);
  let polling = $state(false);
  let startupError = $state<string | null>(null);
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  function setDisconnected() {
    if (!connected) return;
    connected = false;
    startPolling();
  }

  function setConnected() {
    connected = true;
    startupError = null;
    stopPolling();
  }

  function setStartupError(message: string) {
    startupError = message;
    connected = false;
    startPolling();
  }

  function startPolling() {
    if (polling) return;
    polling = true;

    pollTimer = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/health`, {
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) {
          setConnected();
        }
      } catch {
        // Still disconnected — keep polling
      }
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    polling = false;
  }

  return {
    get connected() {
      return connected;
    },
    get startupError() {
      return startupError;
    },
    setDisconnected,
    setConnected,
    setStartupError,
  };
}

export const serverConnection = createConnectionStore();
