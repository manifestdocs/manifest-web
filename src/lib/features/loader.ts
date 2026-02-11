/**
 * Data loading functions for project features.
 * Pure async functions — no reactive state.
 */

import type { AuthApiContext } from '$lib/api/auth-context.js';
import type { components } from '$lib/api/schema.js';

type FeatureTreeNode = components['schemas']['FeatureTreeNode'];
type Feature = components['schemas']['Feature'];
type Version = components['schemas']['Version'];

export interface DirectoryInfo {
  hasDirectories: boolean;
  primaryDirectoryPath: string | undefined;
  gitRemote: string | undefined;
}

export async function fetchFeatureTree(
  authApi: AuthApiContext,
  projectId: string,
): Promise<{ data: FeatureTreeNode[]; error: string | null }> {
  const api = await authApi.getClient();
  const { data, error } = await api.GET('/projects/{id}/features/tree', {
    params: { path: { id: projectId } },
  });
  if (error || !data) {
    console.error('Failed to load features:', error);
    return {
      data: [],
      error: 'Failed to load features. Check that the server is running.',
    };
  }
  return { data, error: null };
}

export async function fetchFeature(
  authApi: AuthApiContext,
  featureId: string,
): Promise<Feature | null> {
  const api = await authApi.getClient();
  const { data, error } = await api.GET('/features/{id}', {
    params: { path: { id: featureId } },
  });
  if (error || !data) {
    console.error('Failed to load feature:', error);
    return null;
  }
  return data;
}

export async function fetchVersions(
  authApi: AuthApiContext,
  projectId: string,
): Promise<Version[]> {
  try {
    const api = await authApi.getClient();
    const { data, error } = await api.GET('/projects/{id}/versions', {
      params: { path: { id: projectId } },
    });
    if (error || !data) {
      console.error('Failed to load versions:', error);
      return [];
    }
    return data;
  } catch (e) {
    console.error('Failed to load versions:', e);
    return [];
  }
}

export async function fetchDirectories(
  authApi: AuthApiContext,
  projectId: string,
): Promise<DirectoryInfo> {
  try {
    const api = await authApi.getClient();
    const { data, error } = await api.GET('/projects/{id}/directories', {
      params: { path: { id: projectId } },
    });
    if (error || !data) {
      return { hasDirectories: false, primaryDirectoryPath: undefined, gitRemote: undefined };
    }
    const hasDirectories = data.length > 0;
    const primary = data.find((d) => d.is_primary);
    const primaryDirectoryPath = primary?.path ?? data[0]?.path ?? undefined;
    const gitRemote =
      primary?.git_remote ??
      data.find((d) => d.git_remote)?.git_remote ??
      undefined;
    return { hasDirectories, primaryDirectoryPath, gitRemote };
  } catch {
    return { hasDirectories: false, primaryDirectoryPath: undefined, gitRemote: undefined };
  }
}
