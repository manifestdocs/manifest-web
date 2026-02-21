import { describe, it, expect, beforeEach } from 'vitest';
import {
  findFeature,
  getDescendantIds,
  filterByStates,
  computeFeatureVersion,
  stateOrder,
  sortFeatures,
} from './featureTreeUtils';
import type { components } from '$lib/api/schema.js';

type FeatureTreeNode = components['schemas']['FeatureTreeNode'];

function makeNode(
  id: string,
  state: string = 'proposed',
  children: FeatureTreeNode[] = [],
  overrides: Partial<FeatureTreeNode> = {},
): FeatureTreeNode {
  return {
    id,
    project_id: 'project-1',
    title: `Feature ${id}`,
    state: state as FeatureTreeNode['state'],
    priority: 0,
    children,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as FeatureTreeNode;
}

// --- findFeature ---

describe('findFeature', () => {
  describe('when the feature is at the root level', () => {
    it('returns the matching node', () => {
      const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
      expect(findFeature(nodes, 'b')?.id).toBe('b');
    });
  });

  describe('when the feature is nested', () => {
    it('finds it recursively', () => {
      const child = makeNode('child');
      const nodes = [makeNode('parent', 'proposed', [child])];
      expect(findFeature(nodes, 'child')?.id).toBe('child');
    });

    it('finds deeply nested nodes', () => {
      const leaf = makeNode('leaf');
      const mid = makeNode('mid', 'proposed', [leaf]);
      const nodes = [makeNode('root', 'proposed', [mid])];
      expect(findFeature(nodes, 'leaf')?.id).toBe('leaf');
    });
  });

  describe('when the feature does not exist', () => {
    it('returns null', () => {
      const nodes = [makeNode('a'), makeNode('b')];
      expect(findFeature(nodes, 'missing')).toBeNull();
    });

    it('returns null for empty tree', () => {
      expect(findFeature([], 'anything')).toBeNull();
    });
  });
});

// --- getDescendantIds ---

describe('getDescendantIds', () => {
  describe('when the node has no children', () => {
    it('returns an empty set', () => {
      const node = makeNode('leaf');
      expect(getDescendantIds(node).size).toBe(0);
    });
  });

  describe('when the node has direct children', () => {
    it('returns the child ids', () => {
      const node = makeNode('parent', 'proposed', [
        makeNode('child-1'),
        makeNode('child-2'),
      ]);
      const ids = getDescendantIds(node);
      expect(ids.has('child-1')).toBe(true);
      expect(ids.has('child-2')).toBe(true);
      expect(ids.size).toBe(2);
    });
  });

  describe('when there are multiple levels of nesting', () => {
    it('includes all descendant ids', () => {
      const grandchild = makeNode('gc');
      const child = makeNode('child', 'proposed', [grandchild]);
      const node = makeNode('parent', 'proposed', [child]);
      const ids = getDescendantIds(node);
      expect(ids.has('child')).toBe(true);
      expect(ids.has('gc')).toBe(true);
      expect(ids.size).toBe(2);
    });

    it('does not include the node itself', () => {
      const child = makeNode('child');
      const node = makeNode('parent', 'proposed', [child]);
      expect(getDescendantIds(node).has('parent')).toBe(false);
    });
  });
});

// --- filterByStates ---

describe('filterByStates', () => {
  describe('when no states match any nodes', () => {
    it('returns an empty array', () => {
      const nodes = [makeNode('a', 'proposed'), makeNode('b', 'implemented')];
      const result = filterByStates(nodes, new Set(['in_progress']));
      expect(result).toHaveLength(0);
    });
  });

  describe('when filtering leaf nodes', () => {
    it('includes leaves whose state matches', () => {
      const nodes = [
        makeNode('a', 'proposed'),
        makeNode('b', 'in_progress'),
        makeNode('c', 'implemented'),
      ];
      const result = filterByStates(
        nodes,
        new Set(['proposed', 'in_progress']),
      );
      expect(result.map((n) => n.id)).toEqual(['a', 'b']);
    });

    it('excludes leaves whose state does not match', () => {
      const nodes = [makeNode('a', 'implemented'), makeNode('b', 'archived')];
      const result = filterByStates(nodes, new Set(['proposed']));
      expect(result).toHaveLength(0);
    });
  });

  describe('when filtering groups', () => {
    it('includes groups that have matching descendant leaves', () => {
      const child = makeNode('child', 'proposed');
      const group = makeNode('group', 'implemented', [child]);
      const result = filterByStates([group], new Set(['proposed']));
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('group');
    });

    it('excludes groups with no matching descendants', () => {
      const child = makeNode('child', 'implemented');
      const group = makeNode('group', 'proposed', [child]);
      const result = filterByStates([group], new Set(['proposed']));
      expect(result).toHaveLength(0);
    });

    it('filters children within the returned group', () => {
      const match = makeNode('match', 'proposed');
      const nomatch = makeNode('nomatch', 'implemented');
      const group = makeNode('group', 'proposed', [match, nomatch]);
      const result = filterByStates([group], new Set(['proposed']));
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].id).toBe('match');
    });

    it('ignores the group own state when deciding inclusion', () => {
      // A group with state 'archived' is still included if a child matches
      const child = makeNode('child', 'proposed');
      const group = makeNode('group', 'archived', [child]);
      const result = filterByStates([group], new Set(['proposed']));
      expect(result).toHaveLength(1);
    });
  });

  describe('with multiple active filters', () => {
    it('includes leaves matching any active filter', () => {
      const nodes = [
        makeNode('a', 'proposed'),
        makeNode('b', 'in_progress'),
        makeNode('c', 'implemented'),
      ];
      const result = filterByStates(
        nodes,
        new Set(['proposed', 'in_progress']),
      );
      expect(result.map((n) => n.id)).toEqual(['a', 'b']);
    });
  });
});

// --- computeFeatureVersion ---

describe('computeFeatureVersion', () => {
  describe('with an empty tree', () => {
    it('returns 0', () => {
      expect(computeFeatureVersion([])).toBe(0);
    });
  });

  describe('with the same tree', () => {
    it('returns the same hash on repeated calls', () => {
      const nodes = [makeNode('a', 'proposed', [makeNode('b', 'in_progress')])];
      expect(computeFeatureVersion(nodes)).toBe(computeFeatureVersion(nodes));
    });
  });

  describe('when a node state changes', () => {
    it('returns a different hash', () => {
      const nodes1 = [makeNode('a', 'proposed')];
      const nodes2 = [makeNode('a', 'implemented')];
      expect(computeFeatureVersion(nodes1)).not.toBe(
        computeFeatureVersion(nodes2),
      );
    });
  });

  describe('when a child is added', () => {
    it('returns a different hash', () => {
      const nodes1 = [makeNode('a', 'proposed')];
      const nodes2 = [makeNode('a', 'proposed', [makeNode('b', 'proposed')])];
      expect(computeFeatureVersion(nodes1)).not.toBe(
        computeFeatureVersion(nodes2),
      );
    });
  });
});

// --- stateOrder ---

describe('stateOrder', () => {
  it('orders implemented first (0)', () => {
    expect(stateOrder['implemented']).toBe(0);
  });

  it('orders in_progress second (1)', () => {
    expect(stateOrder['in_progress']).toBe(1);
  });

  it('orders proposed third (2)', () => {
    expect(stateOrder['proposed']).toBe(2);
  });

  it('orders blocked fourth (3)', () => {
    expect(stateOrder['blocked']).toBe(3);
  });

  it('orders archived last (4)', () => {
    expect(stateOrder['archived']).toBe(4);
  });
});

// --- sortFeatures ---

describe('sortFeatures', () => {
  describe('with a mix of groups and leaves', () => {
    it('places all groups before all leaves', () => {
      const leaf = makeNode('leaf', 'proposed');
      const group = makeNode('group', 'proposed', [makeNode('child')]);
      const result = sortFeatures([leaf, group]);
      expect(result[0].id).toBe('group');
      expect(result[1].id).toBe('leaf');
    });

    it('sorts groups alphabetically by title', () => {
      const zebra = makeNode('z', 'proposed', [makeNode('c1')], {
        title: 'Zebra',
      } as Partial<FeatureTreeNode>);
      const alpha = makeNode('a', 'proposed', [makeNode('c2')], {
        title: 'Alpha',
      } as Partial<FeatureTreeNode>);
      const result = sortFeatures([zebra, alpha]);
      expect(result[0].id).toBe('a');
      expect(result[1].id).toBe('z');
    });

    it('sorts leaves by state order (implemented before proposed)', () => {
      const proposed = makeNode('p', 'proposed');
      const implemented = makeNode('i', 'implemented');
      const result = sortFeatures([proposed, implemented]);
      expect(result[0].id).toBe('i');
      expect(result[1].id).toBe('p');
    });
  });

  describe('with leaves of the same state', () => {
    it('sorts by priority (lower first)', () => {
      const low = makeNode('low', 'proposed', [], {
        priority: 10,
      } as Partial<FeatureTreeNode>);
      const high = makeNode('high', 'proposed', [], {
        priority: 1,
      } as Partial<FeatureTreeNode>);
      const result = sortFeatures([low, high]);
      expect(result[0].id).toBe('high');
      expect(result[1].id).toBe('low');
    });

    it('sorts by title when priority is equal', () => {
      const z = makeNode('z', 'proposed', [], {
        title: 'Zebra',
        priority: 0,
      } as Partial<FeatureTreeNode>);
      const a = makeNode('a', 'proposed', [], {
        title: 'Alpha',
        priority: 0,
      } as Partial<FeatureTreeNode>);
      const result = sortFeatures([z, a]);
      expect(result[0].id).toBe('a');
      expect(result[1].id).toBe('z');
    });
  });

  describe('with an empty array', () => {
    it('returns an empty array', () => {
      expect(sortFeatures([])).toEqual([]);
    });
  });
});
