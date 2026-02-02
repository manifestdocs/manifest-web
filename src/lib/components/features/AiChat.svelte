<script lang="ts">
  import {
    chatClient,
    generateMessageId,
    createTextContent,
    getTextFromContent,
    type ChatMessage,
    type ContentBlock,
    type MessageRole,
  } from '$lib/api/chat.js';
  import { API_BASE_URL } from '$lib/api/client.js';
  import MarkdownView from '$lib/components/markdown/MarkdownView.svelte';
  import {
    RobotIcon,
    StateIcon,
    BookIcon,
    GroupIcon,
  } from '$lib/components/icons/index.js';
  import type { components } from '$lib/api/schema.js';
  import {
    matchCommands,
    parseCommand,
    buildPromptWithCommand,
    type CommandContext,
    type CommandMatch,
  } from '@manifest/svelte/commands';
  import type { VersionSummary } from '@manifest/svelte/commands';
  import CommandAutocomplete from './CommandAutocomplete.svelte';

  interface Props {
    featureId: string | null;
    featureTitle?: string;
    featureDetails?: string;
    featureState?: components['schemas']['FeatureState'];
    projectId?: string;
    /** Whether this is a leaf feature (true) or a feature set with children (false) */
    isLeaf?: boolean;
    /** Whether this is the project root feature */
    isProjectRoot?: boolean;
    /** Version summaries for plan view context */
    versions?: VersionSummary[];
    /** Name of the next version to ship */
    nextVersionName?: string;
    /** Number of unassigned backlog features */
    unassignedFeatureCount?: number;
    /** Whether we're in the version/plan view */
    isVersionView?: boolean;
    /** Format for acceptance criteria: 'checkbox' (default) or 'gherkin' */
    acFormat?: 'checkbox' | 'gherkin';
  }

  let {
    featureId,
    featureTitle = '',
    featureDetails = '',
    featureState,
    projectId,
    isLeaf = true,
    isProjectRoot = false,
    versions,
    nextVersionName,
    unassignedFeatureCount,
    isVersionView = false,
    acFormat,
  }: Props = $props();

  // Chat state
  let messages = $state<ChatMessage[]>([]);
  let inputValue = $state('');
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let messagesContainer: HTMLDivElement | undefined = $state();
  let sessionId = $state<string | null>(null);

  // Agent indicator
  let activeAgent = $state('claude');

  // Command menu state
  let commandMenuDismissed = $state(false);
  let selectedCommandIndex = $state(0);

  let commandContext = $derived<CommandContext>({
    featureId,
    featureTitle,
    featureDetails,
    projectId,
    isLeaf,
    isProjectRoot,
    versions,
    nextVersionName,
    unassignedFeatureCount,
    isVersionView,
    acFormat,
  });

  let commandMatches = $derived.by(() => {
    const val = inputValue;
    if (val.startsWith('/') && !val.includes(' ') && !commandMenuDismissed) {
      return matchCommands(val.slice(1), commandContext);
    }
    return [];
  });

  let showCommandMenu = $derived(commandMatches.length > 0);

  let waitingForInput = $derived.by(() => {
    if (isLoading || messages.length === 0) return false;
    const last = messages[messages.length - 1];
    return last.role === 'assistant' && !last.isStreaming;
  });

  function selectCommand(match: CommandMatch) {
    inputValue = `/${match.command.name} `;
    commandMenuDismissed = true;
  }

  function dismissCommandMenu() {
    commandMenuDismissed = true;
  }

  function handleInput() {
    // Reset dismiss flag and selection when input changes
    commandMenuDismissed = false;
    selectedCommandIndex = 0;
  }

  // Load active agent from server settings
  $effect(() => {
    fetch(`${API_BASE_URL}/settings`)
      .then((res) => res.json())
      .then((data) => {
        activeAgent = data.default_agent ?? 'claude';
      })
      .catch(() => {
        // Silently fall back to claude
      });
  });

  // Reset session when feature changes
  $effect(() => {
    featureId; // track dependency
    sessionId = null;
    messages = [];
  });

  // Auto-scroll to bottom when messages change
  $effect(() => {
    if (messages.length > 0 && messagesContainer) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      });
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();

    const userInput = inputValue.trim();
    if (!userInput || isLoading) return;

    error = null;
    commandMenuDismissed = true;

    // Check for slash command
    const parsed = parseCommand(userInput);
    const commandPrompt = buildPromptWithCommand(parsed, commandContext);

    // Display text: show the full input for regular messages, or the command for slash commands
    const displayText = userInput;
    const actualUserMessage = commandPrompt?.userMessage ?? userInput;

    // Add user message
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: createTextContent(displayText),
      createdAt: new Date().toISOString(),
    };
    messages = [...messages, userMessage];
    inputValue = '';

    // Add placeholder assistant message
    const assistantId = generateMessageId();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: [],
      createdAt: new Date().toISOString(),
      isStreaming: true,
    };
    messages = [...messages, assistantMessage];

    isLoading = true;

    // Build message history for context
    const messageHistory: Array<{ role: MessageRole; content: string }> = [];

    if (commandPrompt) {
      messageHistory.push({
        role: 'system',
        content: commandPrompt.systemPrompt,
      });
    }

    if (sessionId) {
      // Resuming: Claude has prior context, just send the new message
      messageHistory.push({ role: 'user', content: actualUserMessage });
    } else {
      // First turn: send full history
      for (const m of messages.slice(0, -1)) {
        messageHistory.push({
          role: m.role,
          content: getTextFromContent(m.content),
        });
      }

      // Replace the last user message content with the actual user message (args or default)
      if (commandPrompt && messageHistory.length > 0) {
        messageHistory[messageHistory.length - 1] = {
          role: 'user',
          content: actualUserMessage,
        };
      }
    }

    // Build version summary string for the server
    let versionSummary: string | undefined;
    if (isVersionView && versions && versions.length > 0) {
      const lines = versions.map((v) => {
        const pct =
          v.featureCount > 0
            ? Math.round((v.implementedCount / v.featureCount) * 100)
            : 0;
        return `${v.name}: ${v.implementedCount}/${v.featureCount} implemented (${pct}%)`;
      });
      if (unassignedFeatureCount && unassignedFeatureCount > 0) {
        lines.push(`Backlog: ${unassignedFeatureCount} unassigned`);
      }
      versionSummary = lines.join('\n');
    }

    await chatClient.sendMessage(
      {
        messages: messageHistory,
        context: {
          featureId: featureId ?? undefined,
          featureTitle: featureTitle || undefined,
          featureDetails: featureDetails || undefined,
          projectId: projectId,
          isLeaf: isLeaf,
          versionSummary,
          isVersionView: isVersionView || undefined,
        },
        sessionId: sessionId ?? undefined,
        stream: true,
      },
      {
        onSession: (sid) => {
          sessionId = sid;
        },

        onTextDelta: (text) => {
          messages = messages.map((m) => {
            if (m.id === assistantId) {
              const content = [...m.content];
              const lastBlock = content[content.length - 1];

              // If last block is text, append to it; otherwise create new text block
              if (lastBlock?.type === 'text' && lastBlock.text !== undefined) {
                content[content.length - 1] = {
                  ...lastBlock,
                  text: lastBlock.text + text,
                };
              } else {
                content.push({ type: 'text', text });
              }

              return { ...m, content };
            }
            return m;
          });
        },

        onToolCall: (tool) => {
          messages = messages.map((m) => {
            if (m.id === assistantId) {
              return {
                ...m,
                content: [
                  ...m.content,
                  {
                    type: 'tool_use' as const,
                    toolId: tool.id,
                    toolName: tool.name,
                    toolStatus: 'running' as const,
                    toolInput: tool.input,
                  },
                ],
              };
            }
            return m;
          });
        },

        onToolUpdate: (toolId, status) => {
          messages = messages.map((m) => {
            if (m.id === assistantId) {
              return {
                ...m,
                content: m.content.map((block) =>
                  block.type === 'tool_use' && block.toolId === toolId
                    ? {
                        ...block,
                        toolStatus: status as ContentBlock['toolStatus'],
                      }
                    : block,
                ),
              };
            }
            return m;
          });
        },

        onComplete: () => {
          messages = messages.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m,
          );
          isLoading = false;
        },

        onError: (err) => {
          error = err.message;
          messages = messages.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: createTextContent(
                    'Sorry, something went wrong. Please try again.',
                  ),
                  isStreaming: false,
                }
              : m,
          );
          isLoading = false;
        },
      },
    );
  }

  function handleKeydown(e: KeyboardEvent) {
    // Command menu navigation takes priority
    if (showCommandMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedCommandIndex =
          (selectedCommandIndex + 1) % commandMatches.length;
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedCommandIndex =
          (selectedCommandIndex - 1 + commandMatches.length) %
          commandMatches.length;
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectCommand(commandMatches[selectedCommandIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        dismissCommandMenu();
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function clearChat() {
    messages = [];
    error = null;
    sessionId = null;
  }

  /** Check if tool is a Manifest MCP tool */
  function isManifestTool(toolName: string): boolean {
    return toolName.startsWith('mcp__manifest__');
  }

  /** Transform Manifest MCP tool names to friendly display names */
  function getToolDisplayName(toolName: string): string {
    if (!isManifestTool(toolName)) return toolName;

    // Extract the action part: mcp__manifest__find_features -> find_features
    const action = toolName.replace('mcp__manifest__', '');

    // Convert snake_case to Title Case
    return action
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /** Extract a human-readable summary from tool input */
  function getToolSummary(
    toolName: string,
    input?: Record<string, unknown>,
  ): string {
    if (!input) return '';

    // Handle Manifest MCP tools
    if (isManifestTool(toolName)) {
      const action = toolName.replace('mcp__manifest__', '');
      switch (action) {
        case 'get_feature':
        case 'start_feature':
        case 'complete_feature':
          if (input.feature_id) {
            const id = String(input.feature_id);
            return id.slice(0, 8) + '...';
          }
          break;
        case 'find_features':
          if (input.query) return `"${input.query}"`;
          if (input.state) return String(input.state);
          break;
        case 'update_feature':
          if (input.title) return `"${input.title}"`;
          if (input.feature_id) {
            const id = String(input.feature_id);
            return id.slice(0, 8) + '...';
          }
          break;
        case 'render_feature_tree':
        case 'list_versions':
        case 'get_next_feature':
          // No summary needed for these
          return '';
        case 'plan':
          if (input.features && Array.isArray(input.features)) {
            return `${input.features.length} features`;
          }
          break;
      }
      return '';
    }

    switch (toolName) {
      case 'Read':
        if (input.file_path) {
          const path = String(input.file_path);
          // Show just the filename or last part of path
          const parts = path.split('/');
          return parts[parts.length - 1] || path;
        }
        break;
      case 'Bash':
        if (input.command) {
          const cmd = String(input.command);
          // Truncate long commands
          return cmd.length > 50 ? cmd.slice(0, 47) + '...' : cmd;
        }
        break;
      case 'Grep':
        if (input.pattern) {
          return `"${input.pattern}"`;
        }
        break;
      case 'Glob':
        if (input.pattern) {
          return String(input.pattern);
        }
        break;
      case 'Edit':
      case 'Write':
        if (input.file_path) {
          const path = String(input.file_path);
          const parts = path.split('/');
          return parts[parts.length - 1] || path;
        }
        break;
      case 'WebFetch':
        if (input.url) {
          try {
            const url = new URL(String(input.url));
            return url.hostname + url.pathname.slice(0, 20);
          } catch {
            return String(input.url).slice(0, 30);
          }
        }
        break;
      case 'WebSearch':
        if (input.query) {
          return `"${input.query}"`;
        }
        break;
    }

    return '';
  }
</script>

<div class="ai-chat">
  <div class="chat-messages" bind:this={messagesContainer}>
    {#if messages.length === 0}
      <div class="empty-chat" class:menu-open={showCommandMenu}>
        <div class="empty-icon">
          <RobotIcon size={48} />
        </div>
        <p class="empty-title">Manifest It</p>
        <div class="empty-hint">
          {#if isVersionView}
            <p class="hint-overview">
              Plan and manage releases across versions.
            </p>
            <ul class="hint-commands">
              <li><kbd>/balance</kbd> redistribute features across versions</li>
              <li><kbd>/prioritize</kbd> prioritize backlog features</li>
              <li><kbd>/readiness</kbd> assess version readiness to ship</li>
              <li><kbd>/release-notes</kbd> draft release notes</li>
              <li><kbd>/scope</kbd> recommend features for the next version</li>
            </ul>
            <p class="hint-tab">
              Type <kbd>/</kbd> then <kbd>Tab</kbd> to complete
            </p>
          {:else if isProjectRoot && isLeaf && featureDetails}
            <p class="hint-overview">
              This project has a spec but no features yet. Decompose it into a
              feature tree.
            </p>
            <ul class="hint-commands">
              <li>
                <kbd>/plan</kbd> decompose spec into a feature tree
              </li>
            </ul>
            <p class="hint-tab">
              Type <kbd>/</kbd> then <kbd>Tab</kbd> to complete
            </p>
          {:else if isProjectRoot}
            <p class="hint-overview">
              Ask questions or give instructions about the project.
            </p>
            <ul class="hint-commands">
              <li><kbd>/context</kbd> add shared context for children</li>
              <li>
                <kbd>/organize</kbd> restructure top-level features and priorities
              </li>
            </ul>
            <p class="hint-tab">
              Type <kbd>/</kbd> then <kbd>Tab</kbd> to complete
            </p>
          {:else if !isLeaf}
            <p class="hint-overview">
              Ask questions or give instructions about this feature group.
            </p>
            <ul class="hint-commands">
              <li><kbd>/context</kbd> add shared context for children</li>
              <li>
                <kbd>/organize</kbd> restructure child features and priorities
              </li>
            </ul>
            <p class="hint-tab">
              Type <kbd>/</kbd> then <kbd>Tab</kbd> to complete
            </p>
          {:else if featureTitle}
            <p class="hint-overview">
              Ask questions or give instructions about this feature.
            </p>
            <ul class="hint-commands">
              <li><kbd>/ac</kbd> write acceptance criteria</li>
              <li><kbd>/breakdown</kbd> split into sub-features</li>
              <li><kbd>/enhance</kbd> expand user story into detailed spec</li>
            </ul>
            <p class="hint-tab">
              Type <kbd>/</kbd> then <kbd>Tab</kbd> to complete
            </p>
          {:else}
            <p class="hint-overview">Select a feature to get started.</p>
          {/if}
        </div>
      </div>
    {:else}
      {#each messages as message (message.id)}
        <div
          class="message"
          class:user={message.role === 'user'}
          class:assistant={message.role === 'assistant'}
        >
          <div class="message-header">
            <span class="message-role"
              >{message.role === 'user' ? 'You' : 'AI'}</span
            >
          </div>
          <div class="message-content">
            {#if message.role === 'user'}
              {getTextFromContent(message.content)}
            {:else}
              {#each message.content as block, i (i)}
                {#if block.type === 'text' && block.text}
                  <MarkdownView content={block.text} class="chat-markdown" />
                {:else if block.type === 'tool_use'}
                  {@const toolName = block.toolName || ''}
                  {@const isManifest = isManifestTool(toolName)}
                  {@const displayName = getToolDisplayName(toolName)}
                  {@const summary = getToolSummary(toolName, block.toolInput)}
                  <div
                    class="tool-indicator"
                    class:completed={block.toolStatus === 'completed'}
                    class:manifest-tool={isManifest}
                  >
                    <span class="tool-icon">
                      {#if isManifest}
                        <!-- Manifest icon -->
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M4 4h4l4 8 4-8h4v16h-4v-9l-4 7-4-7v9H4V4z" />
                        </svg>
                      {:else if block.toolStatus === 'completed'}
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="16 10 11 15 8 12"></polyline>
                        </svg>
                      {:else}
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <circle cx="12" cy="12" r="10"></circle>
                          <circle cx="12" cy="12" r="3" fill="currentColor"
                          ></circle>
                        </svg>
                      {/if}
                    </span>
                    <span class="tool-name">{displayName}</span>
                    {#if summary}
                      <span class="tool-summary">{summary}</span>
                    {/if}
                  </div>
                {/if}
              {/each}
            {/if}
            {#if message.isStreaming && message.content.length === 0}
              <div class="thinking-indicator">
                <span class="thinking-dot"></span>
                <span class="thinking-dot"></span>
                <span class="thinking-dot"></span>
                <span class="thinking-text">Thinking</span>
              </div>
            {:else if message.isStreaming}
              <span class="cursor-glow-wrapper">
                <span class="streaming-cursor"></span>
                <span class="cursor-sparkle"></span>
                <span class="cursor-sparkle"></span>
                <span class="cursor-sparkle"></span>
                <span class="cursor-sparkle"></span>
              </span>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>

  {#if error}
    <div class="error-banner">
      {error}
    </div>
  {/if}

  {#if waitingForInput}
    <div class="turn-indicator">
      <span class="turn-line"></span>
      <span class="turn-label">Your turn</span>
      <span class="turn-line"></span>
    </div>
  {/if}

  <form class="chat-input-form" class:awaiting-input={waitingForInput} onsubmit={handleSubmit}>
    {#if showCommandMenu}
      <CommandAutocomplete
        query={inputValue.slice(1)}
        matches={commandMatches}
        selectedIndex={selectedCommandIndex}
        onSelect={selectCommand}
      />
    {/if}
    <textarea
      class="chat-input"
      placeholder="Manifest something..."
      bind:value={inputValue}
      oninput={handleInput}
      onkeydown={handleKeydown}
      disabled={isLoading}
      rows={3}
    ></textarea>
    <div class="input-toolbar">
      <div class="toolbar-left">
        {#if isVersionView && nextVersionName}
          <span class="feature-label" title="Plan: {nextVersionName}">
            {nextVersionName}
          </span>
        {:else if !isVersionView && featureTitle}
          <span class="feature-label" title={featureTitle}>
            {#if isProjectRoot}
              <span style="position: relative; top: 1px;"
                ><BookIcon size={12} /></span
              >
            {:else if !isLeaf}
              <GroupIcon size={14} />
            {:else if featureState}
              <StateIcon state={featureState} size={12} />
            {/if}
            {featureTitle}
          </span>
        {/if}
        <span class="agent-label"
          >{activeAgent.charAt(0).toUpperCase() + activeAgent.slice(1)}</span
        >
      </div>
      <button
        type="submit"
        class="send-button"
        disabled={isLoading || !inputValue.trim()}
        aria-label="Send message"
      >
        {#if isLoading}
          <span class="loading-spinner"></span>
        {:else}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m22 2-7 20-4-9-9-4 20-7Z"></path>
            <path d="M22 2 11 13"></path>
          </svg>
        {/if}
      </button>
    </div>
  </form>
</div>

<style>
  .ai-chat {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .chat-messages {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 12px 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .empty-chat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    padding: 20px;
    gap: 8px;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .empty-chat.menu-open {
    transform: translateY(-40px);
  }

  .empty-icon {
    color: var(--foreground-subtle);
    opacity: 0.5;
  }

  .empty-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--foreground);
  }

  .empty-hint {
    font-size: 12px;
    color: var(--foreground-subtle);
    max-width: 340px;
    text-align: left;
  }

  .hint-overview {
    margin: 0;
    line-height: 1.4;
  }

  .hint-commands {
    margin: 18px 0 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .hint-commands li {
    line-height: 1.4;
  }

  .hint-tab {
    margin: 18px 0 0;
    font-size: 11px;
    color: var(--foreground-subtle);
    opacity: 0.7;
  }

  .hint-commands kbd {
    margin-right: 4px;
  }

  .empty-hint kbd {
    padding: 1px 5px;
    font-size: 11px;
    font-family: var(--font-mono, monospace);
    background: var(--background-subtle);
    border: 1px solid var(--border-default);
    border-radius: 3px;
    color: var(--foreground-muted);
  }

  .message {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 0;
    border-bottom: 1px solid var(--border-default);
  }

  .message:last-child {
    border-bottom: none;
  }

  .message.user {
    /* Full width, no special styling */
  }

  .message.assistant {
    /* Full width, no special styling */
  }

  .message-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .message-role {
    font-size: 12px;
    font-weight: 600;
    color: var(--foreground);
  }

  .message-content {
    font-size: 13px;
    line-height: 1.5;
    color: var(--foreground);
    word-break: break-word;
  }

  .message.user .message-content {
    white-space: pre-wrap;
  }

  .message-content :global(.chat-markdown) {
    font-size: 13px;
    line-height: 1.5;
  }

  .message-content :global(.chat-markdown h1),
  .message-content :global(.chat-markdown h2),
  .message-content :global(.chat-markdown h3) {
    margin-top: 0.75em;
    margin-bottom: 0.5em;
    font-size: 1em;
    font-weight: 600;
  }

  .message-content :global(.chat-markdown h1) {
    font-size: 1.1em;
  }

  .message-content :global(.chat-markdown p) {
    margin: 0.5em 0;
  }

  .message-content :global(.chat-markdown ul),
  .message-content :global(.chat-markdown ol) {
    margin: 0.5em 0;
    padding-left: 1.5em;
  }

  .message-content :global(.chat-markdown li) {
    margin: 0.25em 0;
  }

  .message-content :global(.chat-markdown code) {
    font-size: 0.9em;
    padding: 0.1em 0.3em;
    background: var(--background-muted);
    border-radius: 3px;
  }

  .message-content :global(.chat-markdown pre) {
    margin: 0.5em 0;
    padding: 0.5em;
    background: var(--background-muted);
    border-radius: 4px;
    overflow-x: auto;
  }

  .message-content :global(.chat-markdown pre code) {
    padding: 0;
    background: none;
  }

  .streaming-cursor {
    display: inline-block;
    width: 6px;
    height: 14px;
    background: var(--accent-blue);
    margin-left: 2px;
    animation: blink 1s infinite;
    vertical-align: text-bottom;
    border-radius: 1px;
  }

  @keyframes blink {
    0%,
    50% {
      opacity: 1;
    }
    51%,
    100% {
      opacity: 0;
    }
  }

  .tool-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 0;
    font-size: 12px;
    color: var(--foreground-muted);
  }

  .tool-indicator.completed {
    color: var(--foreground-subtle);
  }

  .tool-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    color: var(--foreground-subtle);
  }

  .tool-indicator.completed .tool-icon {
    color: var(--accent-green);
  }

  /* Manifest-specific tool styling */
  .tool-indicator.manifest-tool {
    color: #a78bfa;
  }

  .tool-indicator.manifest-tool .tool-icon {
    color: #a78bfa;
  }

  .tool-indicator.manifest-tool.completed {
    color: #7c3aed;
  }

  .tool-indicator.manifest-tool.completed .tool-icon {
    color: #7c3aed;
  }

  .tool-name {
    font-weight: 500;
    font-size: 12px;
  }

  .tool-summary {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--foreground-subtle);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }

  .error-banner {
    padding: 8px 12px;
    margin-bottom: 8px;
    font-size: 12px;
    color: #f85149;
    background: rgba(248, 81, 73, 0.1);
    border: 1px solid rgba(248, 81, 73, 0.3);
    border-radius: 6px;
  }

  .chat-input-form {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 8px 16px 16px;
    margin: 0 -16px -16px;
    background: var(--background-subtle);
    min-height: 120px;
  }

  .chat-input {
    width: 100%;
    flex: 1;
    padding: 0 0 32px 8px;
    font-size: 14px;
    font-family: inherit;
    line-height: 1.5;
    background: transparent;
    border: none;
    color: var(--foreground);
    resize: none;
  }

  .chat-input:focus {
    outline: none;
  }

  .chat-input:disabled {
    opacity: 0.6;
  }

  .chat-input::placeholder {
    color: var(--foreground-muted);
  }

  .input-toolbar {
    position: absolute;
    bottom: 12px;
    left: 16px;
    right: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .send-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    margin-right: 10px;
    margin-bottom: 12px;
    padding: 0;
    background: transparent;
    border: 1px solid var(--foreground-subtle);
    border-radius: 4px;
    color: var(--foreground-subtle);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .send-button:not(:disabled) {
    color: var(--foreground-subtle);
    border-color: var(--foreground-subtle);
    cursor: pointer;
  }

  .send-button:not(:disabled):hover {
    color: var(--state-implemented);
    border-color: var(--state-implemented);
    background: rgba(156, 220, 254, 0.15);
  }

  .send-button:not(:disabled):active {
    background: rgba(156, 220, 254, 0.25);
    transform: scale(0.95);
  }

  .send-button:disabled {
    cursor: default;
    opacity: 0.4;
  }

  .loading-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--border-default);
    border-top-color: var(--state-implemented);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .feature-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--foreground-muted);
    background: var(--background);
    padding: 2px 8px;
    margin-left: 8px;
    margin-bottom: 11px;
    border-radius: 4px;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .agent-label {
    font-size: 11px;
    color: var(--foreground-subtle);
    margin-left: 4px;
    margin-bottom: 11px;
  }



  /* Thinking indicator (before first content) */
  .thinking-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 0;
  }

  .thinking-dot {
    width: 5px;
    height: 5px;
    background: var(--accent-blue);
    transform: rotate(45deg);
    animation: thinkingPulse 1.4s ease-in-out infinite;
  }

  .thinking-dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .thinking-dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  .thinking-text {
    font-size: 12px;
    color: var(--foreground-subtle);
    margin-left: 4px;
    animation: thinkingFade 1.4s ease-in-out infinite;
  }

  @keyframes thinkingPulse {
    0%,
    80%,
    100% {
      opacity: 0.3;
      transform: rotate(45deg) scale(0.8);
    }
    40% {
      opacity: 1;
      transform: rotate(45deg) scale(1.2);
    }
  }

  @keyframes thinkingFade {
    0%,
    80%,
    100% {
      opacity: 0.5;
    }
    40% {
      opacity: 1;
    }
  }

  /* "Your turn" divider */
  .turn-indicator {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 16px;
    animation: turnFadeIn 0.4s ease-out;
  }

  .turn-line {
    flex: 1;
    height: 1px;
    background: var(--border-default);
  }

  .turn-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--foreground-subtle);
    white-space: nowrap;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  @keyframes turnFadeIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .chat-input-form.awaiting-input {
    box-shadow: inset 0 1px 0 0 rgba(88, 166, 255, 0.25);
  }

  /* Cursor glow wrapper (light show) */
  .cursor-glow-wrapper {
    position: relative;
    display: inline-block;
    vertical-align: text-bottom;
  }

  /* Pulsing halo behind cursor */
  .cursor-glow-wrapper::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 24px;
    height: 24px;
    transform: translate(-50%, -50%);
    background: radial-gradient(
      circle,
      rgba(88, 166, 255, 0.4) 0%,
      rgba(88, 166, 255, 0.1) 50%,
      transparent 70%
    );
    border-radius: 50%;
    animation: cursorGlow 2s ease-in-out infinite;
    pointer-events: none;
  }

  /* Diamond sparkle particles emitting rightward from cursor */
  .cursor-sparkle {
    position: absolute;
    top: 50%;
    left: 3px;
    width: 4px;
    height: 4px;
    background: var(--accent-blue);
    transform: rotate(45deg);
    opacity: 0;
    animation: sparkleFloat 2s ease-out infinite;
    pointer-events: none;
  }

  .cursor-sparkle:nth-child(3) {
    animation-delay: 0.5s;
    animation-duration: 1.8s;
    top: 35%;
  }

  .cursor-sparkle:nth-child(4) {
    animation-delay: 1.0s;
    animation-duration: 2.2s;
    top: 60%;
    background: rgba(163, 113, 247, 0.9);
  }

  .cursor-sparkle:nth-child(5) {
    animation-delay: 1.5s;
    animation-duration: 1.6s;
    top: 45%;
    width: 3px;
    height: 3px;
  }

  @keyframes cursorGlow {
    0%,
    100% {
      opacity: 0.5;
      transform: translate(-50%, -50%) scale(1);
    }
    50% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.3);
    }
  }

  @keyframes sparkleFloat {
    0% {
      opacity: 0;
      transform: rotate(45deg) translate(0, -50%) scale(1);
    }
    12% {
      opacity: 0.9;
      transform: rotate(45deg) translate(6px, -50%) scale(1);
    }
    60% {
      opacity: 0.4;
      transform: rotate(45deg) translate(30px, -50%) scale(0.6);
    }
    100% {
      opacity: 0;
      transform: rotate(45deg) translate(50px, -50%) scale(0.2);
    }
  }
</style>
