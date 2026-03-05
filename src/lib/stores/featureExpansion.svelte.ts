import type { components } from '$lib/api/schema.js';

export type FeatureTreeNode = components['schemas']['FeatureTreeNode'];

const STORAGE_KEY_PREFIX = 'manifest:ui:feature-expansion:';
const ROW_HEIGHT = 28;
const STORAGE_VERSION = 2;

interface StoredExpansionState {
  expandedIds: string[];
  hasUserInteracted: boolean;
  version: number;
}

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
    // Migration from v1: clear old format
    if (parsed.version === 1) {
      localStorage.removeItem(getStorageKey(projectId));
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
  // A group is complete if all descendants are implemented or archived
  if (node.children.length === 0) {
    return node.state === 'implemented' || node.state === 'archived';
  }
  return node.children.every((child) => isGroupComplete(child));
}

function hasIncompleteDescendants(node: FeatureTreeNode): boolean {
  // Check if any descendant is proposed, blocked, or in_progress
  if (node.children.length === 0) {
    return node.state === 'proposed' || node.state === 'blocked' || node.state === 'in_progress';
  }
  return node.children.some((child) => hasIncompleteDescendants(child));
}

function hasInProgressDescendants(node: FeatureTreeNode): boolean {
  if (node.children.length === 0) {
    return node.state === 'in_progress';
  }
  return node.children.some((child) => hasInProgressDescendants(child));
}

function hasProposedDescendants(node: FeatureTreeNode): boolean {
  if (node.children.length === 0) {
    return node.state === 'proposed';
  }
  return node.children.some((child) => hasProposedDescendants(child));
}

function hasBlockedDescendants(node: FeatureTreeNode): boolean {
  if (node.children.length === 0) {
    return node.state === 'blocked';
  }
  return node.children.some((child) => hasBlockedDescendants(child));
}

function hasDescendantWithVersion(
  node: FeatureTreeNode,
  versionId: string | null,
): boolean {
  if (node.children.length === 0) {
    return versionId === null
      ? !node.target_version_id
      : node.target_version_id === versionId;
  }
  return node.children.some((child) =>
    hasDescendantWithVersion(child, versionId),
  );
}

function getGroupsContainingVersion(
  nodes: FeatureTreeNode[],
  versionId: string | null,
): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.children.length > 0) {
      if (hasDescendantWithVersion(node, versionId)) {
        ids.push(node.id);
      }
      ids.push(...getGroupsContainingVersion(node.children, versionId));
    }
  }
  return ids;
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

function getAncestorIds(
  nodes: FeatureTreeNode[],
  targetId: string,
  ancestors: string[] = [],
): string[] | null {
  for (const node of nodes) {
    if (node.id === targetId) {
      return ancestors;
    }
    if (node.children.length > 0) {
      const found = getAncestorIds(node.children, targetId, [
        ...ancestors,
        node.id,
      ]);
      if (found) return found;
    }
  }
  return null;
}

// Current project state - shared across all views
let currentProjectId: string | null = null;
let currentExpandedIds: Set<string> = new Set();
let hasUserInteracted = false;
let isInitialized = false;

function createFeatureExpansionStore() {
  return {
    /**
     * Initialize expansion state for a project.
     * Returns persisted state if available, or calculates smart defaults.
     * When switching views within the same project, returns the current state.
     */
    init(
      projectId: string,
      features: FeatureTreeNode[],
      containerHeight: number,
    ): Set<string> {
      // Same project - return current state (preserves state when switching views)
      if (projectId === currentProjectId && isInitialized) {
        return new Set(currentExpandedIds);
      }

      // Different project - reset state
      if (projectId !== currentProjectId) {
        isInitialized = false;
      }

      currentProjectId = projectId;
      const stored = loadFromStorage(projectId);

      if (stored) {
        // Restore persisted state
        currentExpandedIds = new Set(stored.expandedIds);
        hasUserInteracted = stored.hasUserInteracted;
        isInitialized = true;
        return new Set(currentExpandedIds);
      }

      // No persisted state - calculate smart defaults
      hasUserInteracted = false;

      const totalRows = countTotalRows(features);
      const needsScrolling = totalRows * ROW_HEIGHT > containerHeight;

      if (needsScrolling) {
        // Collapse complete groups, expand incomplete ones
        currentExpandedIds = new Set(getGroupsWithIncompleteWork(features));
      } else {
        // Expand all
        currentExpandedIds = new Set(getAllGroupIds(features));
      }

      isInitialized = true;
      return new Set(currentExpandedIds);
    },

    /**
     * Toggle a group's expanded state. Persists the change.
     */
    toggle(id: string, currentExpanded: Set<string>): Set<string> {
      const newExpanded = new Set(currentExpanded);

      if (currentExpanded.has(id)) {
        newExpanded.delete(id);
      } else {
        newExpanded.add(id);
      }

      // Update state and persist
      currentExpandedIds = newExpanded;
      hasUserInteracted = true;

      if (currentProjectId) {
        saveToStorage(currentProjectId, {
          expandedIds: [...newExpanded],
          hasUserInteracted: true,
          version: STORAGE_VERSION,
        });
      }

      return newExpanded;
    },

    /**
     * Handle tree updates (e.g., from SSE).
     */
    handleTreeUpdate(
      _features: FeatureTreeNode[],
      currentExpanded: Set<string>,
    ): Set<string> {
      return currentExpanded;
    },

    /**
     * Get metadata about a group node for rendering indicators.
     */
    getGroupMetadata(node: FeatureTreeNode): {
      isComplete: boolean;
      hasFutureWork: boolean;
      hasProposed: boolean;
      hasBlocked: boolean;
      hasInProgress: boolean;
    } {
      return {
        isComplete: isGroupComplete(node),
        hasFutureWork: hasIncompleteDescendants(node),
        hasProposed: hasProposedDescendants(node),
        hasBlocked: hasBlockedDescendants(node),
        hasInProgress: hasInProgressDescendants(node),
      };
    },

    /**
     * Expand all groups.
     */
    expandAll(features: FeatureTreeNode[]): Set<string> {
      const allIds = new Set(getAllGroupIds(features));
      currentExpandedIds = allIds;
      hasUserInteracted = true;

      if (currentProjectId) {
        saveToStorage(currentProjectId, {
          expandedIds: [...allIds],
          hasUserInteracted: true,
          version: STORAGE_VERSION,
        });
      }

      return allIds;
    },

    /**
     * Collapse all groups.
     */
    collapseAll(): Set<string> {
      currentExpandedIds = new Set();
      hasUserInteracted = true;

      if (currentProjectId) {
        saveToStorage(currentProjectId, {
          expandedIds: [],
          hasUserInteracted: true,
          version: STORAGE_VERSION,
        });
      }

      return new Set();
    },

    /**
     * Expand only groups containing features assigned to a specific version.
     * Pass null for backlog (unassigned features).
     */
    expandForVersion(
      features: FeatureTreeNode[],
      versionId: string | null,
    ): Set<string> {
      const groupIds = new Set(
        getGroupsContainingVersion(features, versionId),
      );
      currentExpandedIds = groupIds;
      hasUserInteracted = true;

      if (currentProjectId) {
        saveToStorage(currentProjectId, {
          expandedIds: [...groupIds],
          hasUserInteracted: true,
          version: STORAGE_VERSION,
        });
      }

      return groupIds;
    },

    /**
     * Expand to reveal a specific feature by expanding all its ancestors.
     * Returns the updated expanded set, or null if the feature wasn't found.
     */
    expandToFeature(
      features: FeatureTreeNode[],
      featureId: string,
      currentExpanded: Set<string>,
    ): Set<string> | null {
      const ancestorIds = getAncestorIds(features, featureId);
      if (!ancestorIds) return null;

      // Check if all ancestors are already expanded
      const allExpanded = ancestorIds.every((id) => currentExpanded.has(id));
      if (allExpanded) return currentExpanded;

      // Add all ancestors to expanded set
      const newExpanded = new Set(currentExpanded);
      for (const id of ancestorIds) {
        newExpanded.add(id);
      }

      // Update state and persist
      currentExpandedIds = newExpanded;

      if (currentProjectId) {
        saveToStorage(currentProjectId, {
          expandedIds: [...newExpanded],
          hasUserInteracted,
          version: STORAGE_VERSION,
        });
      }

      return newExpanded;
    },

    /**
     * Expand all groups in a (potentially filtered) tree.
     * Used when state filters change so that filtered results are visible.
     */
    expandForFilter(filteredFeatures: FeatureTreeNode[]): Set<string> {
      const groupIds = new Set(getAllGroupIds(filteredFeatures));
      currentExpandedIds = groupIds;

      if (currentProjectId) {
        saveToStorage(currentProjectId, {
          expandedIds: [...groupIds],
          hasUserInteracted,
          version: STORAGE_VERSION,
        });
      }

      return groupIds;
    },

    /**
     * Reset the current project state (useful for testing or forced refresh).
     */
    reset(): void {
      currentProjectId = null;
      currentExpandedIds = new Set();
      hasUserInteracted = false;
      isInitialized = false;
    },
  };
}

export const featureExpansion = createFeatureExpansionStore();
