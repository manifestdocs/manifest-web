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
<div class="history-entry" class:has-body={body !== null} onclick={handleEntryClick}>
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
			<span class="expand-indicator" class:rotated={isExpanded}>
				<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M3 4.5L6 7.5L9 4.5" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</span>
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

	.expand-indicator {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 2px;
		color: var(--foreground-subtle);
		transition: transform 0.15s ease;
	}

	.expand-indicator.rotated {
		transform: rotate(180deg);
	}

	.entry-body {
		margin-top: 8px;
		margin-left: 17px;
		padding: 8px 12px;
		background: var(--background-muted);
		border-radius: 4px;
		border-left: 2px solid var(--border-default);
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
