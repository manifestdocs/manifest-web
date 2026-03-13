/**
 * Shared utility functions for feature tree operations.
 * Used by FeatureTree and VersionMatrixView to ensure consistent behavior.
 */

import type { components } from '$lib/api/schema.js';

type FeatureTreeNode = components['schemas']['FeatureTreeNode'];

/**
 * Find a feature by ID in the tree (recursive search).
 */
export function findFeature(
  nodes: FeatureTreeNode[],
  id: string,
): FeatureTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findFeature(node.children, id);
    if (found) return found;
  }
  return null;
}

/**
 * Get all descendant IDs of a feature.
 */
export function getDescendantIds(node: FeatureTreeNode): Set<string> {
  const ids = new Set<string>();
  function collect(n: FeatureTreeNode) {
    for (const child of n.children) {
      ids.add(child.id);
      collect(child);
    }
  }
  collect(node);
  return ids;
}

/**
 * Filter features to only show leaf nodes matching any of the given states,
 * plus ancestor groups that contain matching leaves.
 *
 * Groups (nodes with children) are included only when they contain matching
 * descendants — the group's own state is irrelevant. This prevents a group
 * from appearing as a leaf when its children are all filtered out.
 */
export function filterByStates(
  nodes: FeatureTreeNode[],
  states: Set<string>,
): FeatureTreeNode[] {
  return nodes
    .map((node) => {
      if (node.children.length > 0) {
        // Group: include only if it has matching descendants
        const filteredChildren = filterByStates(node.children, states);
        if (filteredChildren.length === 0) return null;
        return { ...node, children: filteredChildren };
      }
      // Leaf: include only if its own state matches
      return states.has(node.state) ? node : null;
    })
    .filter((node): node is FeatureTreeNode => node !== null);
}

/**
 * Filter features to only show leaf nodes with pending changes
 * (desired_details differs from details), plus ancestor groups.
 */
export function filterByPendingChanges(
  nodes: FeatureTreeNode[],
): FeatureTreeNode[] {
  return nodes
    .map((node) => {
      if (node.children.length > 0) {
        const filteredChildren = filterByPendingChanges(node.children);
        if (filteredChildren.length === 0) return null;
        return { ...node, children: filteredChildren };
      }
      const hasPending =
        !!node.desired_details && node.desired_details !== node.details;
      return hasPending ? node : null;
    })
    .filter((node): node is FeatureTreeNode => node !== null);
}

/**
 * Filter features to only show leaf nodes assigned to a specific version,
 * plus ancestor groups that contain matching leaves.
 * Pass null for backlog (unassigned features).
 */
export function filterByVersion(
  nodes: FeatureTreeNode[],
  versionId: string | null,
): FeatureTreeNode[] {
  return nodes
    .map((node) => {
      if (node.children.length > 0) {
        const filteredChildren = filterByVersion(node.children, versionId);
        if (filteredChildren.length === 0) return null;
        return { ...node, children: filteredChildren };
      }
      const matches =
        versionId === null
          ? !node.target_version_id
          : node.target_version_id === versionId;
      return matches ? node : null;
    })
    .filter((node): node is FeatureTreeNode => node !== null);
}

/**
 * Compute a hash-based version number for the feature tree structure.
 * Used to detect tree changes (e.g., from SSE updates).
 */
export function computeFeatureVersion(nodes: FeatureTreeNode[]): number {
  let hash = 0;
  function traverse(n: FeatureTreeNode) {
    hash = (hash * 31 + n.state.charCodeAt(0)) >>> 0;
    hash = (hash * 31 + n.children.length) >>> 0;
    for (const child of n.children) traverse(child);
  }
  for (const node of nodes) traverse(node);
  return hash;
}

/**
 * Sort order for feature states.
 * Lower number = appears first.
 */
export const stateOrder: Record<string, number> = {
  implemented: 0,
  in_progress: 1,
  proposed: 2,
  blocked: 3,
  archived: 4,
};

/**
 * Sort features: groups alphabetically first, then leaves by state.
 */
export function sortFeatures(nodes: FeatureTreeNode[]): FeatureTreeNode[] {
  const groups = nodes.filter((n) => n.children.length > 0);
  const leaves = nodes.filter((n) => n.children.length === 0);

  groups.sort((a, b) => a.title.localeCompare(b.title));
  leaves.sort((a, b) => {
    const aOrder = stateOrder[a.state] ?? 99;
    const bOrder = stateOrder[b.state] ?? 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.title.localeCompare(b.title);
  });

  return [...groups, ...leaves];
}
