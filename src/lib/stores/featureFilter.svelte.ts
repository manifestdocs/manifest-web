/**
 * Shared store for feature tree filter state.
 * Persists filter settings per project across view changes.
 * Supports multiple additive state filters (e.g. proposed + in_progress).
 */

const STORAGE_KEY_PREFIX = 'manifest:ui:feature-filter:';

export type FilterableState = 'proposed' | 'in_progress' | 'blocked';

interface StoredFilterState {
  activeFilters: FilterableState[];
}

function getStorageKey(projectId: string): string {
  return `${STORAGE_KEY_PREFIX}${projectId}`;
}

function loadFromStorage(projectId: string): StoredFilterState | null {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem(getStorageKey(projectId));
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored);
    // Migrate old boolean format
    if ('showProposedOnly' in parsed) {
      return { activeFilters: parsed.showProposedOnly ? ['proposed'] : [] };
    }
    return parsed as StoredFilterState;
  } catch {
    return null;
  }
}

function saveToStorage(projectId: string, state: StoredFilterState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getStorageKey(projectId), JSON.stringify(state));
}

// Current project state - shared across all views
let currentProjectId: string | null = null;
let currentActiveFilters: Set<FilterableState> = new Set();

function persist(): void {
  if (currentProjectId) {
    saveToStorage(currentProjectId, {
      activeFilters: [...currentActiveFilters],
    });
  }
}

function createFeatureFilterStore() {
  return {
    /**
     * Initialize filter state for a project.
     * Returns the set of active filters.
     */
    init(projectId: string): Set<FilterableState> {
      if (projectId === currentProjectId) {
        return new Set(currentActiveFilters);
      }

      currentProjectId = projectId;
      const stored = loadFromStorage(projectId);

      if (stored) {
        currentActiveFilters = new Set(stored.activeFilters);
      } else {
        currentActiveFilters = new Set();
      }

      return new Set(currentActiveFilters);
    },

    /**
     * Get the current active filters.
     */
    get(): Set<FilterableState> {
      return new Set(currentActiveFilters);
    },

    /**
     * Toggle a specific state filter on/off. Persists the change.
     */
    toggle(state: FilterableState): Set<FilterableState> {
      if (currentActiveFilters.has(state)) {
        currentActiveFilters.delete(state);
      } else {
        currentActiveFilters.add(state);
      }
      currentActiveFilters = new Set(currentActiveFilters);
      persist();
      return new Set(currentActiveFilters);
    },

    /**
     * Check if a specific state filter is active.
     */
    has(state: FilterableState): boolean {
      return currentActiveFilters.has(state);
    },

    /**
     * Reset the filter state (useful for testing).
     */
    reset(): void {
      currentProjectId = null;
      currentActiveFilters = new Set();
    },
  };
}

export const featureFilter = createFeatureFilterStore();
