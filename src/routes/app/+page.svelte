<script lang="ts">
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
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

	// Redirect to last viewed project (or first project) when projects are loaded
	$effect(() => {
		if (!projectsContext.isLoading && projectsContext.projects.length > 0) {
			const lastProjectKey = typeof localStorage !== 'undefined'
				? localStorage.getItem('manifest_last_project')
				: null;
			// Support both slug (new) and id (legacy) lookups for backwards compatibility
			const lastProject = lastProjectKey
				? projectsContext.projects.find((p) => p.slug === lastProjectKey || p.id === lastProjectKey)
				: null;
			const targetProject = lastProject || projectsContext.projects[0];
			goto(`/app/${targetProject.slug}`, { replaceState: true });
		}
	});

	function handleCreateProject() {
		wizardOpen = true;
	}

	async function handleProjectCreated() {
		await projectsContext.refresh();
	}
</script>

{#if projectsContext.isLoading || projectsContext.projects.length > 0}
	<div class="loading-container">
		<div class="spinner"></div>
		<span>Loading projects...</span>
	</div>
{:else}
	<WelcomeScreen onCreateProject={handleCreateProject} />
	<NewProjectWizard
		open={wizardOpen}
		onOpenChange={(open) => (wizardOpen = open)}
		onCreated={handleProjectCreated}
	/>
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
