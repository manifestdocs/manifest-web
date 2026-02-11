/**
 * Canonical context type definitions shared across the app.
 * Single source of truth — all consumers import from here.
 */

import { getContext, setContext } from 'svelte';
import type { components } from '$lib/api/schema.js';
import type { FilterableState } from '$lib/stores/featureFilter.svelte.js';

type Project = components['schemas']['Project'];
type Feature = components['schemas']['Feature'];
type FeatureTreeNode = components['schemas']['FeatureTreeNode'];
type FeatureState = components['schemas']['FeatureState'];
type Version = components['schemas']['Version'];

// --- Terminal / Right Panel ---

export interface TerminalTab {
  id: string;
  label: string;
  initialInput?: string;
  featureId?: string;
}

export interface RightPanelContext {
  readonly terminalTabs: TerminalTab[];
  readonly activeTerminalTabId: string | null;
  resetTerminals(): void;
  createTerminalTab(opts?: {
    label?: string;
    initialInput?: string;
    featureId?: string;
  }): void;
  closeTerminalTab(tabId: string): void;
  selectTerminalTab(tabId: string): void;
  markTerminalAttention(tabId: string): void;
}

// --- Projects ---

export interface ProjectsContext {
  readonly projects: Project[];
  readonly isLoading: boolean;
  refresh: () => Promise<void>;
}

// --- Project Data (provided by [projectSlug]/+layout.svelte) ---

export interface ProjectDataContext {
  readonly featureTree: FeatureTreeNode[];
  readonly selectedFeature: Feature | null;
  readonly selectedFeatureId: string | null;
  readonly selectedFeatureIsGroup: boolean;
  readonly versions: Version[];
  readonly projectId: string | undefined;
  readonly projectSlug: string | undefined;
  readonly gitRemote: string | undefined;
  readonly isLoadingFeatures: boolean;
  readonly isLoadingFeature: boolean;
  readonly isProjectEmpty: boolean;
  readonly acFormat: 'checkbox' | 'gherkin' | undefined;
  readonly treeScrollTop: number;
  readonly expandedIds: Set<string>;
  readonly activeFilters: Set<FilterableState>;
  readonly hoveredFeatureId: string | null;
  loadFeatureTree: () => Promise<void>;
  loadVersions: () => Promise<void>;
  handleSelectFeature: (id: string) => void;
  handleSaveFeature: (
    id: string,
    updates: {
      title?: string;
      details?: string | null;
      desired_details?: string | null;
      state?: FeatureState;
    },
  ) => Promise<void>;
  handleVersionChange: (
    featureId: string,
    versionId: string | null,
  ) => Promise<void>;
  handleReparentFeature: (
    featureId: string,
    newParentId: string | null,
  ) => Promise<void>;
  handleOpenCreateDialog: (parentId: string | null) => void;
  handleOpenArchiveDialog: (
    id: string,
    title: string,
    isGroup: boolean,
    childCount: number,
    parentId: string | null,
  ) => void;
  handleArchiveFromDetail: () => void;
  handleRestoreFeature: (featureId: string) => Promise<void>;
  handleRestoreFromDetail: () => void;
  handleDeleteFeature: (featureId: string) => Promise<void>;
  handleDeleteFromDetail: () => Promise<void>;
  handleStartWorking: () => void;
  handleScrollSync: (scrollTop: number) => void;
  handleHoverFeature: (id: string | null) => void;
  handleExpandForVersion: (versionId: string | null) => void;
  handleExpandAll: () => void;
  handleCollapseAll: () => void;
  handleToggleFilter: (state: FilterableState) => void;
}

// --- Context helpers ---

const CONTEXT_KEYS = {
  rightPanel: 'rightPanel',
  projects: 'projects',
  projectData: 'projectData',
} as const;

export function getRightPanelContext(): RightPanelContext {
  return getContext<RightPanelContext>(CONTEXT_KEYS.rightPanel);
}

export function setRightPanelContext(ctx: RightPanelContext): void {
  setContext(CONTEXT_KEYS.rightPanel, ctx);
}

export function getProjectsContext(): ProjectsContext {
  return getContext<ProjectsContext>(CONTEXT_KEYS.projects);
}

export function setProjectsContext(ctx: ProjectsContext): void {
  setContext(CONTEXT_KEYS.projects, ctx);
}

export function getProjectDataContext(): ProjectDataContext {
  return getContext<ProjectDataContext>(CONTEXT_KEYS.projectData);
}

export function setProjectDataContext(ctx: ProjectDataContext): void {
  setContext(CONTEXT_KEYS.projectData, ctx);
}
