<script lang="ts">
	import type { components } from '$lib/api/schema.js';
	import { GroupIcon, StateIcon } from '$lib/components/icons/index.js';
	import { MarkdownEditor, MarkdownView } from '$lib/components/markdown/index.js';

	type Feature = components['schemas']['Feature'];
	type FeatureState = components['schemas']['FeatureState'];

	interface Props {
		feature: Feature | null;
		isGroup?: boolean;
		onSave: (id: string, updates: { title?: string; details?: string | null; state?: FeatureState }) => Promise<void>;
	}

	let { feature, isGroup = false, onSave }: Props = $props();

	let isEditing = $state(false);
	let isSaving = $state(false);
	let editTitle = $state('');
	let editDetails = $state('');
	let activeTab = $state<'view' | 'edit'>('view');

	// Reset editing state when feature changes
	$effect(() => {
		if (feature) {
			editTitle = feature.title;
			editDetails = feature.details ?? '';
			isEditing = false;
			activeTab = 'view';
		}
	});

	const stateOptions: { value: FeatureState; label: string }[] = [
		{ value: 'proposed', label: 'Proposed' },
		{ value: 'specified', label: 'Specified' },
		{ value: 'implemented', label: 'Implemented' },
		{ value: 'deprecated', label: 'Deprecated' }
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
			<div class="header-top">
				{#if isGroup}
					<div class="group-badge">
						<GroupIcon size={14} />
						<span>Group</span>
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

				<div class="header-actions">
					{#if activeTab === 'view'}
						<button class="btn btn-primary" onclick={() => (activeTab = 'edit')} type="button">
							Edit
						</button>
					{:else}
						<button class="btn btn-secondary" onclick={handleCancel} disabled={isSaving} type="button">
							Cancel
						</button>
						<button class="btn btn-primary" onclick={handleSave} disabled={isSaving} type="button">
							{isSaving ? 'Saving...' : 'Save'}
						</button>
					{/if}
				</div>
			</div>

			{#if activeTab === 'view'}
				<h1 class="feature-title">{feature.title}</h1>
			{:else}
				<input
					type="text"
					class="title-input"
					bind:value={editTitle}
					placeholder="Feature title"
				/>
			{/if}

			<div class="meta">
				<span class="meta-item">Updated {formatDate(feature.updated_at)}</span>
			</div>
		</div>

		<div class="detail-content">
			{#if activeTab === 'view'}
				<div class="details-view">
					{#if feature.details}
						<MarkdownView content={feature.details} />
					{:else}
						<p class="no-details">No details yet. Click Edit to add a description.</p>
					{/if}
				</div>
			{:else}
				<div class="details-edit">
					<MarkdownEditor
						bind:value={editDetails}
						placeholder="Add feature details, user stories, technical notes..."
						rows={20}
					/>
				</div>
			{/if}
		</div>
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
		padding: 20px 24px 16px;
		border-bottom: 1px solid var(--border-default);
	}

	.header-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
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

	.state-badge[data-state="specified"] {
		background: rgba(137, 209, 133, 0.15);
		color: var(--state-specified);
	}

	.state-badge[data-state="implemented"] {
		background: rgba(156, 220, 254, 0.15);
		color: var(--state-implemented);
	}

	.state-badge[data-state="deprecated"] {
		background: rgba(110, 110, 110, 0.15);
		color: var(--state-deprecated);
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

	.header-actions {
		display: flex;
		gap: 8px;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 6px 14px;
		font-size: 13px;
		font-weight: 500;
		border-radius: 6px;
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

	.feature-title {
		margin: 0 0 8px;
		font-size: 24px;
		font-weight: 600;
		line-height: 1.25;
		color: var(--foreground);
	}

	.title-input {
		width: 100%;
		padding: 8px 12px;
		font-size: 24px;
		font-weight: 600;
		background: var(--background-subtle);
		border: 1px solid var(--border-default);
		border-radius: 6px;
		color: var(--foreground);
		margin-bottom: 8px;
	}

	.title-input:focus {
		outline: none;
		border-color: var(--accent-blue);
	}

	.meta {
		display: flex;
		gap: 16px;
		font-size: 12px;
		color: var(--foreground-subtle);
	}

	.detail-content {
		flex: 1;
		overflow-y: auto;
		padding: 20px 24px;
	}

	.details-view {
		max-width: 800px;
	}

	.no-details {
		color: var(--foreground-subtle);
		font-style: italic;
	}

	.details-edit {
		height: 100%;
	}
</style>
