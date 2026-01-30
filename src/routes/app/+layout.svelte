<script lang="ts">
	import { api } from '$lib/api/client.js';
	import { setAuthApiContext } from '$lib/api/auth-context.js';
	import type { components } from '$lib/api/schema.js';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { setContext } from 'svelte';
	import headerLogotype from '$lib/assets/manifest_header_logotype.png';
	import { NewProjectWizard, ProjectSettingsDialog } from '$lib/components/projects/index.js';
	import { SettingsIcon, PlusIcon, SearchIcon } from '$lib/components/icons/index.js';
	import { CommandPalette } from '$lib/components/command-palette/index.js';
	import UpdateBanner from '$lib/components/ui/UpdateBanner.svelte';
	import ConnectionBanner from '$lib/components/ui/ConnectionBanner.svelte';
	import { ServerSettingsDialog } from '$lib/components/settings/index.js';
	import { debugEmptyState, type DebugEmptyState } from '$lib/stores/index.js';

	type Project = components['schemas']['Project'];

	let { children } = $props();

	// Set up auth API context for child components (no auth in self-hosted mode)
	setAuthApiContext(
		() => Promise.resolve(null),
		() => true
	);

	let projects = $state<Project[]>([]);
	let isLoadingProjects = $state(true);

	// Dialog state
	let newProjectWizardOpen = $state(false);
	let settingsDialogOpen = $state(false);
	let serverSettingsOpen = $state(false);
	let commandPaletteOpen = $state(false);

	// Debug state change handler
	function handleDebugStateChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		debugEmptyState.set(select.value as DebugEmptyState);
	}

	// Global keyboard shortcut for command palette
	function handleGlobalKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
			return;
		}
		if ((e.key === 't' || e.key === 'T') && !e.metaKey && !e.ctrlKey && !e.altKey) {
			e.preventDefault();
			commandPaletteOpen = true;
		}
	}

	// Load projects on mount
	$effect(() => {
		loadProjects();
	});

	async function loadProjects() {
		isLoadingProjects = true;
		try {
			const { data, error } = await api.GET('/projects');
			if (error || !data) {
				console.error('Failed to load projects:', error);
				isLoadingProjects = false;
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
		const projectSlug = select.value;
		if (projectSlug) {
			goto(`/app/${projectSlug}`);
		}
	}

	const selectedProjectSlug = $derived(page.params.projectSlug || null);
	const selectedProject = $derived(projects.find((p) => p.slug === selectedProjectSlug));
	const selectedFeatureId = $derived(page.url.searchParams.get('feature'));
	const featureQueryParam = $derived(selectedFeatureId ? `?feature=${selectedFeatureId}` : '');

	// Remember last viewed project (by slug for cleaner URLs)
	$effect(() => {
		if (selectedProjectSlug && typeof localStorage !== 'undefined') {
			localStorage.setItem('manifest_last_project', selectedProjectSlug);
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

	// Expose wizard control to child routes (e.g., WelcomeScreen)
	setContext('newProjectWizard', {
		open: () => { newProjectWizardOpen = true; }
	});
</script>

<svelte:document onkeydown={handleGlobalKeydown} />

{#if page.params.projectSlug}
	<div class="app-layout">
		<header class="app-header">
			<div class="header-left">
				<a href="/" class="logo">
					<img src={headerLogotype} alt="Manifest" class="logo-image" />
				</a>
				<nav class="view-nav">
					<div class="nav-group">
						<a
							href="{base}/app/{selectedProjectSlug}{featureQueryParam}"
							class="nav-link"
							class:active={page.url.pathname === `/app/${selectedProjectSlug}`}
						>
							Edit
						</a>
						<a
							href="{base}/app/{selectedProjectSlug}/versions{featureQueryParam}"
							class="nav-link"
							class:active={page.url.pathname === `/app/${selectedProjectSlug}/versions`}
						>
							Plan
						</a>
					</div>
					<a
						href="{base}/app/{selectedProjectSlug}/activity"
						class="nav-link"
						class:active={page.url.pathname === `/app/${selectedProjectSlug}/activity`}
					>
						Activity
					</a>
				</nav>
			</div>
			<div class="header-right">
				<button
					class="search-btn"
					onclick={() => (commandPaletteOpen = true)}
					title="Search features (T)"
				>
					<SearchIcon size={14} />
					<span class="search-label">Search</span>
					<kbd class="search-kbd">T</kbd>
				</button>
				<div class="header-divider"></div>
				<span class="project-label">Project</span>
				<select
					class="project-select"
					value={selectedProjectSlug}
					onchange={handleProjectChange}
					disabled={isLoadingProjects}
				>
					{#if isLoadingProjects}
						<option value="">Loading...</option>
					{:else if projects.length === 0}
						<option value="">No projects</option>
					{:else}
						{#each projects as project (project.id)}
							<option value={project.slug}>{project.name}</option>
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
				<button
					class="icon-btn"
					onclick={() => (serverSettingsOpen = true)}
					title="Server settings"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<ellipse cx="12" cy="5" rx="9" ry="3" />
						<path d="M3 5V12a9 3 0 0 0 18 0V5" />
						<path d="M3 12a9 3 0 0 0 18 0" />
					</svg>
				</button>
				<div class="header-divider"></div>
				<a href="{base}/docs" class="docs-link">
					Docs
				</a>
				{#if import.meta.env.DEV}
				<div class="header-divider"></div>
				<select
					class="debug-select"
					class:active={debugEmptyState.isActive}
					value={debugEmptyState.value}
					onchange={handleDebugStateChange}
					title="Debug: Test empty states"
				>
					<option value="none">Debug</option>
					<option value="no-projects">No Projects</option>
					<option value="no-directory">No Directory</option>
					<option value="no-features">No Features</option>
				</select>
			{/if}
			</div>
		</header>

		<ConnectionBanner />
		<UpdateBanner />

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

<ServerSettingsDialog
	open={serverSettingsOpen}
	onOpenChange={(open) => (serverSettingsOpen = open)}
/>

{#if selectedProject}
	<ProjectSettingsDialog
		open={settingsDialogOpen}
		onOpenChange={(open) => (settingsDialogOpen = open)}
		project={selectedProject}
		onUpdated={loadProjects}
	/>
	<CommandPalette
		open={commandPaletteOpen}
		onOpenChange={(open) => (commandPaletteOpen = open)}
		projectId={selectedProject.id}
		projectSlug={selectedProjectSlug || ''}
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

	.header-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.project-label {
		font-size: 13px;
		font-weight: 500;
		color: var(--foreground-muted);
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
		left: 1px;
	}

	.project-select {
		padding: 6px 32px 6px 12px;
		font-size: 14px;
		font-weight: 500;
		background: var(--background);
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
		background: var(--background);
		border: 1px solid var(--border-default);
		border-radius: 2px;
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
		background: var(--background);
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
		background: rgba(156, 220, 254, 0.2);
		color: var(--state-implemented);
	}

	.view-nav > .nav-link {
		padding: 8px 10px;
		background: var(--background);
		border-radius: 6px;
	}

	.view-nav > .nav-link:hover {
		background: var(--background-emphasis);
	}

	.view-nav > .nav-link.active {
		background: rgba(156, 220, 254, 0.2);
		color: var(--state-implemented);
	}

	.app-main {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.header-divider {
		width: 1px;
		height: 20px;
		background: var(--border-default);
		margin: 0 4px;
	}

	.docs-link {
		padding: 6px 12px;
		font-size: 13px;
		font-weight: 500;
		color: var(--foreground-muted);
		text-decoration: none;
		border-radius: 6px;
		transition: all 0.15s ease;
	}

	.docs-link:hover {
		color: var(--foreground);
		background: var(--background);
	}

	.search-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		min-width: 180px;
		font-size: 13px;
		color: var(--foreground-muted);
		background: var(--background);
		border: 1px solid var(--border-default);
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.search-btn:hover {
		color: var(--foreground);
		border-color: var(--foreground-subtle);
	}

	.search-label {
		flex: 1;
		font-weight: 500;
	}

	.search-kbd {
		padding: 2px 5px;
		font-size: 11px;
		font-family: var(--font-mono, monospace);
		background: var(--background-subtle);
		border: 1px solid var(--border-default);
		border-radius: 3px;
		color: var(--foreground-subtle);
	}

	.debug-select {
		padding: 4px 24px 4px 8px;
		font-size: 11px;
		font-weight: 500;
		background: var(--background);
		border: 1px solid var(--border-default);
		border-radius: 4px;
		color: var(--foreground-muted);
		cursor: pointer;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6L8 10L12 6' stroke='%238b949e' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 4px center;
	}

	.debug-select:hover {
		border-color: var(--foreground-subtle);
		color: var(--foreground);
	}

	.debug-select:focus {
		outline: none;
		border-color: var(--accent-blue);
	}

	.debug-select.active {
		background-color: #f59e0b;
		border-color: #f59e0b;
		color: black;
	}
</style>
