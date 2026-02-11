<script lang="ts">
  import Terminal from './Terminal.svelte';
  import { getRightPanelContext, getProjectDataContext } from '$lib/contexts/types.js';

  interface Props {
    cwd?: string;
  }

  let { cwd }: Props = $props();

  const rightPanel = getRightPanelContext();

  // Track send functions per terminal tab
  let sendFns = $state<Map<string, (text: string) => void>>(new Map());

  function handleReady(tabId: string, send: (text: string) => void) {
    sendFns = new Map(sendFns).set(tabId, send);
  }

  function sendToActiveTerminal(text: string) {
    const activeId = rightPanel.activeTerminalTabId;
    if (!activeId) return;
    const send = sendFns.get(activeId);
    send?.(text + '\r');
  }

  // Active tab's feature info
  const activeTab = $derived(
    rightPanel.terminalTabs.find((t) => t.id === rightPanel.activeTerminalTabId),
  );
  const activeFeatureId = $derived(activeTab?.featureId);

  // Context chips based on feature state
  const projectData = getProjectDataContext();

  // Find the feature for the active terminal tab
  const linkedFeature = $derived.by(() => {
    if (!activeFeatureId) return null;
    // Check if the selected feature matches
    if (projectData.selectedFeature?.id === activeFeatureId) {
      return projectData.selectedFeature;
    }
    return null;
  });

  interface ContextChip {
    label: string;
    prompt: (title: string) => string;
  }

  const chipsByState: Record<string, ContextChip[]> = {
    proposed: [
      { label: 'Breakdown', prompt: (t) => `Break down the feature "${t}" into 3-5 sub-features and create them using the manifest plan tool` },
      { label: 'Enhance', prompt: (t) => `Enhance the specification for feature "${t}" — flesh out the details using update_feature with desired_details` },
      { label: 'AC', prompt: (t) => `Write acceptance criteria for feature "${t}" in Given/When/Then format, save using update_feature with desired_details` },
      { label: 'Implement', prompt: (t) => `Start implementing feature "${t}" — read the spec first with get_feature, then build it` },
    ],
    in_progress: [],
    implemented: [
      { label: 'Verify', prompt: (t) => `Verify the implementation of feature "${t}" — run tests and check the spec` },
      { label: 'Update', prompt: (t) => `Update the spec for feature "${t}" to reflect the current implementation using update_feature` },
    ],
  };

  const activeChips = $derived(
    linkedFeature ? (chipsByState[linkedFeature.state] ?? []) : [],
  );
</script>

<div class="terminal-tabs">
  <div class="terminals">
    {#each rightPanel.terminalTabs as tab (tab.id)}
      <div class="terminal-pane" class:active={rightPanel.activeTerminalTabId === tab.id}>
        <Terminal
          {cwd}
          initialInput={tab.initialInput}
          isActive={rightPanel.activeTerminalTabId === tab.id}
          onBell={() => rightPanel.markTerminalAttention(tab.id)}
          onIdle={() => rightPanel.markTerminalAttention(tab.id)}
          onReady={(send) => handleReady(tab.id, send)}
        />
      </div>
    {/each}
  </div>
  {#if activeChips.length > 0 && linkedFeature}
    <div class="context-bar">
      {#each activeChips as chip}
        <button
          class="context-chip"
          type="button"
          onclick={() => sendToActiveTerminal(chip.prompt(linkedFeature.title))}
        >
          {chip.label}
        </button>
      {/each}
      <span class="context-feature">{linkedFeature.title}</span>
    </div>
  {/if}
</div>

<style>
  .terminal-tabs {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .terminals {
    flex: 1;
    min-height: 0;
    position: relative;
  }

  .terminal-pane {
    display: none;
    height: 100%;
    width: 100%;
  }

  .terminal-pane.active {
    display: flex;
  }

  .context-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-top: 1px solid var(--border-default, #30363d);
    background: var(--background-subtle, #161b22);
    flex-shrink: 0;
    overflow-x: auto;
  }

  .context-chip {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    font-size: 11px;
    font-weight: 500;
    color: var(--foreground-muted, #8b949e);
    background: var(--background-muted, #21262d);
    border: 1px solid var(--border-muted, #30363d);
    border-radius: 12px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.1s ease;
  }

  .context-chip:hover {
    color: var(--foreground, #e6edf3);
    background: rgba(88, 166, 255, 0.15);
    border-color: rgba(88, 166, 255, 0.4);
  }

  .context-chip:active {
    background: rgba(88, 166, 255, 0.25);
  }

  .context-feature {
    margin-left: auto;
    font-size: 11px;
    color: var(--foreground-subtle, #6e7681);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }
</style>
