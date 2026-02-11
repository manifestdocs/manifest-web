<script lang="ts">
  import { getMatchHighlights, type CommandMatch } from '@manifest/svelte';

  interface Props {
    query: string;
    matches: CommandMatch[];
    selectedIndex: number;
    onSelect: (match: CommandMatch) => void;
  }

  let { query, matches, selectedIndex, onSelect }: Props = $props();

  const iconPaths: Record<string, string> = {
    sparkles: 'M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z',
    'check-square':
      'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
    'git-branch':
      'M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9',
    code: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
    layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    'book-open':
      'M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z',
    target: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z',
    'clipboard-check':
      'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 14l2 2 4-4',
    'sort-desc':
      'M3 6h7M3 12h5M3 18h3M16 6v12M16 18l4-4M16 18l-4-4',
    'file-text':
      'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  };
</script>

{#if matches.length > 0}
  <div class="command-menu" role="listbox" tabindex="-1" aria-label="Command suggestions" onmousedown={(e) => e.preventDefault()}>
    {#each matches as match, i (match.command.name)}
      {@const segments = getMatchHighlights(
        match.command.name,
        match.highlights,
      )}
      <button
        class="command-item"
        class:selected={i === selectedIndex}
        onmousedown={() => onSelect(match)}
        type="button"
      >
        <span class="command-icon">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d={iconPaths[match.command.icon] ?? iconPaths.code}></path>
          </svg>
        </span>
        <span class="command-name">
          <span class="command-slash">/</span
          >{#each segments as seg}{#if seg.highlighted}<strong
                >{seg.text}</strong
              >{:else}{seg.text}{/if}{/each}
        </span>
        <span class="command-desc">{match.command.description}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .command-menu {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    margin-bottom: 15px;
    background: var(--background-subtle);
    border-left: 1px solid var(--border-default);
    border-right: 1px solid var(--border-default);
    border-radius: 8px;
    padding: 4px;
    z-index: 10;
    animation: commandMenuIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  @keyframes commandMenuIn {
    0% {
      opacity: 0;
      transform: translateY(8px) scale(0.96);
    }
    60% {
      opacity: 1;
      transform: translateY(-2px) scale(1.01);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .command-item {
    display: flex;
    align-items: baseline;
    gap: 4px;
    width: 100%;
    padding: 8px 8px 8px 20px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--foreground);
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    text-align: left;
  }

  .command-item:hover,
  .command-item.selected {
    background: var(--background-muted);
  }

  .command-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    color: var(--foreground-subtle);
    flex-shrink: 0;
    align-self: center;
  }

  .command-name {
    font-weight: 500;
    white-space: nowrap;
  }

  .command-slash {
    color: var(--foreground);
    font-weight: 500;
  }

  .command-name :global(strong) {
    color: var(--accent-blue, #58a6ff);
    font-weight: 600;
  }

  .command-desc {
    color: var(--foreground-muted);
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
