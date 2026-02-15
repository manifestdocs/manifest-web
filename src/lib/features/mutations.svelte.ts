/**
 * Feature mutation handlers extracted from project layout.
 * Factory function that creates all mutation handlers and dialog state.
 */

import type { AuthApiContext } from '$lib/api/auth-context.js';
import type { components } from '$lib/api/schema.js';
import { findFeature } from '$lib/components/features/featureTreeUtils.js';
import type { RightPanelContext } from '$lib/contexts/types.js';

type Feature = components['schemas']['Feature'];
type FeatureTreeNode = components['schemas']['FeatureTreeNode'];
type FeatureState = components['schemas']['FeatureState'];

export interface ArchiveTarget {
  id: string;
  title: string;
  isGroup: boolean;
  childCount: number;
  parentId: string | null;
}

export interface WrapTarget {
  id: string;
  title: string;
  parentId: string | null;
}

interface MutationDeps {
  authApi: AuthApiContext;
  getProjectId: () => string | undefined;
  getProjectSlug: () => string | undefined;
  getFeatureTree: () => FeatureTreeNode[];
  getSelectedFeature: () => Feature | null;
  getSelectedFeatureId: () => string | null;
  getSelectedFeatureIsGroup: () => boolean;
  getSelectedFeatureChildCount: () => number;
  getSelectedFeatureParentId: () => string | null;
  getIsSelectedRoot: () => boolean;
  setSelectedFeature: (f: Feature | null) => void;
  loadFeatureTree: (pid: string) => Promise<void>;
  loadFeature: (fid: string, force?: boolean) => Promise<void>;
  navigateTo: (path: string, opts?: { replaceState?: boolean }) => void;
  createTerminalTab: RightPanelContext['createTerminalTab'];
  getDefaultAgent: () => string;
}

export function createFeatureMutations(deps: MutationDeps) {
  // --- Dialog state ---
  let createDialogOpen = $state(false);
  let createDialogParentId = $state<string | null>(null);
  let archiveDialogOpen = $state(false);
  let archiveTarget = $state<ArchiveTarget | null>(null);
  let wrapDialogOpen = $state(false);
  let wrapTarget = $state<WrapTarget | null>(null);

  // --- Mutation functions ---

  async function handleSaveFeature(
    id: string,
    updates: {
      title?: string;
      details?: string | null;
      desired_details?: string | null;
      state?: FeatureState;
    },
  ) {
    const api = await deps.authApi.getClient();
    const { data, error } = await api.PUT('/features/{id}', {
      params: { path: { id } },
      body: updates,
    });
    if (error || !data) {
      console.error('Failed to save feature:', error);
      throw new Error('Failed to save');
    }
    deps.setSelectedFeature(data);
    const pid = deps.getProjectId();
    if (pid) {
      await deps.loadFeatureTree(pid);
    }
  }

  async function handleVersionChange(
    featureId: string,
    versionId: string | null,
  ) {
    const api = await deps.authApi.getClient();
    const { error } = await api.PUT('/features/{id}', {
      params: { path: { id: featureId } },
      body: { target_version_id: versionId },
    });
    if (error) {
      console.error('Failed to update version:', error);
      throw new Error('Failed to update version');
    }
    await deps.loadFeature(featureId);
  }

  function handleOpenCreateDialog(parentId: string | null) {
    createDialogParentId = parentId;
    createDialogOpen = true;
  }

  async function handleCreateFeature(title: string, details: string | null) {
    const pid = deps.getProjectId();
    if (!pid) return;

    const api = await deps.authApi.getClient();
    const { data, error } = await api.POST('/projects/{id}/features', {
      params: { path: { id: pid } },
      body: {
        title,
        details,
        parent_id: createDialogParentId,
      },
    });

    if (error || !data) {
      console.error('Failed to create feature:', error);
      throw new Error('Failed to create feature');
    }

    await deps.loadFeatureTree(pid);
    deps.navigateTo(`${currentPath()}?feature=${data.id}`);
  }

  async function handleReparentFeature(
    featureId: string,
    newParentId: string | null,
  ) {
    const api = await deps.authApi.getClient();
    const { error } = await api.PUT('/features/{id}', {
      params: { path: { id: featureId } },
      body: { parent_id: newParentId },
    });

    if (error) {
      console.error('Failed to reparent feature:', error);
      return;
    }

    const pid = deps.getProjectId();
    if (pid) {
      await deps.loadFeatureTree(pid);
    }
  }

  async function handleCreateGroup(
    title: string,
    childIds: [string, string],
    parentId: string | null,
  ) {
    const pid = deps.getProjectId();
    if (!pid) return;

    const api = await deps.authApi.getClient();
    const { data: newGroup, error: createError } = await api.POST(
      '/projects/{id}/features',
      {
        params: { path: { id: pid } },
        body: { title, parent_id: parentId },
      },
    );

    if (createError || !newGroup) {
      console.error('Failed to create group:', createError);
      return;
    }

    const reparentResults = await Promise.all(
      childIds.map((childId) =>
        api.PUT('/features/{id}', {
          params: { path: { id: childId } },
          body: { parent_id: newGroup.id },
        }),
      ),
    );

    const hasError = reparentResults.some((r) => r.error);
    if (hasError) {
      console.error('Failed to reparent some features');
    }

    await deps.loadFeatureTree(pid);
    deps.navigateTo(`${currentPath()}?feature=${newGroup.id}`);
  }

  function handleOpenArchiveDialog(
    id: string,
    title: string,
    isGroup: boolean,
    childCount: number,
    parentId: string | null,
  ) {
    archiveTarget = { id, title, isGroup, childCount, parentId };
    archiveDialogOpen = true;
  }

  function handleOpenWrapDialog(
    featureId: string,
    featureTitle: string,
    parentId: string | null,
  ) {
    wrapTarget = { id: featureId, title: featureTitle, parentId };
    wrapDialogOpen = true;
  }

  async function handleWrapInGroup(title: string) {
    const pid = deps.getProjectId();
    if (!wrapTarget || !pid) return;

    const api = await deps.authApi.getClient();
    const { data: newGroup, error: createError } = await api.POST(
      '/projects/{id}/features',
      {
        params: { path: { id: pid } },
        body: { title, parent_id: wrapTarget.parentId },
      },
    );

    if (createError || !newGroup) {
      console.error('Failed to create group:', createError);
      throw new Error('Failed to create feature set');
    }

    const { error: reparentError } = await api.PUT('/features/{id}', {
      params: { path: { id: wrapTarget.id } },
      body: { parent_id: newGroup.id },
    });

    if (reparentError) {
      console.error('Failed to reparent feature:', reparentError);
      throw new Error('Failed to move feature into group');
    }

    await deps.loadFeatureTree(pid);
    deps.navigateTo(`${currentPath()}?feature=${newGroup.id}`);

    wrapTarget = null;
  }

  function handleArchiveFromDetail() {
    const feature = deps.getSelectedFeature();
    if (!feature) return;
    if (deps.getIsSelectedRoot()) return;

    handleOpenArchiveDialog(
      feature.id,
      feature.title,
      deps.getSelectedFeatureIsGroup(),
      deps.getSelectedFeatureChildCount(),
      deps.getSelectedFeatureParentId(),
    );
  }

  async function handleRestoreFeature(featureId: string) {
    const pid = deps.getProjectId();
    if (!pid) return;

    const api = await deps.authApi.getClient();
    const { error } = await api.PUT('/features/{id}', {
      params: { path: { id: featureId } },
      body: { state: 'proposed' },
    });

    if (error) {
      console.error('Failed to restore feature:', error);
      throw new Error('Failed to restore feature');
    }

    await deps.loadFeatureTree(pid);
  }

  function handleRestoreFromDetail() {
    const feature = deps.getSelectedFeature();
    if (!feature) return;
    handleRestoreFeature(feature.id);
  }

  async function handleDeleteFeature(featureId: string) {
    const pid = deps.getProjectId();
    if (!pid) return;

    const api = await deps.authApi.getClient();
    const { error } = await api.DELETE('/features/{id}', {
      params: { path: { id: featureId } },
    });

    if (error) {
      console.error('Failed to delete feature:', error);
      throw new Error('Failed to delete feature');
    }

    await deps.loadFeatureTree(pid);

    if (deps.getSelectedFeatureId() === featureId) {
      deps.navigateTo(`/app/${deps.getProjectSlug()}`);
    }
  }

  async function handleDeleteFromDetail() {
    const feature = deps.getSelectedFeature();
    if (!feature) return;
    await handleDeleteFeature(feature.id);
  }

  async function handleArchiveFeature(moveChildrenToParent: boolean) {
    const target = archiveTarget;
    const pid = deps.getProjectId();
    if (!target || !pid) return;

    const api = await deps.authApi.getClient();
    const tree = deps.getFeatureTree();
    const node = findFeature(tree, target.id);

    if (moveChildrenToParent && target.isGroup && node) {
      await Promise.all(
        node.children.map((child) =>
          api.PUT('/features/{id}', {
            params: { path: { id: child.id } },
            body: { parent_id: target.parentId },
          }),
        ),
      );
    } else if (target.isGroup && node) {
      const archiveDescendants = (n: FeatureTreeNode): Promise<unknown>[] => {
        const promises: Promise<unknown>[] = [];
        for (const child of n.children) {
          promises.push(
            api.PUT('/features/{id}', {
              params: { path: { id: child.id } },
              body: { state: 'archived' },
            }),
          );
          promises.push(...archiveDescendants(child));
        }
        return promises;
      };
      await Promise.all(archiveDescendants(node));
    }

    const { error } = await api.PUT('/features/{id}', {
      params: { path: { id: target.id } },
      body: { state: 'archived' },
    });

    if (error) {
      console.error('Failed to archive feature:', error);
      throw new Error('Failed to archive feature');
    }

    await deps.loadFeatureTree(pid);
    deps.navigateTo(`/app/${deps.getProjectSlug()}`);

    archiveTarget = null;
  }

  function handleImplementFeature(featureId: string, featureTitle: string) {
    handleSaveFeature(featureId, { state: 'in_progress' as FeatureState });

    const agentCmd = deps.getDefaultAgent();
    const safeTitle = featureTitle.replace(/'/g, "'\\''");
    const initialInput = `${agentCmd} 'Implement "${safeTitle}" — start_feature(${featureId})'\r`;

    deps.createTerminalTab({
      label: `${agentCmd}: ${featureTitle}`.slice(0, 40),
      initialInput,
      featureId,
    });
  }

  function handleStartWorking() {
    const feature = deps.getSelectedFeature();
    const featureId = deps.getSelectedFeatureId();
    if (!feature || !featureId) return;
    handleImplementFeature(feature.id, feature.title);
  }

  // Helper to get the current pathname (used by several handlers)
  function currentPath(): string {
    const slug = deps.getProjectSlug();
    // Preserve any sub-route (versions, activity)
    return `/app/${slug}`;
  }

  return {
    // Dialog state — reactive getters/setters
    get createDialogOpen() { return createDialogOpen; },
    set createDialogOpen(v: boolean) { createDialogOpen = v; },
    get createDialogParentId() { return createDialogParentId; },
    get archiveDialogOpen() { return archiveDialogOpen; },
    set archiveDialogOpen(v: boolean) { archiveDialogOpen = v; },
    get archiveTarget() { return archiveTarget; },
    set archiveTarget(v: ArchiveTarget | null) { archiveTarget = v; },
    get wrapDialogOpen() { return wrapDialogOpen; },
    set wrapDialogOpen(v: boolean) { wrapDialogOpen = v; },
    get wrapTarget() { return wrapTarget; },
    set wrapTarget(v: WrapTarget | null) { wrapTarget = v; },

    // Mutation functions
    handleSaveFeature,
    handleVersionChange,
    handleOpenCreateDialog,
    handleCreateFeature,
    handleReparentFeature,
    handleCreateGroup,
    handleOpenArchiveDialog,
    handleOpenWrapDialog,
    handleWrapInGroup,
    handleArchiveFromDetail,
    handleRestoreFeature,
    handleRestoreFromDetail,
    handleDeleteFeature,
    handleDeleteFromDetail,
    handleArchiveFeature,
    handleImplementFeature,
    handleStartWorking,
  };
}
