<script lang="ts">
	import { Dialog } from "$lib/components/ui/dialog/index.js";
	import { getAuthApiContext } from "$lib/api/auth-context.js";
	import type { components } from "$lib/api/schema.js";
	import DirectoryList from "./DirectoryList.svelte";

	// Get authenticated API client from context
	const authApi = getAuthApiContext();

	type Project = components["schemas"]["Project"];
	type ProjectDirectory = components["schemas"]["ProjectDirectory"];

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		project: Project;
		onUpdated?: () => Promise<void>;
	}

	let { open, onOpenChange, project, onUpdated }: Props = $props();

	// Tab state
	let activeTab = $state<"general" | "directories" | "defaults">("general");

	// Form state
	let name = $state("");
	let defaultFeatureDestination = $state<"backlog" | "now">("backlog");
	let isSaving = $state(false);
	let error = $state<string | null>(null);

	// Directories state
	let directories = $state<ProjectDirectory[]>([]);
	let isLoadingDirectories = $state(false);

	// Reset form when dialog opens or project changes
	$effect(() => {
		if (open) {
			name = project.name;
			defaultFeatureDestination =
				(project.default_feature_destination as "backlog" | "now") ??
				"backlog";
			error = null;
			activeTab = "general";
			loadDirectories();
		}
	});

	async function loadDirectories() {
		isLoadingDirectories = true;
		try {
			const api = await authApi.getClient();
			const { data, error: fetchError } = await api.GET(
				"/projects/{id}/directories",
				{
					params: { path: { id: project.id } },
				},
			);
			if (fetchError) {
				console.error("Failed to load directories:", fetchError);
				directories = [];
				return;
			}
			directories = data;
		} finally {
			isLoadingDirectories = false;
		}
	}

	async function handleSaveGeneral() {
		if (!name.trim()) {
			error = "Project name is required";
			return;
		}

		isSaving = true;
		error = null;

		try {
			const api = await authApi.getClient();
			// Only update the name (syncs to root feature title on server)
			const { error: updateError } = await api.PUT("/projects/{id}", {
				params: { path: { id: project.id } },
				body: {
					name: name.trim(),
				},
			});

			if (updateError) {
				throw new Error("Failed to update project");
			}

			if (onUpdated) {
				await onUpdated();
			}

			onOpenChange(false);
		} catch (err) {
			error =
				err instanceof Error ? err.message : "Failed to save changes";
		} finally {
			isSaving = false;
		}
	}

	async function handleSaveDefaults() {
		isSaving = true;
		error = null;

		try {
			const api = await authApi.getClient();
			const { error: updateError } = await api.PUT("/projects/{id}", {
				params: { path: { id: project.id } },
				body: {
					default_feature_destination: defaultFeatureDestination,
				},
			});

			if (updateError) {
				throw new Error("Failed to update project defaults");
			}

			if (onUpdated) {
				await onUpdated();
			}

			onOpenChange(false);
		} catch (err) {
			error =
				err instanceof Error ? err.message : "Failed to save changes";
		} finally {
			isSaving = false;
		}
	}

	async function handleAddDirectory(path: string, gitRemote: string | null) {
		const api = await authApi.getClient();
		const { error: addError } = await api.POST(
			"/projects/{id}/directories",
			{
				params: { path: { id: project.id } },
				body: {
					path,
					git_remote: gitRemote,
					is_primary: directories.length === 0,
				},
			},
		);

		if (addError) {
			throw new Error("Failed to add directory");
		}

		await loadDirectories();
	}

	async function handleRemoveDirectory(directoryId: string) {
		const api = await authApi.getClient();
		const { error: removeError } = await api.DELETE("/directories/{id}", {
			params: { path: { id: directoryId } },
		});

		if (removeError) {
			throw new Error("Failed to remove directory");
		}

		await loadDirectories();
	}
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay class="dialog-overlay" />
		<Dialog.Content class="dialog-content settings-content">
			<Dialog.Title class="dialog-title">Project Settings</Dialog.Title>
			<Dialog.Description class="dialog-description">
				Configure {project.name}
			</Dialog.Description>

			<div class="tabs">
				<button
					type="button"
					class="tab"
					class:active={activeTab === "general"}
					onclick={() => (activeTab = "general")}
				>
					Project Name
				</button>
				<button
					type="button"
					class="tab"
					class:active={activeTab === "directories"}
					onclick={() => (activeTab = "directories")}
				>
					Working Directories
				</button>
				<button
					type="button"
					class="tab"
					class:active={activeTab === "defaults"}
					onclick={() => (activeTab = "defaults")}
				>
					Defaults
				</button>
			</div>

			<div class="tab-content">
				{#if activeTab === "general"}
					<div class="general-form">
						<div class="form-field">
							<label for="project-name" class="form-label"
								>Name</label
							>
							<input
								id="project-name"
								type="text"
								class="form-input"
								bind:value={name}
								disabled={isSaving}
							/>
							<span class="form-hint"
								>The project name is shown in the feature tree
								and synced to the root feature title.</span
							>
						</div>

						<div class="form-field instructions-notice">
							<p class="notice-text">
								Project instructions are now managed through the
								root feature in the feature tree. Select the
								project root (with the folder icon) to edit
								instructions.
							</p>
						</div>

						{#if error}
							<div class="form-error">{error}</div>
						{/if}

						<div class="form-actions">
							<button
								type="button"
								class="btn btn-secondary"
								onclick={() => onOpenChange(false)}
								disabled={isSaving}
							>
								Cancel
							</button>
							<button
								type="button"
								class="btn btn-primary"
								onclick={handleSaveGeneral}
								disabled={isSaving || !name.trim()}
							>
								{isSaving ? "Saving..." : "Save Changes"}
							</button>
						</div>
					</div>
				{:else if activeTab === "directories"}
					<div class="directories-section">
						{#if isLoadingDirectories}
							<div class="loading-state">
								Loading directories...
							</div>
						{:else}
							<DirectoryList
								{directories}
								onAdd={handleAddDirectory}
								onRemove={handleRemoveDirectory}
							/>
						{/if}
					</div>
				{:else if activeTab === "defaults"}
					<div class="general-form">
						<div class="form-field">
							<label class="form-label"
								>Where should new features go?</label
							>
							<div class="radio-group">
								<label class="radio-option">
									<input
										type="radio"
										name="feature-destination"
										value="backlog"
										bind:group={defaultFeatureDestination}
										disabled={isSaving}
									/>
									<div class="radio-content">
										<span class="radio-label">Backlog</span>
										<span class="form-hint"
											>New features start unscheduled
											until manually assigned to a
											version.</span
										>
									</div>
								</label>
								<label class="radio-option">
									<input
										type="radio"
										name="feature-destination"
										value="now"
										bind:group={defaultFeatureDestination}
										disabled={isSaving}
									/>
									<div class="radio-content">
										<span class="radio-label">Now</span>
										<span class="form-hint"
											>New features go directly into the
											current version.</span
										>
									</div>
								</label>
							</div>
						</div>

						{#if error}
							<div class="form-error">{error}</div>
						{/if}

						<div class="form-actions">
							<button
								type="button"
								class="btn btn-secondary"
								onclick={() => onOpenChange(false)}
								disabled={isSaving}
							>
								Cancel
							</button>
							<button
								type="button"
								class="btn btn-primary"
								onclick={handleSaveDefaults}
								disabled={isSaving}
							>
								{isSaving ? "Saving..." : "Save Changes"}
							</button>
						</div>
					</div>
				{/if}
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	/* Styles handled by globally imported dialog.css */

	:global(.settings-content) {
		width: 1000px;
		min-width: 640px;
		max-width: calc(100vw - 40px);
		height: calc(100vh - 80px);
		max-height: none;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		border-radius: 0;
	}

	.tabs {
		display: flex;
		gap: 4px;
		margin-bottom: 20px;
		border-bottom: 1px solid var(--border-default);
		padding-bottom: 0;
	}

	.tab {
		padding: 8px 16px;
		font-size: 13px;
		font-weight: 500;
		color: var(--foreground-muted);
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.tab:hover {
		color: var(--foreground);
	}

	.tab.active {
		color: var(--foreground);
		border-bottom-color: var(--accent-blue);
	}

	.tab-content {
		flex: 1;
		overflow-y: auto;
		min-height: 0;
	}

	.general-form {
		display: flex;
		flex-direction: column;
		gap: 16px;
		height: 100%;
	}

	.instructions-notice {
		padding: 16px;
		background: var(--background-subtle);
		border: 1px solid var(--border-default);
		border-radius: 6px;
	}

	.notice-text {
		margin: 0;
		font-size: 13px;
		color: var(--foreground-muted);
		line-height: 1.5;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 8px;
	}

	.radio-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.radio-option {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 12px;
		border: 1px solid var(--border-default);
		border-radius: 6px;
		cursor: pointer;
		transition: border-color 0.15s ease;
	}

	.radio-option:hover {
		border-color: var(--foreground-subtle);
	}

	.radio-option:has(input:checked) {
		border-color: var(--accent-blue);
		background: color-mix(in srgb, var(--accent-blue) 5%, transparent);
	}

	.radio-option input[type="radio"] {
		margin-top: 2px;
		accent-color: var(--accent-blue);
	}

	.radio-content {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.radio-label {
		font-size: 14px;
		font-weight: 500;
		color: var(--foreground);
	}

	.directories-section {
		min-height: 200px;
	}

	.loading-state {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100px;
		color: var(--foreground-subtle);
		font-size: 13px;
	}
</style>
