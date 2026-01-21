import type { components } from '$lib/api/schema.js';

export type FeatureTreeNode = components['schemas']['FeatureTreeNode'];

const STORAGE_KEY_PREFIX = 'manifest:ui:feature-expansion:';
const ROW_HEIGHT = 25;
const STORAGE_VERSION = 1;

interface StoredExpansionState {
	userExpanded: string[];
	userCollapsed: string[];
	version: number;
}

// Track completion status to detect newly-complete groups
let previousCompletionStatus = new Map<string, boolean>();

function getStorageKey(projectId: string): string {
	return `${STORAGE_KEY_PREFIX}${projectId}`;
}

function loadFromStorage(projectId: string): StoredExpansionState | null {
	if (typeof window === 'undefined') return null;

	const stored = localStorage.getItem(getStorageKey(projectId));
	if (!stored) return null;

	try {
		const parsed = JSON.parse(stored);
		if (parsed.version === STORAGE_VERSION) {
			return parsed as StoredExpansionState;
		}
	} catch {
		// Invalid JSON, ignore
	}
	return null;
}

function saveToStorage(projectId: string, state: StoredExpansionState): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem(getStorageKey(projectId), JSON.stringify(state));
}

function countTotalRows(nodes: FeatureTreeNode[]): number {
	let count = 0;
	for (const node of nodes) {
		count += 1;
		if (node.children.length > 0) {
			count += countTotalRows(node.children);
		}
	}
	return count;
}

function getAllGroupIds(nodes: FeatureTreeNode[]): string[] {
	const ids: string[] = [];
	for (const node of nodes) {
		if (node.children.length > 0) {
			ids.push(node.id);
			ids.push(...getAllGroupIds(node.children));
		}
	}
	return ids;
}

function isGroupComplete(node: FeatureTreeNode): boolean {
	// A group is complete if all descendants are implemented or deprecated
	if (node.children.length === 0) {
		return node.state === 'implemented' || node.state === 'deprecated';
	}
	return node.children.every((child) => isGroupComplete(child));
}

function hasIncompleteDescendants(node: FeatureTreeNode): boolean {
	// Check if any descendant is proposed or in_progress
	if (node.children.length === 0) {
		return node.state === 'proposed' || node.state === 'in_progress';
	}
	return node.children.some((child) => hasIncompleteDescendants(child));
}

function getGroupsWithIncompleteWork(nodes: FeatureTreeNode[]): string[] {
	const ids: string[] = [];
	for (const node of nodes) {
		if (node.children.length > 0) {
			if (hasIncompleteDescendants(node)) {
				ids.push(node.id);
			}
			ids.push(...getGroupsWithIncompleteWork(node.children));
		}
	}
	return ids;
}

function buildCompletionMap(nodes: FeatureTreeNode[]): Map<string, boolean> {
	const map = new Map<string, boolean>();
	for (const node of nodes) {
		if (node.children.length > 0) {
			map.set(node.id, isGroupComplete(node));
			const childMap = buildCompletionMap(node.children);
			childMap.forEach((v, k) => map.set(k, v));
		}
	}
	return map;
}

// Current project state
let currentProjectId: string | null = null;
let userExpanded = new Set<string>();
let userCollapsed = new Set<string>();

function createFeatureExpansionStore() {
	return {
		/**
		 * Initialize expansion state for a project.
		 * Applies smart defaults if no persisted state, or restores user preferences.
		 */
		init(projectId: string, features: FeatureTreeNode[], containerHeight: number): Set<string> {
			const stored = loadFromStorage(projectId);
			currentProjectId = projectId;

			// Build completion map for auto-close detection
			previousCompletionStatus = buildCompletionMap(features);

			if (stored) {
				// Restore user preferences
				userExpanded = new Set(stored.userExpanded);
				userCollapsed = new Set(stored.userCollapsed);

				// Calculate which groups should be expanded based on defaults + user overrides
				const totalRows = countTotalRows(features);
				const needsScrolling = totalRows * ROW_HEIGHT > containerHeight;

				let defaultExpanded: Set<string>;
				if (needsScrolling) {
					// Only expand groups with incomplete work by default
					defaultExpanded = new Set(getGroupsWithIncompleteWork(features));
				} else {
					// Expand all groups by default
					defaultExpanded = new Set(getAllGroupIds(features));
				}

				// Apply user overrides
				const expanded = new Set(defaultExpanded);
				for (const id of userExpanded) {
					expanded.add(id);
				}
				for (const id of userCollapsed) {
					expanded.delete(id);
				}

				return expanded;
			}

			// No stored state - calculate smart defaults
			userExpanded = new Set();
			userCollapsed = new Set();

			const totalRows = countTotalRows(features);
			const needsScrolling = totalRows * ROW_HEIGHT > containerHeight;

			if (needsScrolling) {
				// Collapse complete groups, expand incomplete ones
				return new Set(getGroupsWithIncompleteWork(features));
			} else {
				// Expand all
				return new Set(getAllGroupIds(features));
			}
		},

		/**
		 * Toggle a group's expanded state. Tracks user preference and persists.
		 */
		toggle(id: string, currentExpanded: Set<string>): Set<string> {
			const newExpanded = new Set(currentExpanded);
			const wasExpanded = currentExpanded.has(id);

			if (wasExpanded) {
				newExpanded.delete(id);
				// Track as user-collapsed (remove from user-expanded if present)
				userExpanded.delete(id);
				userCollapsed.add(id);
			} else {
				newExpanded.add(id);
				// Track as user-expanded (remove from user-collapsed if present)
				userCollapsed.delete(id);
				userExpanded.add(id);
			}

			// Persist
			if (currentProjectId) {
				saveToStorage(currentProjectId, {
					userExpanded: [...userExpanded],
					userCollapsed: [...userCollapsed],
					version: STORAGE_VERSION
				});
			}

			return newExpanded;
		},

		/**
		 * Handle tree updates (e.g., from SSE). Auto-collapses newly-complete groups.
		 */
		handleTreeUpdate(features: FeatureTreeNode[], currentExpanded: Set<string>): Set<string> {
			const newCompletionStatus = buildCompletionMap(features);
			const newExpanded = new Set(currentExpanded);
			let changed = false;

			// Check for newly complete groups
			for (const [id, isComplete] of newCompletionStatus) {
				const wasComplete = previousCompletionStatus.get(id) ?? false;
				if (isComplete && !wasComplete && currentExpanded.has(id)) {
					// This group just became complete - auto-collapse it
					// But only if the user hasn't explicitly expanded it
					if (!userExpanded.has(id)) {
						newExpanded.delete(id);
						changed = true;
					}
				}
			}

			// Update tracking
			previousCompletionStatus = newCompletionStatus;

			return changed ? newExpanded : currentExpanded;
		},

		/**
		 * Get metadata about a group node for rendering indicators.
		 */
		getGroupMetadata(node: FeatureTreeNode): { isComplete: boolean; hasFutureWork: boolean } {
			return {
				isComplete: isGroupComplete(node),
				hasFutureWork: hasIncompleteDescendants(node)
			};
		},

		/**
		 * Expand all groups.
		 */
		expandAll(features: FeatureTreeNode[]): Set<string> {
			// Clear user preferences (they're expanding everything)
			userExpanded = new Set();
			userCollapsed = new Set();

			if (currentProjectId) {
				saveToStorage(currentProjectId, {
					userExpanded: [],
					userCollapsed: [],
					version: STORAGE_VERSION
				});
			}

			return new Set(getAllGroupIds(features));
		},

		/**
		 * Collapse all groups.
		 */
		collapseAll(): Set<string> {
			// Clear user preferences (they're collapsing everything)
			userExpanded = new Set();
			userCollapsed = new Set();

			if (currentProjectId) {
				saveToStorage(currentProjectId, {
					userExpanded: [],
					userCollapsed: [],
					version: STORAGE_VERSION
				});
			}

			return new Set();
		}
	};
}

export const featureExpansion = createFeatureExpansionStore();
