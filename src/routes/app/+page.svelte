<script lang="ts">
	import { getContext } from 'svelte';
	import { WelcomeScreen, NewProjectWizard } from '$lib/components/projects/index.js';
	import type { components } from '$lib/api/schema.js';

	type Project = components['schemas']['Project'];

	interface ProjectsContext {
		readonly projects: Project[];
		readonly isLoading: boolean;
		refresh: () => Promise<void>;
	}

	const projectsContext = getContext<ProjectsContext>('projects');

	let wizardOpen = $state(false);

	function handleCreateProject() {
		wizardOpen = true;
	}

	async function handleProjectCreated() {
		await projectsContext.refresh();
	}
</script>

{#if projectsContext.isLoading}
	<div class="loading-container">
		<div class="spinner"></div>
		<span>Loading projects...</span>
	</div>
{:else if projectsContext.projects.length === 0}
	<WelcomeScreen onCreateProject={handleCreateProject} />
	<NewProjectWizard
		open={wizardOpen}
		onOpenChange={(open) => (wizardOpen = open)}
		onCreated={handleProjectCreated}
	/>
{:else}
	<div class="loading-container">
		<div class="spinner"></div>
		<span>Loading projects...</span>
	</div>
{/if}

<style>
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		gap: 16px;
		color: var(--foreground-subtle);
		background: var(--background);
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--border-default);
		border-top-color: var(--accent-blue);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
