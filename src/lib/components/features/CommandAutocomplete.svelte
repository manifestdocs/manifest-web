<script lang="ts">
	import type { SlashCommand } from '@manifest/svelte/commands';
	import { getMatchHighlights } from '@manifest/svelte/commands';

	interface Props {
		query: string;
		commands: SlashCommand[];
		selectedIndex: number;
		onSelect: (command: SlashCommand) => void;
		onClose: () => void;
	}

	let { query, commands, selectedIndex, onSelect, onClose }: Props = $props();

	/**
	 * Render text with highlighted matching characters.
	 */
	function highlightText(text: string, query: string): { text: string; highlighted: boolean }[] {
		const highlights = getMatchHighlights(query, text);
		if (highlights.length === 0) {
			return [{ text, highlighted: false }];
		}

		const result: { text: string; highlighted: boolean }[] = [];
		let lastEnd = 0;

		for (const { start, end } of highlights) {
			if (start > lastEnd) {
				result.push({ text: text.slice(lastEnd, start), highlighted: false });
			}
			result.push({ text: text.slice(start, end), highlighted: true });
			lastEnd = end;
		}

		if (lastEnd < text.length) {
			result.push({ text: text.slice(lastEnd), highlighted: false });
		}

		return result;
	}
</script>

{#if commands.length > 0}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="command-autocomplete" onmousedown={(e) => e.preventDefault()}>
		<div class="command-list" role="listbox">
			{#each commands as command, i (command.id)}
				{@const isSelected = i === selectedIndex}
				<button
					type="button"
					class="command-item"
					class:selected={isSelected}
					role="option"
					aria-selected={isSelected}
					onclick={() => onSelect(command)}
					onmouseenter={() => {
						/* Could update selectedIndex on hover */
					}}
				>
					<div class="command-header">
						<span class="command-id">
							{#each highlightText(command.id, query) as part}
								{#if part.highlighted}
									<mark class="highlight">{part.text}</mark>
								{:else}
									{part.text}
								{/if}
							{/each}
						</span>
						<span class="command-name">
							{#each highlightText(command.name, query) as part}
								{#if part.highlighted}
									<mark class="highlight">{part.text}</mark>
								{:else}
									{part.text}
								{/if}
							{/each}
						</span>
					</div>
					<span class="command-description">{command.description}</span>
				</button>
			{/each}
		</div>
		<div class="command-hint">
			<kbd>↑</kbd><kbd>↓</kbd> navigate
			<kbd>↵</kbd> select
			<kbd>esc</kbd> close
		</div>
	</div>
{/if}

<style>
	.command-autocomplete {
		position: absolute;
		bottom: 100%;
		left: 0;
		right: 0;
		margin-bottom: 4px;
		background: var(--background-default);
		border: 1px solid var(--border-default);
		border-radius: 8px;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06);
		overflow: hidden;
		z-index: 50;
	}

	.command-list {
		max-height: 240px;
		overflow-y: auto;
		padding: 4px;
	}

	.command-item {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		width: 100%;
		padding: 8px 12px;
		background: transparent;
		border: none;
		border-radius: 6px;
		text-align: left;
		cursor: pointer;
		transition: background 0.1s ease;
	}

	.command-item:hover,
	.command-item.selected {
		background: var(--background-muted);
	}

	.command-item.selected {
		background: var(--background-emphasis);
	}

	.command-header {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.command-id {
		font-family: var(--font-mono, monospace);
		font-size: 12px;
		font-weight: 500;
		color: var(--accent-blue);
	}

	.command-name {
		font-size: 13px;
		font-weight: 500;
		color: var(--foreground);
	}

	.command-description {
		font-size: 12px;
		color: var(--foreground-subtle);
		line-height: 1.4;
	}

	.highlight {
		background: rgba(156, 220, 254, 0.3);
		color: inherit;
		border-radius: 2px;
	}

	.command-hint {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		font-size: 11px;
		color: var(--foreground-muted);
		background: var(--background-subtle);
		border-top: 1px solid var(--border-default);
	}

	.command-hint kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 4px;
		font-family: var(--font-mono, monospace);
		font-size: 10px;
		background: var(--background-default);
		border: 1px solid var(--border-default);
		border-radius: 3px;
	}
</style>
