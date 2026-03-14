/**
 * Browser notification store.
 * Manages permission state, user preferences, debouncing, and firing notifications
 * when features are completed by AI agents.
 */

import type { components } from '$lib/api/schema.js';

type FeatureTreeNode = components['schemas']['FeatureTreeNode'];

const STORAGE_KEY = 'manifest:notifications';
const DEBOUNCE_MS = 3000;

export type NotificationEvent = 'feature_completed' | 'verification_failed' | 'session_stalled';

interface NotificationPreferences {
  enabled: boolean;
  events: Record<NotificationEvent, boolean>;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  events: {
    feature_completed: true,
    verification_failed: true,
    session_stalled: true,
  },
};

function loadPreferences(): NotificationPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_PREFERENCES, ...parsed, events: { ...DEFAULT_PREFERENCES.events, ...parsed.events } };
    }
  } catch {
    // Invalid JSON, use defaults
  }
  return DEFAULT_PREFERENCES;
}

function savePreferences(prefs: NotificationPreferences): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

/**
 * Collect all leaf features from a tree into a flat map of id -> state.
 */
function collectLeafStates(nodes: FeatureTreeNode[]): Map<string, { state: string; title: string; projectSlug?: string }> {
  const map = new Map<string, { state: string; title: string; projectSlug?: string }>();
  function walk(node: FeatureTreeNode) {
    if (node.children.length === 0) {
      map.set(node.id, { state: node.state, title: node.title });
    } else {
      for (const child of node.children) walk(child);
    }
  }
  for (const node of nodes) walk(node);
  return map;
}

function createNotificationStore() {
  let preferences = $state<NotificationPreferences>(loadPreferences());
  let permissionState = $state<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'denied',
  );

  // Track previous feature states per project to detect transitions
  const previousStates = new Map<string, Map<string, { state: string; title: string }>>();

  // Debounce buffer for batching multiple completions
  let pendingCompletions: { title: string; featureId: string; projectSlug: string }[] = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function flushNotifications() {
    debounceTimer = null;
    const batch = pendingCompletions.splice(0);
    if (batch.length === 0) return;

    if (batch.length === 1) {
      const item = batch[0];
      fireNotification(
        `${item.title} is now implemented`,
        { featureId: item.featureId, projectSlug: item.projectSlug },
      );
    } else {
      // Group by project slug
      const byProject = new Map<string, typeof batch>();
      for (const item of batch) {
        const list = byProject.get(item.projectSlug) ?? [];
        list.push(item);
        byProject.set(item.projectSlug, list);
      }

      for (const [, items] of byProject) {
        const firstItem = items[0];
        fireNotification(
          `${items.length} features completed`,
          { featureId: firstItem.featureId, projectSlug: firstItem.projectSlug },
        );
      }
    }
  }

  function fireNotification(body: string, data: { featureId: string; projectSlug: string }) {
    if (!isSupported() || permissionState !== 'granted' || !preferences.enabled) return;

    try {
      const notification = new Notification('Manifest', {
        body,
        icon: '/favicon.svg',
        tag: `manifest-${data.featureId}`,
      });

      notification.onclick = () => {
        window.focus();
        const url = `/app/${data.projectSlug}?feature=${data.featureId}`;
        // Use pushState + popstate to trigger SvelteKit navigation
        window.location.href = url;
        notification.close();
      };
    } catch {
      // Notification constructor can fail in some contexts (e.g., service workers not available)
    }
  }

  function isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  return {
    get enabled() {
      return preferences.enabled;
    },

    get permission() {
      return permissionState;
    },

    get events() {
      return preferences.events;
    },

    get isSupported() {
      return isSupported();
    },

    /** Whether notifications are fully operational (supported + granted + enabled) */
    get isActive() {
      return isSupported() && permissionState === 'granted' && preferences.enabled;
    },

    /**
     * Request notification permission from the browser.
     * Returns the resulting permission state.
     */
    async requestPermission(): Promise<NotificationPermission> {
      if (!isSupported()) return 'denied';

      try {
        const result = await Notification.requestPermission();
        permissionState = result;
        return result;
      } catch {
        return 'denied';
      }
    },

    /**
     * Toggle notifications on/off.
     * If permission hasn't been granted yet, requests it first.
     */
    async toggle(): Promise<void> {
      if (!isSupported()) return;

      if (!preferences.enabled && permissionState === 'default') {
        const result = await this.requestPermission();
        if (result !== 'granted') return;
      }

      preferences = { ...preferences, enabled: !preferences.enabled };
      savePreferences(preferences);
    },

    /**
     * Toggle a specific event type.
     */
    toggleEvent(event: NotificationEvent): void {
      preferences = {
        ...preferences,
        events: { ...preferences.events, [event]: !preferences.events[event] },
      };
      savePreferences(preferences);
    },

    /**
     * Set a specific event type enabled/disabled.
     */
    setEvent(event: NotificationEvent, enabled: boolean): void {
      preferences = {
        ...preferences,
        events: { ...preferences.events, [event]: enabled },
      };
      savePreferences(preferences);
    },

    /**
     * Process a new feature tree and detect features that transitioned to 'implemented'.
     * Call this after each SSE-triggered re-fetch.
     * Always tracks state (even when notifications are off) so that enabling
     * notifications mid-session produces correct diffs immediately.
     */
    processTreeUpdate(projectId: string, projectSlug: string, newTree: FeatureTreeNode[]): void {
      const newStates = collectLeafStates(newTree);
      const oldStates = previousStates.get(projectId);

      if (oldStates && this.isActive && preferences.events.feature_completed) {
        // Compare: find features that changed to 'implemented'
        for (const [id, newInfo] of newStates) {
          if (newInfo.state !== 'implemented') continue;
          const oldInfo = oldStates.get(id);
          if (oldInfo && oldInfo.state !== 'implemented') {
            // This feature just transitioned to implemented
            pendingCompletions.push({
              title: newInfo.title,
              featureId: id,
              projectSlug,
            });
          }
        }

        // Flush with debounce
        if (pendingCompletions.length > 0 && !debounceTimer) {
          debounceTimer = setTimeout(flushNotifications, DEBOUNCE_MS);
        }
      }

      // Always update stored states so diffs are correct when notifications are toggled on
      previousStates.set(projectId, newStates);
    },

    /**
     * Clear stored states for a project (e.g., when navigating away).
     */
    clearProject(projectId: string): void {
      previousStates.delete(projectId);
    },

    /**
     * Send a custom notification (for verification_failed, session_stalled, etc.).
     */
    notify(
      event: NotificationEvent,
      body: string,
      data: { featureId: string; projectSlug: string },
    ): void {
      if (!this.isActive || !preferences.events[event]) return;
      fireNotification(body, data);
    },
  };
}

export const notifications = createNotificationStore();
