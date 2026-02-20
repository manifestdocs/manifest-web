import { describe, it, expect } from 'vitest';
import {
  getNextVersionName,
  groupVersions,
  getVersionFlatIndex,
  getFlatIndex,
  getTotalVersionColumns,
} from './versionUtils';
import type { components } from '$lib/api/schema.js';

type Version = components['schemas']['Version'];

function makeVersion(id: string, name: string, released_at: string | null = null): Version {
  return {
    id,
    project_id: 'project-1',
    name,
    released_at,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as Version;
}

// --- getNextVersionName ---

describe('getNextVersionName', () => {
  describe('with no versions', () => {
    it('returns 0.1.0 as the initial version', () => {
      expect(getNextVersionName([])).toBe('0.1.0');
    });
  });

  describe('with a single version', () => {
    it('increments the minor version', () => {
      const versions = [makeVersion('1', '1.0.0')];
      expect(getNextVersionName(versions)).toBe('1.1.0');
    });

    it('handles a v-prefix', () => {
      const versions = [makeVersion('1', 'v1.2.3')];
      expect(getNextVersionName(versions)).toBe('1.3.0');
    });
  });

  describe('with multiple versions', () => {
    it('picks the highest version and increments minor', () => {
      const versions = [
        makeVersion('1', '1.0.0'),
        makeVersion('2', '2.3.0'),
        makeVersion('3', '1.9.0'),
      ];
      expect(getNextVersionName(versions)).toBe('2.4.0');
    });

    it('picks the highest major when majors differ', () => {
      const versions = [makeVersion('1', '3.0.0'), makeVersion('2', '2.9.9')];
      expect(getNextVersionName(versions)).toBe('3.1.0');
    });
  });

  describe('when versions have non-semver names', () => {
    it('returns empty string', () => {
      const versions = [makeVersion('1', 'beta'), makeVersion('2', 'release-candidate')];
      expect(getNextVersionName(versions)).toBe('');
    });
  });
});

// --- groupVersions ---

describe('groupVersions', () => {
  describe('with no versions', () => {
    it('returns empty groups', () => {
      expect(groupVersions([])).toEqual([]);
    });
  });

  describe('with one unreleased version', () => {
    it('puts it in the Next group', () => {
      const versions = [makeVersion('1', '1.0.0', null)];
      const groups = groupVersions(versions);
      expect(groups).toHaveLength(1);
      expect(groups[0].label).toBe('Next');
      expect(groups[0].versions[0].id).toBe('1');
    });
  });

  describe('with multiple unreleased versions', () => {
    it('puts the first in Next and the rest in Planned', () => {
      const versions = [
        makeVersion('1', '1.0.0', null),
        makeVersion('2', '1.1.0', null),
        makeVersion('3', '1.2.0', null),
      ];
      const groups = groupVersions(versions);
      expect(groups).toHaveLength(2);
      expect(groups[0].label).toBe('Next');
      expect(groups[0].versions).toHaveLength(1);
      expect(groups[1].label).toBe('Planned');
      expect(groups[1].versions).toHaveLength(2);
    });
  });

  describe('with released versions only', () => {
    it('returns empty groups (released versions are excluded)', () => {
      const versions = [makeVersion('1', '0.9.0', '2024-01-01T00:00:00Z')];
      expect(groupVersions(versions)).toHaveLength(0);
    });
  });

  describe('with a mix of released and unreleased', () => {
    it('includes only unreleased versions in groups', () => {
      const versions = [
        makeVersion('1', '0.9.0', '2024-01-01T00:00:00Z'), // released
        makeVersion('2', '1.0.0', null),                    // unreleased
      ];
      const groups = groupVersions(versions);
      expect(groups).toHaveLength(1);
      expect(groups[0].versions[0].id).toBe('2');
    });
  });
});

// --- getVersionFlatIndex ---

describe('getVersionFlatIndex', () => {
  const groupedVersions = [
    { label: 'Next', versions: [makeVersion('v1', '1.0.0')] },
    { label: 'Planned', versions: [makeVersion('v2', '1.1.0'), makeVersion('v3', '1.2.0')] },
  ];

  it('returns 0 for the first version', () => {
    expect(getVersionFlatIndex('v1', groupedVersions)).toBe(0);
  });

  it('returns 1 for the second version', () => {
    expect(getVersionFlatIndex('v2', groupedVersions)).toBe(1);
  });

  it('returns 2 for the third version', () => {
    expect(getVersionFlatIndex('v3', groupedVersions)).toBe(2);
  });

  it('returns -1 when versionId is null', () => {
    expect(getVersionFlatIndex(null, groupedVersions)).toBe(-1);
  });

  it('returns -1 when versionId is undefined', () => {
    expect(getVersionFlatIndex(undefined, groupedVersions)).toBe(-1);
  });

  it('returns -1 when the version is not found', () => {
    expect(getVersionFlatIndex('nonexistent', groupedVersions)).toBe(-1);
  });
});

// --- getFlatIndex ---

describe('getFlatIndex', () => {
  const groupedVersions = [
    { label: 'Next', versions: [makeVersion('v1', '1.0.0'), makeVersion('v2', '1.1.0')] },
    { label: 'Planned', versions: [makeVersion('v3', '1.2.0')] },
  ];

  it('returns 0 for first item in first group', () => {
    expect(getFlatIndex(0, 0, groupedVersions)).toBe(0);
  });

  it('returns 1 for second item in first group', () => {
    expect(getFlatIndex(0, 1, groupedVersions)).toBe(1);
  });

  it('returns 2 for first item in second group', () => {
    expect(getFlatIndex(1, 0, groupedVersions)).toBe(2);
  });
});

// --- getTotalVersionColumns ---

describe('getTotalVersionColumns', () => {
  it('returns 0 for empty groups', () => {
    expect(getTotalVersionColumns([])).toBe(0);
  });

  it('sums versions across all groups', () => {
    const groups = [
      { label: 'Next', versions: [makeVersion('v1', '1.0.0')] },
      { label: 'Planned', versions: [makeVersion('v2', '1.1.0'), makeVersion('v3', '1.2.0')] },
    ];
    expect(getTotalVersionColumns(groups)).toBe(3);
  });
});
