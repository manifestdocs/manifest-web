/**
 * Shared utility functions for feature tree operations.
 * Used by FeatureTree and VersionMatrixView to ensure consistent behavior.
 */

import type { components } from '$lib/api/schema.js';

type FeatureTreeNode = components['schemas']['FeatureTreeNode'];

/**
 * Find a feature by ID in the tree (recursive search).
 */
export function findFeature(nodes: FeatureTreeNode[], id: string): FeatureTreeNode | null {
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
 * Check if a node or any of its descendants has proposed state.
 */
export function hasProposedDescendant(node: FeatureTreeNode): boolean {
	if (node.state === 'proposed') return true;
	return node.children.some(hasProposedDescendant);
}

/**
 * Filter features to only show proposed features and groups containing proposed.
 */
export function filterProposed(nodes: FeatureTreeNode[]): FeatureTreeNode[] {
	return nodes
		.filter(node => hasProposedDescendant(node))
		.map(node => ({
			...node,
			children: filterProposed(node.children)
		}));
}

/**
 * Check if a node or any of its descendants matches one of the given states.
 */
export function hasDescendantWithState(node: FeatureTreeNode, states: Set<string>): boolean {
	if (states.has(node.state)) return true;
	return node.children.some(child => hasDescendantWithState(child, states));
}

/**
 * Filter features to only show features matching any of the given states,
 * plus groups containing matching descendants.
 */
export function filterByStates(nodes: FeatureTreeNode[], states: Set<string>): FeatureTreeNode[] {
	return nodes
		.filter(node => hasDescendantWithState(node, states))
		.map(node => ({
			...node,
			children: filterByStates(node.children, states)
		}));
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
	archived: 3
};

/**
 * Sort features: groups alphabetically first, then leaves by state.
 */
export function sortFeatures(nodes: FeatureTreeNode[]): FeatureTreeNode[] {
	const groups = nodes.filter(n => n.children.length > 0);
	const leaves = nodes.filter(n => n.children.length === 0);

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
