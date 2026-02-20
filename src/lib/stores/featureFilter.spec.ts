import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { vi } from 'vitest';
import { featureFilter } from './featureFilter.svelte';
import type { FilterableState } from './featureFilter.svelte';

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
  featureFilter.reset();
});

describe('featureFilter', () => {
  describe('init', () => {
    describe('when no stored state exists', () => {
      it('returns an empty filter set', () => {
        const filters = featureFilter.init('project-1');
        expect(filters.size).toBe(0);
      });
    });

    describe('when the same project is initialized twice', () => {
      it('returns the current filters without re-reading storage', () => {
        featureFilter.init('project-1');
        featureFilter.toggle('proposed');
        // clear storage to prove it isn't re-read on second init
        delete storageData['manifest:ui:feature-filter:project-1'];

        const filters = featureFilter.init('project-1');
        expect(filters.has('proposed')).toBe(true);
      });
    });

    describe('when switching to a different project', () => {
      it('loads the new project state from storage', () => {
        featureFilter.init('project-1');
        featureFilter.toggle('proposed');

        const filters = featureFilter.init('project-2');
        expect(filters.size).toBe(0);
      });
    });

    describe('when stored state exists', () => {
      it('restores the persisted filters', () => {
        const key = 'manifest:ui:feature-filter:project-1';
        storageData[key] = JSON.stringify({ activeFilters: ['in_progress', 'proposed'] });

        const filters = featureFilter.init('project-1');
        expect(filters.has('in_progress')).toBe(true);
        expect(filters.has('proposed')).toBe(true);
      });
    });

    describe('when stored state uses the old boolean format (v1 migration)', () => {
      it('migrates showProposedOnly:true to proposed filter', () => {
        const key = 'manifest:ui:feature-filter:project-1';
        storageData[key] = JSON.stringify({ showProposedOnly: true });

        const filters = featureFilter.init('project-1');
        expect(filters.has('proposed')).toBe(true);
        expect(filters.size).toBe(1);
      });

      it('migrates showProposedOnly:false to empty filters', () => {
        const key = 'manifest:ui:feature-filter:project-1';
        storageData[key] = JSON.stringify({ showProposedOnly: false });

        const filters = featureFilter.init('project-1');
        expect(filters.size).toBe(0);
      });
    });
  });

  describe('toggle', () => {
    beforeEach(() => {
      featureFilter.init('project-1');
    });

    describe('when the filter is not active', () => {
      it('adds the filter', () => {
        const result = featureFilter.toggle('proposed');
        expect(result.has('proposed')).toBe(true);
      });

      it('persists the change to localStorage', () => {
        featureFilter.toggle('in_progress');
        const key = 'manifest:ui:feature-filter:project-1';
        const stored = JSON.parse(storageData[key] ?? '{}');
        expect(stored.activeFilters).toContain('in_progress');
      });
    });

    describe('when the filter is already active', () => {
      it('removes the filter', () => {
        featureFilter.toggle('proposed');
        const result = featureFilter.toggle('proposed');
        expect(result.has('proposed')).toBe(false);
      });

      it('persists the removal to localStorage', () => {
        featureFilter.toggle('proposed');
        featureFilter.toggle('proposed');
        const key = 'manifest:ui:feature-filter:project-1';
        const stored = JSON.parse(storageData[key] ?? '{}');
        expect(stored.activeFilters).not.toContain('proposed');
      });
    });

    describe('with multiple filters', () => {
      it('can have multiple filters active simultaneously', () => {
        featureFilter.toggle('proposed');
        const result = featureFilter.toggle('in_progress');
        expect(result.has('proposed')).toBe(true);
        expect(result.has('in_progress')).toBe(true);
      });

      it('toggling one filter does not affect others', () => {
        featureFilter.toggle('proposed');
        featureFilter.toggle('in_progress');
        featureFilter.toggle('proposed'); // remove proposed
        expect(featureFilter.has('in_progress')).toBe(true);
        expect(featureFilter.has('proposed')).toBe(false);
      });
    });
  });

  describe('has', () => {
    beforeEach(() => {
      featureFilter.init('project-1');
    });

    it('returns false when filter is not active', () => {
      expect(featureFilter.has('proposed')).toBe(false);
    });

    it('returns true when filter is active', () => {
      featureFilter.toggle('proposed');
      expect(featureFilter.has('proposed')).toBe(true);
    });
  });

  describe('get', () => {
    beforeEach(() => {
      featureFilter.init('project-1');
    });

    it('returns a copy of the current filter set', () => {
      featureFilter.toggle('blocked' as FilterableState);
      const set = featureFilter.get();
      expect(set.has('blocked' as FilterableState)).toBe(true);
    });

    it('returns a new Set (not the internal reference)', () => {
      const set1 = featureFilter.get();
      const set2 = featureFilter.get();
      expect(set1).not.toBe(set2);
    });
  });
});
