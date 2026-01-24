<script lang="ts">
	import type { components } from '$lib/api/schema.js';
	import { StateIcon } from '$lib/components/icons/index.js';

	type ProjectHistoryEntry = components['schemas']['ProjectHistoryEntry'];

	interface Props {
		entry: ProjectHistoryEntry;
		gitRemote?: string;
		onFeatureClick?: (featureId: string) => void;
	}

	let { entry, gitRemote, onFeatureClick }: Props = $props();

	// Detect release entries (created on root feature with "Released X" summary)
	let isReleaseEntry = $derived(entry.summary.startsWith('Released '));

	// Convert git remote URL to GitHub web URL for commits
	// e.g., "git@github.com:user/repo.git" -> "https://github.com/user/repo"
	// e.g., "https://github.com/user/repo.git" -> "https://github.com/user/repo"
	let repoUrl = $derived.by(() => {
		if (!gitRemote) return null;
		// SSH format: git@github.com:user/repo.git
		const sshMatch = gitRemote.match(/^git@github\.com:(.+?)(?:\.git)?$/);
		if (sshMatch) return `https://github.com/${sshMatch[1]}`;
		// HTTPS format: https://github.com/user/repo.git
		const httpsMatch = gitRemote.match(/^https:\/\/github\.com\/(.+?)(?:\.git)?$/);
		if (httpsMatch) return `https://github.com/${httpsMatch[1]}`;
		return null;
	});
	let isExpanded = $state(false);

	// Parse summary into headline (first line) and body (after first blank line)
	// Follows git commit message convention
	let { headline, body } = $derived.by(() => {
		const summary = entry.summary || '';
		const blankLineIndex = summary.indexOf('\n\n');
		if (blankLineIndex === -1) {
			// No blank line - first line is headline, no body
			const newlineIndex = summary.indexOf('\n');
			return {
				headline: newlineIndex === -1 ? summary : summary.slice(0, newlineIndex),
				body: null
			};
		}
		return {
			headline: summary.slice(0, blankLineIndex).split('\n')[0],
			body: summary.slice(blankLineIndex + 2).trim() || null
		};
	});

	function handleFeatureClick(event: MouseEvent) {
		event.stopPropagation();
		onFeatureClick?.(entry.feature_id);
	}

	function handleEntryClick() {
		if (body) {
			isExpanded = !isExpanded;
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="history-entry" class:has-body={body !== null} class:release-entry={isReleaseEntry} onclick={handleEntryClick}>
	{#if isReleaseEntry}
		<!-- Release milestone styling -->
		<div class="entry-header release-header">
			<span class="release-icon">🚀</span>
			<span class="release-title">{headline}</span>
		</div>
	{:else}
		<!-- Regular feature entry -->
		<div class="entry-header">
			<button type="button" class="feature-link" onclick={handleFeatureClick}>
				<StateIcon state={entry.feature_state} size={12} />
				<span class="feature-title">{entry.feature_title}</span>
			</button>
			{#if body}
				<span class="twirl" class:expanded={isExpanded}>
					<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
						<path d="M3 2L7 5L3 8" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</span>
			{:else}
				<span class="separator">—</span>
			{/if}
			<span class="headline">{headline}</span>
			{#if entry.commits && entry.commits.length > 0}
				<span class="commits">
					{#each entry.commits as commit, i}
						{#if repoUrl}
							<a
								href="{repoUrl}/commit/{commit.sha}"
								target="_blank"
								rel="noopener noreferrer"
								class="sha-link"
								title={commit.message}
								onclick={(e) => e.stopPropagation()}
							>
								<code class="sha">{commit.sha.slice(0, 7)}</code>
							</a>
						{:else}
							<code class="sha" title={commit.message}>{commit.sha.slice(0, 7)}</code>
						{/if}
						{#if i < entry.commits.length - 1},&nbsp;{/if}
					{/each}
				</span>
			{/if}
		</div>
	{/if}
	{#if body && isExpanded}
		<div class="entry-body">
			<pre class="body-text">{body}</pre>
		</div>
	{/if}
</div>

<style>
	.history-entry {
		display: flex;
		flex-direction: column;
		gap: 0;
		padding: 4px 0;
		font-size: 13px;
		line-height: 1.4;
	}

	.history-entry.has-body {
		cursor: pointer;
	}

	.history-entry.has-body:hover {
		background: var(--background-subtle);
		margin: 0 -8px;
		padding: 4px 8px;
		border-radius: 4px;
	}

	/* Release milestone styling */
	.history-entry.release-entry {
		padding: 8px 12px;
		margin: 4px -12px;
		background: var(--accent-green-subtle, rgba(34, 197, 94, 0.1));
		border-left: 3px solid var(--accent-green, #22c55e);
	}

	.release-header {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.release-icon {
		flex-shrink: 0;
		font-size: 14px;
		line-height: 1;
	}

	.release-title {
		font-weight: 600;
		color: var(--foreground);
	}

	.entry-header {
		display: flex;
		align-items: baseline;
		gap: 6px;
		flex-wrap: wrap;
	}

	.feature-link {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		color: var(--foreground);
		font-weight: 500;
		font-size: 13px;
	}

	.feature-link:hover .feature-title {
		color: var(--accent-blue);
		text-decoration: underline;
	}

	.feature-title {
		transition: color 0.15s ease;
	}

	.separator {
		color: var(--foreground-subtle);
		opacity: 0.5;
	}

	.headline {
		color: var(--foreground-muted);
	}

	.commits {
		color: var(--foreground-subtle);
		font-size: 12px;
	}

	.sha {
		font-family: var(--font-mono, monospace);
		font-size: 11px;
		padding: 1px 4px;
		background: var(--background-muted);
		border-radius: 3px;
		color: var(--accent-blue);
	}

	.sha-link {
		text-decoration: none;
	}

	.sha-link:hover .sha {
		background: var(--accent-blue);
		color: var(--background);
	}

	.twirl {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--foreground-subtle);
		transition: transform 0.15s ease;
	}

	.twirl.expanded {
		transform: rotate(90deg);
	}

	.entry-body {
		margin-top: 4px;
		margin-left: 17px;
	}

	.body-text {
		margin: 0;
		font-family: var(--font-mono, monospace);
		font-size: 12px;
		line-height: 1.5;
		color: var(--foreground-muted);
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
