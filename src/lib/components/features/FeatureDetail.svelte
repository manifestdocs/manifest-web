<script lang="ts">
	import { getAuthApiContext } from "$lib/api/auth-context.js";
	import type { components } from "$lib/api/schema.js";
	import FeatureDetailHeader from "./FeatureDetailHeader.svelte";
	import FeatureDetailView from "./FeatureDetailView.svelte";
	import FeatureDetailEdit from "./FeatureDetailEdit.svelte";
	import FeatureDetailDiff from "./FeatureDetailDiff.svelte";
	import DeleteFeatureDialog from "./DeleteFeatureDialog.svelte";

	// Get authenticated API client from context
	const authApi = getAuthApiContext();

	type Feature = components["schemas"]["Feature"];
	type FeatureState = components["schemas"]["FeatureState"];
	type FeatureDiff = components["schemas"]["FeatureDiff"];
	type Version = components["schemas"]["Version"];

	interface Props {
		feature: (Feature & { is_root?: boolean }) | null;
		isGroup?: boolean;
		versions?: Version[];
		onSave: (
			id: string,
			updates: {
				title?: string;
				details?: string | null;
				desired_details?: string | null;
				state?: FeatureState;
			},
		) => Promise<void>;
		onVersionChange?: (
			featureId: string,
			versionId: string | null,
		) => Promise<void>;
		onArchive?: () => void;
		onRestore?: () => void;
		onDelete?: () => Promise<void>;
	}

	let {
		feature,
		isGroup = false,
		versions = [],
		onSave,
		onVersionChange,
		onArchive,
		onRestore,
		onDelete,
	}: Props = $props();

	const isRoot = $derived(feature?.is_root ?? false);
	const isArchived = $derived(feature?.state === "archived");

	let isSaving = $state(false);
	let editTitle = $state("");
	let editDetails = $state("");
	let activeTab = $state<"view" | "edit" | "diff">("view");
	let diffData = $state<FeatureDiff | null>(null);
	let isLoadingDiff = $state(false);
	let showDeleteDialog = $state(false);
	let previousDetails = $state<string | null>(null);
	let showHighlight = $state(false);

	const hasPendingChanges = $derived(!!feature?.desired_details);

	// Track which feature we're editing to detect navigation vs refresh
	let currentFeatureId = $state<string | null>(null);

	// Sync edit fields when feature changes - but only reset UI when navigating to different feature
	$effect(() => {
		if (!feature) return;

		const isNewFeature = feature.id !== currentFeatureId;
		const incomingDetails = feature.details ?? "";

		if (isNewFeature) {
			// Navigated to different feature - reset everything
			currentFeatureId = feature.id;
			editTitle = feature.title;
			editDetails = incomingDetails;
			previousDetails = incomingDetails;
			showHighlight = false;
			activeTab = "view";
		} else {
			// Same feature refreshed (SSE update)
			// Highlight if: details changed AND not in edit mode AND not first load
			if (
				activeTab !== "edit" &&
				previousDetails !== null &&
				incomingDetails !== previousDetails
			) {
				showHighlight = true;
				setTimeout(() => {
					showHighlight = false;
				}, 1500);
			}
			previousDetails = incomingDetails;
		}
	});

	let isLocked = $derived(feature?.state === "in_progress");

	// Version-related state
	let isSavingVersion = $state(false);
	const currentVersion = $derived(
		feature?.target_version_id
			? versions.find((v) => v.id === feature.target_version_id)
			: null,
	);
	const unreleasedVersions = $derived(versions.filter((v) => !v.released_at));

	async function handleVersionChange(versionId: string | null) {
		if (!feature || !onVersionChange) return;

		isSavingVersion = true;
		try {
			await onVersionChange(feature.id, versionId);
		} finally {
			isSavingVersion = false;
		}
	}

	const stateOptions: { value: FeatureState; label: string }[] = [
		{ value: "proposed", label: "Proposed" },
		{ value: "in_progress", label: "In Progress" },
		{ value: "implemented", label: "Implemented" },
		{ value: "archived", label: "Archived" },
	];

	async function handleSave() {
		if (!feature) return;

		isSaving = true;
		try {
			const updates: {
				title?: string;
				details?: string | null;
				desired_details?: string | null;
			} = {};

			if (editTitle !== feature.title) {
				updates.title = editTitle;
			}

			const currentDetails = feature.details ?? "";
			if (editDetails !== currentDetails) {
				if (feature.state === "implemented") {
					updates.desired_details = editDetails || null;
				} else {
					updates.details = editDetails || null;
				}
			}

			if (Object.keys(updates).length > 0) {
				await onSave(feature.id, updates);
			}

			if (feature.state === "implemented" && updates.desired_details) {
				await loadDiff();
				activeTab = "diff";
			} else {
				activeTab = "view";
			}
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
			editDetails = feature.details ?? "";
		}
		activeTab = "view";
	}

	async function loadDiff() {
		if (!feature) return;
		isLoadingDiff = true;
		try {
			const api = await authApi.getClient();
			const { data, error } = await api.GET("/features/{id}/diff", {
				params: { path: { id: feature.id } },
			});
			if (error || !data) {
				console.error("Failed to load diff:", error);
				return;
			}
			diffData = data;
		} finally {
			isLoadingDiff = false;
		}
	}

	function handleViewDiff() {
		activeTab = "diff";
		loadDiff();
	}

	function handleEdit() {
		if (feature?.state === "implemented" && feature.desired_details) {
			editDetails = feature.desired_details;
		}
		activeTab = "edit";
	}

	async function handleApplyChanges() {
		if (!feature || !feature.desired_details) return;

		isSaving = true;
		try {
			await onSave(feature.id, {
				details: feature.desired_details,
				desired_details: null,
			});
			activeTab = "view";
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
			activeTab = "view";
			diffData = null;
		} finally {
			isSaving = false;
		}
	}

	function handleEditTitleChange(value: string) {
		editTitle = value;
	}

	function handleDetailsChange(value: string) {
		editDetails = value;
	}

	function handleDeleteRequest() {
		showDeleteDialog = true;
	}
</script>

<div class="feature-detail">
	{#if !feature}
		<div class="empty-state">
			<div class="empty-icon">
				<svg
					width="48"
					height="48"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</div>
			<p>Select a feature to view details</p>
		</div>
	{:else}
		<FeatureDetailHeader
			{feature}
			{isRoot}
			{isGroup}
			{activeTab}
			{isSaving}
			{isLocked}
			{isArchived}
			{hasPendingChanges}
			{currentVersion}
			{editTitle}
			{stateOptions}
			onEditTitleChange={handleEditTitleChange}
			onStateChange={handleStateChange}
			{onRestore}
			onDeleteRequest={handleDeleteRequest}
			{onArchive}
			onViewDiff={handleViewDiff}
			onEdit={handleEdit}
			onCancel={handleCancel}
			onSave={handleSave}
			onDiscardChanges={handleDiscardChanges}
			onApplyChanges={handleApplyChanges}
		/>

		<div class="detail-content">
			{#if activeTab === "view"}
				<FeatureDetailView
					{feature}
					{isRoot}
					{isGroup}
					{hasPendingChanges}
					{showHighlight}
					onViewDiff={handleViewDiff}
				/>
			{:else if activeTab === "edit"}
				<FeatureDetailEdit
					{feature}
					{isRoot}
					{isGroup}
					{editDetails}
					{unreleasedVersions}
					{isSavingVersion}
					onDetailsChange={handleDetailsChange}
					onVersionChange={handleVersionChange}
				/>
			{:else}
				<FeatureDetailDiff {diffData} {isLoadingDiff} />
			{/if}
		</div>
	{/if}

	{#if feature && onDelete}
		<DeleteFeatureDialog
			open={showDeleteDialog}
			onOpenChange={(open) => (showDeleteDialog = open)}
			featureTitle={feature.title}
			{onDelete}
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

	.detail-content {
		flex: 1;
		overflow-y: auto;
		padding: 20px 36px;
	}
</style>
