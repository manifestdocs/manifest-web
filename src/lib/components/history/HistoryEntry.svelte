<script lang="ts">
	import type { components } from '$lib/api/schema.js';
	import { StateIcon } from '$lib/components/icons/index.js';

	type ProjectHistoryEntry = components['schemas']['ProjectHistoryEntry'];

	interface Props {
		entry: ProjectHistoryEntry;
		onFeatureClick?: (featureId: string) => void;
	}

	let { entry, onFeatureClick }: Props = $props();
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

	function handleFeatureClick() {
		onFeatureClick?.(entry.feature_id);
	}

	function toggleExpand() {
		isExpanded = !isExpanded;
	}
</script>

<div class="history-entry" class:has-body={body !== null}>
	<div class="entry-header">
		<button type="button" class="feature-link" onclick={handleFeatureClick}>
			<StateIcon state={entry.feature_state} size={12} />
			<span class="feature-title">{entry.feature_title}</span>
		</button>
		<span class="separator">—</span>
		<span class="headline">{headline}</span>
		{#if entry.commits && entry.commits.length > 0}
			<span class="commits">
				{#each entry.commits as commit, i}
					<code class="sha">{commit.sha.slice(0, 7)}</code>{#if i < entry.commits.length - 1},&nbsp;{/if}
				{/each}
			</span>
		{/if}
		{#if body}
			<button type="button" class="expand-toggle" onclick={toggleExpand} aria-expanded={isExpanded}>
				<svg
					width="12"
					height="12"
					viewBox="0 0 12 12"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					class:rotated={isExpanded}
				>
					<path d="M3 4.5L6 7.5L9 4.5" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</button>
		{/if}
	</div>
	{#if body && isExpanded}
		<div class="entry-body">
			<pre class="body-text">{body}</pre>
		</div>
	{/if}
</div>

<style>
	.history-entry {
		display: flex;
		align-items: baseline;
		gap: 6px;
		padding: 4px 0;
		font-size: 13px;
		line-height: 1.4;
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

	.summary {
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
</style>
