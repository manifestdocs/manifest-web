<script lang="ts">
	import { api } from '$lib/api/client.js';
	import type { components } from '$lib/api/schema.js';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { setContext } from 'svelte';
	import headerLogotype from '$lib/assets/manifest_header_logotype.png';
	import { NewProjectWizard, ProjectSettingsDialog } from '$lib/components/projects/index.js';
	import { SettingsIcon, PlusIcon } from '$lib/components/icons/index.js';

	type Project = components['schemas']['Project'];

	let { children } = $props();

	let projects = $state<Project[]>([]);
	let isLoadingProjects = $state(true);

	// Dialog state
	let newProjectWizardOpen = $state(false);
	let settingsDialogOpen = $state(false);

	// Load projects on mount
	$effect(() => {
		loadProjects();
	});

	async function loadProjects() {
		isLoadingProjects = true;
		try {
			const { data, error } = await api.GET('/projects');
			if (error) {
				console.error('Failed to load projects:', error);
				return;
			}
			// Filter to unique project names, preferring those with descriptions
			const uniqueProjects = data.reduce(
				(acc, project) => {
					const existing = acc.find((p) => p.name === project.name);
					if (!existing) {
						acc.push(project);
					} else if (!existing.description && project.description) {
						const idx = acc.indexOf(existing);
						acc[idx] = project;
					}
					return acc;
				},
				[] as Project[]
			);

			projects = uniqueProjects.sort((a, b) => a.name.localeCompare(b.name));
		} finally {
			isLoadingProjects = false;
		}
	}

	function handleProjectChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		const projectId = select.value;
		if (projectId) {
			goto(`/app/${projectId}`);
		}
	}

	const selectedProjectId = $derived(page.params.projectId || null);
	const selectedProject = $derived(projects.find((p) => p.id === selectedProjectId));
	const selectedFeatureId = $derived(page.url.searchParams.get('feature'));
	const featureQueryParam = $derived(selectedFeatureId ? `?feature=${selectedFeatureId}` : '');

	// Remember last viewed project
	$effect(() => {
		if (selectedProjectId && typeof localStorage !== 'undefined') {
			localStorage.setItem('manifest_last_project', selectedProjectId);
		}
	});

	// Provide projects context to child routes
	setContext('projects', {
		get projects() {
			return projects;
		},
		get isLoading() {
			return isLoadingProjects;
		},
		refresh: loadProjects
	});
</script>

{#if page.params.projectId}
	<div class="app-layout">
		<header class="app-header">
			<div class="header-left">
				<a href="/" class="logo">
					<img src={headerLogotype} alt="Manifest" class="logo-image" />
				</a>
				<select
					class="project-select"
					value={selectedProjectId}
					onchange={handleProjectChange}
					disabled={isLoadingProjects}
				>
					{#if isLoadingProjects}
						<option value="">Loading...</option>
					{:else if projects.length === 0}
						<option value="">No projects</option>
					{:else}
						{#each projects as project (project.id)}
							<option value={project.id}>{project.name}</option>
						{/each}
					{/if}
				</select>
				<button
					class="icon-btn"
					onclick={() => (settingsDialogOpen = true)}
					title="Project settings"
				>
					<SettingsIcon size={16} />
				</button>
				<button
					class="icon-btn"
					onclick={() => (newProjectWizardOpen = true)}
					title="New project"
				>
					<PlusIcon size={16} />
				</button>
				<nav class="view-nav">
					<div class="nav-group">
						<a
							href="/app/{selectedProjectId}{featureQueryParam}"
							class="nav-link"
							class:active={page.url.pathname === `/app/${selectedProjectId}`}
						>
							Edit
						</a>
						<a
							href="/app/{selectedProjectId}/versions{featureQueryParam}"
							class="nav-link"
							class:active={page.url.pathname === `/app/${selectedProjectId}/versions`}
						>
							Plan
						</a>
					</div>
					<a
						href="/app/{selectedProjectId}/history"
						class="nav-link"
						class:active={page.url.pathname === `/app/${selectedProjectId}/history`}
					>
						History
					</a>
				</nav>
			</div>
			{#if selectedProject?.description}
				<span class="project-description">{selectedProject.description}</span>
			{/if}
		</header>

		<main class="app-main">
			{@render children()}
		</main>
	</div>
{:else}
	{@render children()}
{/if}

<NewProjectWizard
	open={newProjectWizardOpen}
	onOpenChange={(open) => (newProjectWizardOpen = open)}
	onCreated={loadProjects}
/>

{#if selectedProject}
	<ProjectSettingsDialog
		open={settingsDialogOpen}
		onOpenChange={(open) => (settingsDialogOpen = open)}
		project={selectedProject}
		onUpdated={loadProjects}
	/>
{/if}

<style>
	.app-layout {
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
	}

	.app-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		background: var(--background-subtle);
		border-bottom: 1px solid var(--border-default);
		gap: 16px;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.logo {
		display: flex;
		align-items: center;
		text-decoration: none;
		transition: opacity 0.15s ease;
	}

	.logo:hover {
		opacity: 0.8;
	}

	.logo-image {
		height: 30px;
		width: auto;
		position: relative;
		top: -1px;
	}

	.project-select {
		padding: 6px 32px 6px 12px;
		font-size: 14px;
		font-weight: 500;
		background: var(--background-muted);
		border: 1px solid var(--border-default);
		border-radius: 6px;
		color: var(--foreground);
		cursor: pointer;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6L8 10L12 6' stroke='%238b949e' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 8px center;
	}

	.project-select:hover {
		border-color: var(--foreground-subtle);
	}

	.project-select:focus {
		outline: none;
		border-color: var(--accent-blue);
	}

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: var(--background-muted);
		border: 1px solid var(--border-default);
		border-radius: 6px;
		color: var(--foreground-muted);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.icon-btn:hover {
		background: var(--background-emphasis);
		color: var(--foreground);
		border-color: var(--foreground-subtle);
	}

	.view-nav {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.nav-group {
		display: flex;
		gap: 2px;
		padding: 3px;
		background: var(--background-muted);
		border-radius: 6px;
	}

	.nav-link {
		padding: 5px 10px;
		font-size: 13px;
		font-weight: 500;
		color: var(--foreground-muted);
		text-decoration: none;
		border-radius: 4px;
		transition:
			background 0.15s ease,
			color 0.15s ease;
	}

	.nav-link:hover {
		color: var(--foreground);
	}

	.nav-link.active {
		background: var(--background);
		color: var(--foreground);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.view-nav > .nav-link {
		padding: 8px 10px;
		background: var(--background-muted);
		border-radius: 6px;
	}

	.view-nav > .nav-link:hover {
		background: var(--background-emphasis);
	}

	.view-nav > .nav-link.active {
		background: var(--background);
	}

	.project-description {
		font-size: 13px;
		color: var(--foreground-subtle);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.app-main {
		display: flex;
		flex: 1;
		overflow: hidden;
	}
</style>
