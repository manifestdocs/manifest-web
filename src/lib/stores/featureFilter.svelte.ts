/**
 * Shared store for feature tree filter state.
 * Persists filter settings per project across view changes.
 */

const STORAGE_KEY_PREFIX = 'manifest:ui:feature-filter:';

interface StoredFilterState {
	showProposedOnly: boolean;
}

function getStorageKey(projectId: string): string {
	return `${STORAGE_KEY_PREFIX}${projectId}`;
}

function loadFromStorage(projectId: string): StoredFilterState | null {
	if (typeof window === 'undefined') return null;

	const stored = localStorage.getItem(getStorageKey(projectId));
	if (!stored) return null;

	try {
		return JSON.parse(stored) as StoredFilterState;
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
let currentShowProposedOnly = false;

function createFeatureFilterStore() {
	return {
		/**
		 * Initialize filter state for a project.
		 * Returns persisted state if available, or defaults to false.
		 */
		init(projectId: string): boolean {
			// Same project - return current state
			if (projectId === currentProjectId) {
				return currentShowProposedOnly;
			}

			// Different project - load from storage or default
			currentProjectId = projectId;
			const stored = loadFromStorage(projectId);

			if (stored) {
				currentShowProposedOnly = stored.showProposedOnly;
			} else {
				currentShowProposedOnly = false;
			}

			return currentShowProposedOnly;
		},

		/**
		 * Get the current filter state.
		 */
		get(): boolean {
			return currentShowProposedOnly;
		},

		/**
		 * Toggle the proposed-only filter. Persists the change.
		 */
		toggle(): boolean {
			currentShowProposedOnly = !currentShowProposedOnly;

			if (currentProjectId) {
				saveToStorage(currentProjectId, {
					showProposedOnly: currentShowProposedOnly
				});
			}

			return currentShowProposedOnly;
		},

		/**
		 * Set the filter state explicitly. Persists the change.
		 */
		set(value: boolean): boolean {
			currentShowProposedOnly = value;

			if (currentProjectId) {
				saveToStorage(currentProjectId, {
					showProposedOnly: currentShowProposedOnly
				});
			}

			return currentShowProposedOnly;
		},

		/**
		 * Reset the filter state (useful for testing).
		 */
		reset(): void {
			currentProjectId = null;
			currentShowProposedOnly = false;
		}
	};
}

export const featureFilter = createFeatureFilterStore();
