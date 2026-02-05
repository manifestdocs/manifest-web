<script lang="ts">
  import Terminal from './Terminal.svelte';
  import { getContext } from 'svelte';

  interface Props {
    cwd?: string;
  }

  interface TerminalTab {
    id: string;
    label: string;
    initialInput?: string;
  }

  interface RightPanelContext {
    readonly activeTab: 'chat' | 'terminal';
    readonly terminalMounted: boolean;
    readonly terminalTabs: TerminalTab[];
    readonly activeTerminalTabId: string | null;
    setActiveTab(tab: 'chat' | 'terminal'): void;
    setTerminalMounted(v: boolean): void;
    toggleTab(): void;
    resetToChat(): void;
    createTerminalTab(): void;
    closeTerminalTab(tabId: string): void;
    selectTerminalTab(tabId: string): void;
    markTerminalAttention(tabId: string): void;
  }

  let { cwd }: Props = $props();

  const rightPanel = getContext<RightPanelContext>('rightPanel');
</script>

<div class="terminal-tabs">
  <div class="terminals">
    {#each rightPanel.terminalTabs as tab (tab.id)}
      <div class="terminal-pane" class:active={rightPanel.activeTerminalTabId === tab.id}>
        <Terminal {cwd} initialInput={tab.initialInput} onBell={() => rightPanel.markTerminalAttention(tab.id)} />
      </div>
    {/each}
  </div>
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
</style>
