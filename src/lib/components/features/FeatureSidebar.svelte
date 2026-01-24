<script lang="ts">
	import { getAuthApiContext } from '$lib/api/auth-context.js';
	import type { components } from '$lib/api/schema.js';
	import { StateIcon } from '$lib/components/icons/index.js';

	const authApi = getAuthApiContext();

	type Feature = components['schemas']['Feature'];
	type FeatureTreeNode = components['schemas']['FeatureTreeNode'];
	type ProjectHistoryEntry = components['schemas']['ProjectHistoryEntry'];

	type TimeGroup = {
		label: string;
		entries: ProjectHistoryEntry[];
	};

	interface Props {
		feature: Feature | null;
		featureTree: FeatureTreeNode[];
		projectId: string;
		projectSlug: string;
		gitRemote?: string;
	}

	let { feature, featureTree, projectId, projectSlug, gitRemote }: Props = $props();

	let history = $state<ProjectHistoryEntry[]>([]);
	let isLoadingHistory = $state(false);
	let lastLoadedFeatureId = $state<string | null>(null);

	// Find feature node in tree
	function findInTree(nodes: FeatureTreeNode[], id: string): FeatureTreeNode | null {
		for (const node of nodes) {
			if (node.id === id) return node;
			const found = findInTree(node.children, id);
			if (found) return found;
		}
		return null;
	}

	// Get all descendant IDs for a feature
	function getDescendantIds(node: FeatureTreeNode): string[] {
		const ids: string[] = [];
		for (const child of node.children) {
			ids.push(child.id);
			ids.push(...getDescendantIds(child));
		}
		return ids;
	}

	const featureNode = $derived(feature ? findInTree(featureTree, feature.id) : null);
	const isGroup = $derived(featureNode ? featureNode.children.length > 0 : false);
	const isRoot = $derived(feature ? feature.parent_id === null : false);
	const MAX_HISTORY_ITEMS = 7;

	// Time bucket grouping (same as HistoryList)
	function getTimeBucket(date: Date): string {
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);

		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const entryDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
		const diffCalendarDays = Math.floor((today.getTime() - entryDay.getTime()) / 86400000);

		if (diffMins < 5) return 'just now';
		if (diffMins < 60) return `${Math.floor(diffMins / 15) * 15 || 15} mins ago`;
		if (diffCalendarDays === 0 && diffHours === 1) return '1 hour ago';
		if (diffCalendarDays === 0 && diffHours < 4) return `${diffHours} hours ago`;
		if (diffCalendarDays === 0) return 'earlier today';
		if (diffCalendarDays === 1) return 'yesterday';
		if (diffCalendarDays < 7) return `${diffCalendarDays} days ago`;
		if (diffCalendarDays < 14) return '1 week ago';
		if (diffCalendarDays < 28) return `${Math.floor(diffCalendarDays / 7)} weeks ago`;
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	const truncatedHistory = $derived(history.slice(0, MAX_HISTORY_ITEMS));
	const hasMoreHistory = $derived(history.length > MAX_HISTORY_ITEMS);

	const groupedHistory = $derived.by(() => {
		if (!truncatedHistory || truncatedHistory.length === 0) return [];

		const groups: TimeGroup[] = [];
		let currentBucket = '';
		let currentGroup: ProjectHistoryEntry[] = [];

		for (const entry of truncatedHistory) {
			const bucket = getTimeBucket(new Date(entry.created_at));
			if (bucket !== currentBucket) {
				if (currentGroup.length > 0) {
					groups.push({ label: currentBucket, entries: currentGroup });
				}
				currentBucket = bucket;
				currentGroup = [entry];
			} else {
				currentGroup.push(entry);
			}
		}

		if (currentGroup.length > 0) {
			groups.push({ label: currentBucket, entries: currentGroup });
		}

		return groups;
	});

	// Load history when feature or tree changes
	$effect(() => {
		const currentFeatureNode = featureNode;
		const currentIsGroup = isGroup;
		const currentIsRoot = isRoot;

		if (feature && projectId && authApi.isReady() && featureTree.length > 0) {
			loadHistory(currentFeatureNode, currentIsGroup, currentIsRoot);
		} else {
			history = [];
			lastLoadedFeatureId = null;
		}
	});

	async function loadHistory(node: typeof featureNode, group: boolean, root: boolean) {
		if (!feature) return;

		// Skip if already loading this feature
		if (isLoadingHistory && feature.id === lastLoadedFeatureId) return;

		// Only show loading state when switching to a different feature
		// (not when refreshing the current one, which causes UI flicker)
		const isRefresh = feature.id === lastLoadedFeatureId;
		if (!isRefresh) {
			isLoadingHistory = true;
		}

		try {
			const api = await authApi.getClient();

			// Root feature: show recent project history
			if (root) {
				const { data, error } = await api.GET('/projects/{id}/history', {
					params: { path: { id: projectId }, query: { limit: 20 } }
				});

				if (error || !data) {
					console.error('Failed to load project history:', error);
					history = [];
					return;
				}

				history = data;
				lastLoadedFeatureId = feature.id;
				return;
			}

			// For leaf and group features, use the feature-specific endpoint
			const { data, error } = await api.GET('/features/{id}/history', {
				params: { path: { id: feature.id } }
			});

			if (error || !data) {
				console.error('Failed to load feature history:', error);
				history = [];
				return;
			}

			// Server now returns ProjectHistoryEntry[] directly
			history = data;
			lastLoadedFeatureId = feature.id;
		} finally {
			if (!isRefresh) {
				isLoadingHistory = false;
			}
		}
	}

	// Get headline from summary (first line before blank line)
	function getHeadline(summary: string | null | undefined): string {
		if (!summary) return '';
		const blankLineIndex = summary.indexOf('\n\n');
		if (blankLineIndex === -1) {
			const newlineIndex = summary.indexOf('\n');
			return newlineIndex === -1 ? summary : summary.slice(0, newlineIndex);
		}
		return summary.slice(0, blankLineIndex).split('\n')[0];
	}

	// Convert git remote to GitHub URL
	function getRepoUrl(remote: string | undefined): string | null {
		if (!remote) return null;
		const sshMatch = remote.match(/^git@github\.com:(.+?)(?:\.git)?$/);
		if (sshMatch) return `https://github.com/${sshMatch[1]}`;
		const httpsMatch = remote.match(/^https:\/\/github\.com\/(.+?)(?:\.git)?$/);
		if (httpsMatch) return `https://github.com/${httpsMatch[1]}`;
		return null;
	}

	const repoUrl = $derived(getRepoUrl(gitRemote));
</script>

<div class="feature-sidebar">
	{#if !feature}
		<div class="empty-state">Select a feature</div>
	{:else}
		<div class="sidebar-section history-section">
			<h3 class="section-title">Recent Activity</h3>

			{#if isLoadingHistory}
				<div class="loading-state">Loading...</div>
			{:else if history.length === 0}
				<div class="empty-history">No history yet</div>
			{:else}
				<div class="history-list">
					{#each groupedHistory as group, i (group.label + i)}
						<div class="time-group">
							<div class="time-header">
								<span class="time-pill">{group.label}</span>
								<span class="time-line"></span>
							</div>
							<div class="group-entries">
								{#each group.entries as entry (entry.id)}
									<div class="history-item">
										{#if isGroup || isRoot}
											<div class="feature-badge">
												<StateIcon state={entry.feature_state} size={10} />
												<span class="feature-name">{entry.feature_title}</span>
											</div>
										{/if}
										<div class="history-summary">
											<span class="headline">{getHeadline(entry.summary)}</span>
											{#if entry.commits && entry.commits.length > 0}
												<span class="commits">
													{#each entry.commits as commit, j}
														{#if repoUrl}
															<a
																href="{repoUrl}/commit/{commit.sha}"
																target="_blank"
																rel="noopener noreferrer"
																class="commit-link"
																title={commit.message}
															>
																{commit.sha.slice(0, 7)}
															</a>
														{:else}
															<code class="commit-sha" title={commit.message}>{commit.sha.slice(0, 7)}</code>
														{/if}
														{#if j < entry.commits.length - 1},&nbsp;{/if}
													{/each}
												</span>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
				{#if hasMoreHistory || isRoot}
					<a href="/app/{projectSlug}/activity" class="view-all-link">
						View all activity
					</a>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	.feature-sidebar {
		display: flex;
		flex-direction: column;
		width: 350px;
		min-width: 250px;
		border-left: 1px solid var(--border-default);
		background: var(--background);
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--foreground-subtle);
		font-size: 13px;
	}

	.sidebar-section {
		padding: 16px;
		border-bottom: 1px solid var(--border-default);
	}

	.history-section {
		display: flex;
		flex-direction: column;
		border-bottom: none;
	}

	.section-title {
		margin: 0 0 12px 0;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--foreground-muted);
	}

	.loading-state,
	.empty-history {
		color: var(--foreground-subtle);
		font-size: 13px;
		font-style: italic;
	}

	.history-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.time-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.time-header {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.time-pill {
		flex-shrink: 0;
		padding: 3px 10px;
		font-size: 10px;
		font-weight: 500;
		text-transform: lowercase;
		color: var(--foreground-subtle);
		background: var(--background-subtle);
		border: 1px solid var(--border-default);
		border-radius: 999px;
		white-space: nowrap;
	}

	.time-line {
		flex: 1;
		height: 1px;
		background: var(--border-default);
	}

	.group-entries {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding-left: 4px;
	}

	.history-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.feature-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		font-weight: 500;
		color: var(--foreground);
	}

	.feature-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 200px;
	}

	.history-summary {
		font-size: 13px;
		color: var(--foreground-muted);
		line-height: 1.4;
	}

	.headline {
		color: var(--foreground-muted);
	}

	.commits {
		margin-left: 6px;
		color: var(--foreground-subtle);
		font-size: 12px;
	}

	.commit-link,
	.commit-sha {
		font-family: var(--font-mono, monospace);
		font-size: 11px;
		padding: 1px 4px;
		background: var(--background-muted);
		border-radius: 3px;
		color: var(--accent-blue);
		text-decoration: none;
	}

	.commit-link:hover {
		background: var(--accent-blue);
		color: var(--background);
	}

	.view-all-link {
		display: block;
		margin-top: 12px;
		padding: 8px 0;
		font-size: 12px;
		color: var(--accent-blue);
		text-decoration: none;
		text-align: center;
		border-top: 1px solid var(--border-default);
	}

	.view-all-link:hover {
		text-decoration: underline;
	}
</style>
