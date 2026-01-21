<script lang="ts">
	import { api } from '$lib/api/client.js';
	import type { components } from '$lib/api/schema.js';
	import { HistoryList } from '$lib/components/history/index.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	type ProjectHistoryEntry = components['schemas']['ProjectHistoryEntry'];

	let historyEntries = $state<ProjectHistoryEntry[]>([]);
	let isLoadingHistory = $state(false);
	let gitRemote = $state<string | undefined>(undefined);

	const projectId = $derived(page.params.projectId);

	// Load history and directories when project changes
	$effect(() => {
		if (projectId) {
			loadHistory(projectId);
			loadGitRemote(projectId);
		}
	});

	async function loadHistory(projectId: string) {
		isLoadingHistory = true;
		try {
			const { data, error } = await api.GET('/projects/{id}/history', {
				params: { path: { id: projectId }, query: { limit: 50 } }
			});
			if (error) {
				console.error('Failed to load history:', error);
				historyEntries = [];
				return;
			}
			historyEntries = data;
		} finally {
			isLoadingHistory = false;
		}
	}

	async function loadGitRemote(projectId: string) {
		const { data, error } = await api.GET('/projects/{id}/directories', {
			params: { path: { id: projectId } }
		});
		if (error || !data) {
			gitRemote = undefined;
			return;
		}
		// Use git_remote from primary directory, or first directory with git_remote
		const primary = data.find((d) => d.is_primary);
		gitRemote = primary?.git_remote ?? data.find((d) => d.git_remote)?.git_remote ?? undefined;
	}

	function handleFeatureClick(featureId: string) {
		// Navigate to tree view with feature selected
		goto(`/app/${projectId}?feature=${featureId}`);
	}
</script>

<section class="content-full">
	<HistoryList entries={historyEntries} isLoading={isLoadingHistory} {gitRemote} onFeatureClick={handleFeatureClick} />
</section>

<style>
	.content-full {
		flex: 1;
		overflow: hidden;
		background: var(--background);
	}
</style>
