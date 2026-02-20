import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { vi } from 'vitest';
import { featureExpansion } from './featureExpansion.svelte';
import type { FeatureTreeNode } from './featureExpansion.svelte';

// The jsdom environment in this project has a non-functional localStorage stub.
// We replace it with a working in-memory implementation.
const storageData: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string): string | null => storageData[key] ?? null,
  setItem: (key: string, value: string): void => { storageData[key] = value; },
  removeItem: (key: string): void => { delete storageData[key]; },
  get length() { return Object.keys(storageData).length; },
  key: (i: number): string | null => Object.keys(storageData)[i] ?? null,
};

beforeAll(() => {
  vi.stubGlobal('localStorage', mockLocalStorage);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  Object.keys(storageData).forEach((k) => delete storageData[k]);
  featureExpansion.reset();
});

const STORAGE_KEY_PREFIX = 'manifest:ui:feature-expansion:';
const STORAGE_VERSION = 2;

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

describe('featureExpansion', () => {
  describe('init', () => {
    describe('when same project is already initialized', () => {
      it('returns the current expanded state without recalculating', () => {
        const group = makeNode('g', 'proposed', [makeNode('child')]);
        featureExpansion.init('proj', [group], 10000);
        featureExpansion.toggle('g', new Set(['g'])); // collapse it

        // re-init with same project — should preserve collapsed state
        const result = featureExpansion.init('proj', [group], 10000);
        expect(result.has('g')).toBe(false);
      });
    });

    describe('when no stored state and tree fits in container', () => {
      it('expands all groups', () => {
        const child = makeNode('child');
        const group = makeNode('group', 'proposed', [child]);
        // 2 rows × 28px = 56px. Container of 10000px fits everything.
        const result = featureExpansion.init('proj', [group], 10000);
        expect(result.has('group')).toBe(true);
      });
    });

    describe('when no stored state and tree requires scrolling', () => {
      it('expands only groups with incomplete work', () => {
        const incompleteChild = makeNode('ic', 'proposed');
        const completeChild = makeNode('cc', 'implemented');
        const incompleteGroup = makeNode('ig', 'proposed', [incompleteChild]);
        const completeGroup = makeNode('cg', 'proposed', [completeChild]);

        // 1px container forces scrolling
        const result = featureExpansion.init('proj', [incompleteGroup, completeGroup], 1);
        expect(result.has('ig')).toBe(true);   // has incomplete work
        expect(result.has('cg')).toBe(false);  // all complete
      });
    });

    describe('when stored state exists', () => {
      it('restores the persisted expanded ids', () => {
        const key = `${STORAGE_KEY_PREFIX}proj`;
        storageData[key] = JSON.stringify({
          expandedIds: ['g1', 'g2'],
          hasUserInteracted: true,
          version: STORAGE_VERSION,
        });

        const group1 = makeNode('g1', 'proposed', [makeNode('c1')]);
        const group2 = makeNode('g2', 'proposed', [makeNode('c2')]);
        const result = featureExpansion.init('proj', [group1, group2], 10000);
        expect(result.has('g1')).toBe(true);
        expect(result.has('g2')).toBe(true);
      });

      it('ignores stored state with old version number', () => {
        const key = `${STORAGE_KEY_PREFIX}proj`;
        storageData[key] = JSON.stringify({
          expandedIds: ['g1'],
          hasUserInteracted: true,
          version: 1, // old version
        });

        const result = featureExpansion.init('proj', [], 10000);
        // v1 state is cleared; falls back to default (no groups in empty tree)
        expect(result.size).toBe(0);
      });
    });

    describe('when switching to a different project', () => {
      it('resets state and loads the new project independently', () => {
        const group = makeNode('g', 'proposed', [makeNode('child')]);
        featureExpansion.init('proj-1', [group], 10000);

        const result = featureExpansion.init('proj-2', [], 10000);
        expect(result.size).toBe(0);
      });
    });
  });

  describe('toggle', () => {
    beforeEach(() => {
      featureExpansion.init('proj', [], 10000);
    });

    describe('when the group is currently expanded', () => {
      it('collapses it', () => {
        const expanded = new Set(['g1', 'g2']);
        const result = featureExpansion.toggle('g1', expanded);
        expect(result.has('g1')).toBe(false);
        expect(result.has('g2')).toBe(true);
      });
    });

    describe('when the group is currently collapsed', () => {
      it('expands it', () => {
        const expanded = new Set<string>();
        const result = featureExpansion.toggle('g1', expanded);
        expect(result.has('g1')).toBe(true);
      });
    });

    it('persists the change to localStorage', () => {
      featureExpansion.toggle('my-group', new Set());
      const key = `${STORAGE_KEY_PREFIX}proj`;
      const stored = JSON.parse(storageData[key] ?? '{}');
      expect(stored.expandedIds).toContain('my-group');
      expect(stored.version).toBe(STORAGE_VERSION);
    });
  });

  describe('expandAll', () => {
    it('returns a set containing all group ids', () => {
      const g1 = makeNode('g1', 'proposed', [makeNode('c1')]);
      const g2 = makeNode('g2', 'proposed', [makeNode('c2')]);

      featureExpansion.init('proj', [g1, g2], 10000);
      const result = featureExpansion.expandAll([g1, g2]);
      expect(result.has('g1')).toBe(true);
      expect(result.has('g2')).toBe(true);
    });

    it('does not include leaf ids', () => {
      const leaf = makeNode('leaf');
      featureExpansion.init('proj', [leaf], 10000);
      const result = featureExpansion.expandAll([leaf]);
      expect(result.has('leaf')).toBe(false);
    });

    it('persists to localStorage', () => {
      const group = makeNode('g', 'proposed', [makeNode('c')]);
      featureExpansion.init('proj', [group], 10000);
      featureExpansion.expandAll([group]);
      const key = `${STORAGE_KEY_PREFIX}proj`;
      const stored = JSON.parse(storageData[key] ?? '{}');
      expect(stored.expandedIds).toContain('g');
    });
  });

  describe('collapseAll', () => {
    it('returns an empty set', () => {
      featureExpansion.init('proj', [], 10000);
      const result = featureExpansion.collapseAll();
      expect(result.size).toBe(0);
    });

    it('persists to localStorage', () => {
      featureExpansion.init('proj', [], 10000);
      featureExpansion.toggle('g', new Set());
      featureExpansion.collapseAll();
      const key = `${STORAGE_KEY_PREFIX}proj`;
      const stored = JSON.parse(storageData[key] ?? '{}');
      expect(stored.expandedIds).toHaveLength(0);
    });
  });

  describe('expandToFeature', () => {
    it('expands all ancestors of the target feature', () => {
      const leaf = makeNode('leaf');
      const parent = makeNode('parent', 'proposed', [leaf]);
      const root = makeNode('root', 'proposed', [parent]);

      featureExpansion.init('proj', [root], 10000);
      const result = featureExpansion.expandToFeature([root], 'leaf', new Set());
      expect(result?.has('parent')).toBe(true);
      expect(result?.has('root')).toBe(true);
    });

    it('returns null when the feature is not in the tree', () => {
      featureExpansion.init('proj', [], 10000);
      const result = featureExpansion.expandToFeature([], 'nonexistent', new Set());
      expect(result).toBeNull();
    });

    it('returns the existing set unchanged when all ancestors are already expanded', () => {
      const leaf = makeNode('leaf');
      const parent = makeNode('parent', 'proposed', [leaf]);

      featureExpansion.init('proj', [parent], 10000);
      const alreadyExpanded = new Set(['parent']);
      const result = featureExpansion.expandToFeature([parent], 'leaf', alreadyExpanded);
      expect(result).toBe(alreadyExpanded);
    });
  });

  describe('getGroupMetadata', () => {
    it('reports isComplete when all descendants are implemented or archived', () => {
      const node = makeNode('g', 'proposed', [
        makeNode('c1', 'implemented'),
        makeNode('c2', 'archived'),
      ]);
      const meta = featureExpansion.getGroupMetadata(node);
      expect(meta.isComplete).toBe(true);
      expect(meta.hasFutureWork).toBe(false);
    });

    it('reports hasInProgress when any descendant is in_progress', () => {
      const node = makeNode('g', 'proposed', [
        makeNode('c1', 'in_progress'),
        makeNode('c2', 'implemented'),
      ]);
      const meta = featureExpansion.getGroupMetadata(node);
      expect(meta.hasInProgress).toBe(true);
      expect(meta.isComplete).toBe(false);
    });

    it('reports hasProposed when any descendant is proposed', () => {
      const node = makeNode('g', 'proposed', [makeNode('c', 'proposed')]);
      const meta = featureExpansion.getGroupMetadata(node);
      expect(meta.hasProposed).toBe(true);
    });

    it('reports hasFutureWork when there are incomplete descendants', () => {
      const node = makeNode('g', 'proposed', [makeNode('c', 'proposed')]);
      const meta = featureExpansion.getGroupMetadata(node);
      expect(meta.hasFutureWork).toBe(true);
    });
  });

  describe('expandForVersion', () => {
    it('expands groups that contain features assigned to the given version', () => {
      const leaf = makeNode('leaf', 'proposed', [], { target_version_id: 'v1' } as Partial<FeatureTreeNode>);
      const group = makeNode('g', 'proposed', [leaf]);

      featureExpansion.init('proj', [group], 10000);
      const result = featureExpansion.expandForVersion([group], 'v1');
      expect(result.has('g')).toBe(true);
    });

    it('does not expand groups that have no features with the given version', () => {
      const leaf = makeNode('leaf', 'proposed', [], { target_version_id: 'v2' } as Partial<FeatureTreeNode>);
      const group = makeNode('g', 'proposed', [leaf]);

      featureExpansion.init('proj', [group], 10000);
      const result = featureExpansion.expandForVersion([group], 'v1');
      expect(result.has('g')).toBe(false);
    });

    it('expands groups that contain unassigned features when versionId is null', () => {
      const leaf = makeNode('leaf', 'proposed', [], { target_version_id: null } as Partial<FeatureTreeNode>);
      const group = makeNode('g', 'proposed', [leaf]);

      featureExpansion.init('proj', [group], 10000);
      const result = featureExpansion.expandForVersion([group], null);
      expect(result.has('g')).toBe(true);
    });
  });
});
