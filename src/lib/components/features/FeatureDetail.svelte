<script lang="ts">
	import { getAuthApiContext } from '$lib/api/auth-context.js';
	import type { components } from '$lib/api/schema.js';
	import { BookIcon, GroupIcon, ProjectIcon, StateIcon } from '$lib/components/icons/index.js';
	import { DiffView, MarkdownEditor, MarkdownView } from '$lib/components/markdown/index.js';
	import { InfoBanner } from '$lib/components/ui/index.js';
	import DeleteFeatureDialog from './DeleteFeatureDialog.svelte';

	// Get authenticated API client from context
	const authApi = getAuthApiContext();

	type Feature = components['schemas']['Feature'];
	type FeatureState = components['schemas']['FeatureState'];
	type FeatureDiff = components['schemas']['FeatureDiff'];
	type Version = components['schemas']['Version'];

	interface Props {
		feature: (Feature & { is_root?: boolean }) | null;
		isGroup?: boolean;
		versions?: Version[];
		onSave: (id: string, updates: { title?: string; details?: string | null; desired_details?: string | null; state?: FeatureState }) => Promise<void>;
		onVersionChange?: (featureId: string, versionId: string | null) => Promise<void>;
		onArchive?: () => void;
		onRestore?: () => void;
		onDelete?: () => void;
	}

	let { feature, isGroup = false, versions = [], onSave, onVersionChange, onArchive, onRestore, onDelete }: Props = $props();

	const isRoot = $derived(feature?.is_root ?? false);
	const isArchived = $derived(feature?.state === 'archived');

	let isEditing = $state(false);
	let isSaving = $state(false);
	let editTitle = $state('');
	let editDetails = $state('');
	let activeTab = $state<'view' | 'edit' | 'diff'>('view');
	let diffData = $state<FeatureDiff | null>(null);
	let isLoadingDiff = $state(false);
	let showDeleteDialog = $state(false);

	const hasPendingChanges = $derived(!!feature?.desired_details);

	// Track which feature we're editing to detect navigation vs refresh
	let currentFeatureId = $state<string | null>(null);

	// Sync edit fields when feature changes - but only reset UI when navigating to different feature
	$effect(() => {
		if (!feature) return;

		const isNewFeature = feature.id !== currentFeatureId;

		if (isNewFeature) {
			// Navigated to different feature - reset everything
			currentFeatureId = feature.id;
			editTitle = feature.title;
			editDetails = feature.details ?? '';
			isEditing = false;
			activeTab = 'view';
		}
		// When same feature is refreshed (e.g., after version change),
		// don't update edit fields or change tabs - let user keep editing
	});

	let isLocked = $derived(feature?.state === 'in_progress');

	// Version-related state
	let isSavingVersion = $state(false);
	const currentVersion = $derived(
		feature?.target_version_id
			? versions.find((v) => v.id === feature.target_version_id)
			: null
	);
	const unreleasedVersions = $derived(versions.filter((v) => !v.released_at));

	async function handleVersionChange(e: Event) {
		if (!feature || !onVersionChange) return;
		const select = e.target as HTMLSelectElement;
		const versionId = select.value || null;

		isSavingVersion = true;
		try {
			await onVersionChange(feature.id, versionId);
		} finally {
			isSavingVersion = false;
		}
	}

	const stateOptions: { value: FeatureState; label: string }[] = [
		{ value: 'proposed', label: 'Proposed' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'implemented', label: 'Implemented' },
		{ value: 'archived', label: 'Archived' }
	];

	async function handleSave() {
		if (!feature) return;

		isSaving = true;
		try {
			const updates: { title?: string; details?: string | null } = {};

			if (editTitle !== feature.title) {
				updates.title = editTitle;
			}

			const currentDetails = feature.details ?? '';
			if (editDetails !== currentDetails) {
				updates.details = editDetails || null;
			}

			if (Object.keys(updates).length > 0) {
				await onSave(feature.id, updates);
			}
			activeTab = 'view';
		} finally {
			isSaving = false;
		}
	}

	async function handleStateChange(newState: FeatureState) {
		if (!feature || newState === feature.state) return;

		isSaving = true;
		try {
			await onSave(feature.id, { state: newState });
		} finally {
			isSaving = false;
		}
	}

	function handleCancel() {
		if (feature) {
			editTitle = feature.title;
			editDetails = feature.details ?? '';
		}
		activeTab = 'view';
	}

	async function loadDiff() {
		if (!feature) return;
		isLoadingDiff = true;
		try {
			const api = await authApi.getClient();
			const { data, error } = await api.GET('/features/{id}/diff', {
				params: { path: { id: feature.id } }
			});
			if (error || !data) {
				console.error('Failed to load diff:', error);
				return;
			}
			diffData = data;
		} finally {
			isLoadingDiff = false;
		}
	}

	function handleViewDiff() {
		activeTab = 'diff';
		loadDiff();
	}

	async function handleApplyChanges() {
		if (!feature || !feature.desired_details) return;

		isSaving = true;
		try {
			await onSave(feature.id, {
				details: feature.desired_details,
				desired_details: null
			});
			activeTab = 'view';
			diffData = null;
		} finally {
			isSaving = false;
		}
	}

	async function handleDiscardChanges() {
		if (!feature) return;

		isSaving = true;
		try {
			await onSave(feature.id, { desired_details: null });
			activeTab = 'view';
			diffData = null;
		} finally {
			isSaving = false;
		}
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="feature-detail">
	{#if !feature}
		<div class="empty-state">
			<div class="empty-icon">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</div>
			<p>Select a feature to view details</p>
		</div>
	{:else}
		<div class="detail-header">
			<div class="header-content">
				{#if activeTab === 'view'}
					<div class="header-left">
						<h1 class="feature-title">{isRoot ? 'Project Context' : feature.title}</h1>
						<div class="meta">
							{#if isRoot}
								<div class="project-badge">
									<BookIcon size={14} />
									<span>Project Context</span>
								</div>
							{:else if isGroup}
								<div class="group-badge">
									<GroupIcon size={14} />
									<span>Feature Set</span>
								</div>
							{:else}
								<div class="state-badge" data-state={feature.state}>
									<StateIcon state={feature.state} size={14} />
									<select
										class="state-select"
										value={feature.state}
										onchange={(e) => handleStateChange(e.currentTarget.value as FeatureState)}
										disabled={isSaving}
									>
										{#each stateOptions as opt}
											<option value={opt.value}>{opt.label}</option>
										{/each}
									</select>
								</div>
							{/if}
							<span class="meta-item">Updated {formatDate(feature.updated_at)}</span>
							{#if !isRoot && !isGroup}
								<span class="meta-separator">·</span>
								<span class="meta-item version-display">
									{currentVersion ? currentVersion.name : 'Unassigned'}
								</span>
							{/if}
						</div>
					</div>
					<div class="header-right">
						{#if isLocked}
							<div class="locked-indicator">
								<svg class="lock-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
									<rect x="3" y="11" width="18" height="11" rx="2" />
									<path d="M7 11V7a5 5 0 0 1 10 0v4" />
								</svg>
								<span class="locked-text">in progress features can't be edited</span>
							</div>
						{:else if isArchived}
							<div class="header-actions">
								{#if onRestore}
									<button class="btn btn-primary" onclick={onRestore} type="button">Restore</button>
								{/if}
								{#if onDelete}
									<button class="btn btn-danger" onclick={() => (showDeleteDialog = true)} type="button">Delete Permanently</button>
								{/if}
							</div>
						{:else}
							<div class="header-actions">
								{#if hasPendingChanges}
									<button class="btn btn-warning" onclick={handleViewDiff} type="button">Review Changes</button>
								{/if}
								{#if onArchive && !isRoot}
									<button class="btn btn-warning-subtle" onclick={onArchive} type="button">Archive</button>
								{/if}
								<button class="btn btn-primary" onclick={() => (activeTab = 'edit')} type="button">Edit</button>
							</div>
						{/if}
					</div>
				{:else if activeTab === 'edit'}
					<div class="header-left">
						{#if isRoot}
							<h1 class="feature-title">Project Context</h1>
						{:else}
							<input
								type="text"
								class="title-input"
								bind:value={editTitle}
								placeholder="Feature title"
							/>
						{/if}
						<div class="meta">
							{#if isRoot}
								<div class="project-badge">
									<BookIcon size={14} />
									<span>Project Context</span>
								</div>
							{:else if isGroup}
								<div class="group-badge">
									<GroupIcon size={14} />
									<span>Feature Set</span>
								</div>
							{:else}
								<div class="state-badge" data-state={feature.state}>
									<StateIcon state={feature.state} size={14} />
									<span class="state-label">{stateOptions.find(o => o.value === feature.state)?.label}</span>
								</div>
							{/if}
							<span class="meta-item">Updated {formatDate(feature.updated_at)}</span>
						</div>
					</div>
					<div class="header-right">
						<div class="title-actions">
							<button class="btn btn-secondary" onclick={handleCancel} disabled={isSaving} type="button">Cancel</button>
							<button class="btn btn-primary" onclick={handleSave} disabled={isSaving} type="button">
								{isSaving ? 'Saving...' : 'Save'}
							</button>
						</div>
					</div>
				{:else}
					<!-- Diff tab header -->
					<div class="header-left">
						<h1 class="feature-title">{feature.title}</h1>
						<div class="meta">
							<span class="diff-badge">Reviewing Changes</span>
							<span class="meta-item">Updated {formatDate(feature.updated_at)}</span>
						</div>
					</div>
					<div class="header-right">
						<div class="title-actions">
							<button class="btn btn-secondary" onclick={() => (activeTab = 'view')} disabled={isSaving} type="button">Cancel</button>
							<button class="btn btn-danger" onclick={handleDiscardChanges} disabled={isSaving} type="button">Discard</button>
							<button class="btn btn-primary" onclick={handleApplyChanges} disabled={isSaving} type="button">
								{isSaving ? 'Applying...' : 'Apply Changes'}
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<div class="detail-content">
			{#if isRoot}
				<InfoBanner class="content-banner">
					Context here applies project-wide.
				</InfoBanner>
			{:else if isGroup}
				<InfoBanner class="content-banner">
					Context here applies to all features in this set.
				</InfoBanner>
			{/if}

			{#if hasPendingChanges && activeTab === 'view'}
				<InfoBanner variant="warning" class="content-banner">
					This feature has proposed changes. <button class="banner-link" onclick={handleViewDiff} type="button">Review changes</button> to apply or discard them.
				</InfoBanner>
			{/if}

			{#if activeTab === 'view'}
				<div class="details-view">
					{#if feature.details}
						<MarkdownView content={feature.details} />
					{:else}
						<p class="no-details">
							{isRoot
								? 'No project instructions yet. Click Edit to add guidelines for AI agents.'
								: 'No details yet. Click Edit to add a description.'}
						</p>
					{/if}
				</div>
			{:else if activeTab === 'edit'}
				<div class="details-edit" class:with-sidebar={!isRoot && !isGroup}>
					<div class="editor-main">
						<MarkdownEditor
							bind:value={editDetails}
							placeholder={isRoot
								? 'Project-wide instructions for AI agents. Include coding guidelines, conventions, and any context that should apply to all features...'
								: 'Add feature details, user stories, technical notes...'}
							rows={20}
						/>
					</div>
					{#if !isRoot && !isGroup}
						<div class="editor-sidebar">
							<div class="sidebar-field">
								<label class="field-label" for="version-select">Version</label>
								<select
									id="version-select"
									class="version-select"
									value={feature.target_version_id ?? ''}
									onchange={handleVersionChange}
									disabled={isSavingVersion}
								>
									<option value="">Unassigned</option>
									{#each unreleasedVersions as version (version.id)}
										<option value={version.id}>{version.name}</option>
									{/each}
								</select>
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<div class="details-diff">
					{#if isLoadingDiff}
						<p class="loading-text">Loading diff...</p>
					{:else if diffData}
						<DiffView current={diffData.current ?? null} desired={diffData.desired ?? null} />
					{:else}
						<p class="no-details">No diff data available.</p>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	{#if feature && onDelete}
		<DeleteFeatureDialog
			open={showDeleteDialog}
			onOpenChange={(open) => (showDeleteDialog = open)}
			featureTitle={feature.title}
			onDelete={onDelete}
		/>
	{/if}
</div>

<style>
	.feature-detail {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--foreground-subtle);
		gap: 16px;
	}

	.empty-icon {
		opacity: 0.5;
	}

	.detail-header {
		padding: 20px 36px 16px;
		border-bottom: 1px solid var(--border-default);
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 24px;
		max-width: 800px;
	}

	.header-left {
		flex: 1;
		min-width: 0;
	}

	.header-right {
		flex-shrink: 0;
	}

	.state-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px 4px 6px;
		border-radius: 20px;
		font-size: 12px;
		font-weight: 500;
		background: var(--background-muted);
	}

	.state-badge[data-state="proposed"] {
		background: rgba(204, 167, 0, 0.15);
		color: var(--state-proposed);
	}

	.state-badge[data-state="in_progress"] {
		background: rgba(137, 209, 133, 0.15);
		color: var(--state-in-progress);
	}

	.state-badge[data-state="implemented"] {
		background: rgba(156, 220, 254, 0.15);
		color: var(--state-implemented);
	}

	.state-badge[data-state="archived"] {
		background: rgba(110, 110, 110, 0.15);
		color: var(--state-archived);
	}

	.group-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px 4px 6px;
		border-radius: 20px;
		font-size: 12px;
		font-weight: 500;
		background: var(--background-muted);
		color: var(--foreground-muted);
	}

	.project-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px 4px 6px;
		border-radius: 20px;
		font-size: 12px;
		font-weight: 500;
		background: rgba(88, 166, 255, 0.15);
		color: var(--accent-blue);
	}

	.state-select {
		appearance: none;
		background: transparent;
		border: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
		padding-right: 4px;
	}

	.state-select:focus {
		outline: none;
	}

	.feature-title {
		margin: 0;
		font-size: 26px;
		font-weight: 600;
		line-height: 1.25;
		color: var(--foreground);
	}

	.title-input {
		width: 100%;
		padding: 6px 10px;
		font-family: 'IBM Plex Mono', monospace;
		font-size: 14px;
		font-weight: 500;
		line-height: 1.4;
		background: var(--background-subtle);
		border: 1px solid var(--border-default);
		border-radius: 4px;
		color: var(--foreground);
	}

	.title-input:focus {
		outline: none;
		border-color: var(--accent-blue);
	}

	.title-actions {
		display: flex;
		gap: 8px;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 6px 12px;
		font-size: 13px;
		font-weight: 500;
		border-radius: 2px;
		border: 1px solid transparent;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-primary {
		background: var(--accent-green);
		color: #000;
		border-color: var(--accent-green);
	}

	.btn-primary:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.btn-secondary {
		background: transparent;
		color: var(--foreground);
		border-color: var(--border-default);
	}

	.btn-secondary:hover:not(:disabled) {
		background: var(--background-muted);
	}

	.btn-warning {
		background: rgba(204, 167, 0, 0.2);
		color: var(--state-proposed);
		border-color: var(--state-proposed);
	}

	.btn-warning:hover:not(:disabled) {
		background: rgba(204, 167, 0, 0.3);
	}

	.btn-danger {
		background: #f85149;
		color: #fff;
		border-color: #f85149;
	}

	.btn-danger:hover:not(:disabled) {
		background: #ff6b61;
	}

	.btn-danger-subtle {
		background: transparent;
		color: var(--foreground-subtle);
		border-color: var(--border-default);
	}

	.btn-danger-subtle:hover:not(:disabled) {
		background: rgba(248, 81, 73, 0.15);
		color: #f85149;
		border-color: #f85149;
	}

	.btn-warning-subtle {
		background: transparent;
		color: var(--foreground-subtle);
		border-color: var(--border-default);
	}

	.btn-warning-subtle:hover:not(:disabled) {
		background: rgba(210, 153, 34, 0.15);
		color: #d29922;
		border-color: #d29922;
	}

	.header-actions {
		display: flex;
		gap: 8px;
	}

	.locked-indicator {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 2px;
		color: var(--foreground-subtle);
		flex-shrink: 0;
	}

	.lock-icon {
		opacity: 0.7;
	}

	.locked-text {
		font-size: 11px;
		text-align: right;
		max-width: 100px;
		line-height: 1.3;
	}

	.meta {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 8px;
		font-size: 13px;
		color: var(--foreground-subtle);
	}

	.meta-separator {
		color: var(--foreground-subtle);
		opacity: 0.5;
	}

	.version-display {
		color: var(--foreground-muted);
	}

	.detail-content {
		flex: 1;
		overflow-y: auto;
		padding: 20px 36px;
	}

	.detail-content :global(.content-banner) {
		max-width: 800px;
		margin-bottom: 16px;
		border-radius: 6px;
		border: none;
	}

	.details-view {
		max-width: 800px;
	}

	.no-details {
		color: var(--foreground-subtle);
		font-style: italic;
	}

	.details-edit {
		max-width: 800px;
	}

	.details-edit.with-sidebar {
		display: flex;
		gap: 24px;
		max-width: none;
	}

	.editor-main {
		flex: 1;
		max-width: 800px;
	}

	.editor-sidebar {
		width: 200px;
		flex-shrink: 0;
	}

	.sidebar-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--foreground-muted);
	}

	.version-select {
		width: 100%;
		padding: 8px 12px;
		font-size: 13px;
		background: var(--background-subtle);
		border: 1px solid var(--border-default);
		border-radius: 4px;
		color: var(--foreground);
		cursor: pointer;
	}

	.version-select:hover {
		border-color: var(--foreground-subtle);
	}

	.version-select:focus {
		outline: none;
		border-color: var(--accent-blue);
	}

	.version-select:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.details-diff {
		max-width: 800px;
	}

	.diff-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border-radius: 20px;
		font-size: 12px;
		font-weight: 500;
		background: rgba(204, 167, 0, 0.15);
		color: var(--state-proposed);
	}

	.banner-link {
		background: none;
		border: none;
		color: inherit;
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
		padding: 0;
	}

	.banner-link:hover {
		opacity: 0.8;
	}

	.loading-text {
		color: var(--foreground-subtle);
		font-style: italic;
	}
</style>
