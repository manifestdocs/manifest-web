import type { components } from '$lib/api/schema.js';

type Version = components['schemas']['Version'];

export type VersionGroup = {
    label: string;
    versions: Version[];
};

export function getNextVersionName(versions: Version[]): string {
    if (versions.length === 0) return '0.1.0';

    const parsed = versions
        .map(v => {
            const match = v.name.match(/^v?(\d+)\.(\d+)\.(\d+)/);
            if (!match) return null;
            return {
                major: parseInt(match[1], 10),
                minor: parseInt(match[2], 10),
                patch: parseInt(match[3], 10)
            };
        })
        .filter((v): v is { major: number; minor: number; patch: number } => v !== null);

    if (parsed.length === 0) return '';

    const highest = parsed.reduce((max, v) => {
        if (v.major > max.major) return v;
        if (v.major === max.major && v.minor > max.minor) return v;
        if (v.major === max.major && v.minor === max.minor && v.patch > max.patch) return v;
        return max;
    });

    return `${highest.major}.${highest.minor + 1}.0`;
}

export function groupVersions(versions: Version[]): VersionGroup[] {
    const groups: VersionGroup[] = [];
    const unreleased = versions.filter((v) => !v.released_at);

    if (unreleased.length > 0) {
        groups.push({ label: 'Now', versions: [unreleased[0]] });
    }
    if (unreleased.length > 1) {
        groups.push({ label: 'Next', versions: [unreleased[1]] });
    }
    if (unreleased.length > 2) {
        groups.push({ label: 'Later', versions: unreleased.slice(2) });
    }

    return groups;
}

export function getVersionFlatIndex(versionId: string | null | undefined, groupedVersions: VersionGroup[]): number {
    if (!versionId) return -1;
    let idx = 0;
    for (const group of groupedVersions) {
        for (const version of group.versions) {
            if (version.id === versionId) return idx;
            idx++;
        }
    }
    return -1;
}

export function getFlatIndex(groupIndex: number, versionIndex: number, groupedVersions: VersionGroup[]): number {
    let idx = 0;
    for (let g = 0; g < groupIndex; g++) {
        idx += groupedVersions[g].versions.length;
    }
    return idx + versionIndex;
}

export function getTotalVersionColumns(groupedVersions: VersionGroup[]): number {
    return groupedVersions.reduce((sum, g) => sum + g.versions.length, 0);
}
