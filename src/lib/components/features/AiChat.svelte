<script lang="ts">
	import {
		chatClient,
		generateMessageId,
		createTextContent,
		getTextFromContent,
		type ChatMessage,
		type ContentBlock
	} from '$lib/api/chat.js';
	import MarkdownView from '$lib/components/markdown/MarkdownView.svelte';
	import { RobotIcon } from '$lib/components/icons/index.js';

	interface Props {
		featureId: string | null;
		featureTitle?: string;
		featureDetails?: string;
		projectId?: string;
		/** Whether this is a leaf feature (true) or a feature set with children (false) */
		isLeaf?: boolean;
	}

	let { featureId, featureTitle = '', featureDetails = '', projectId, isLeaf = true }: Props = $props();

	// Chat state
	let messages = $state<ChatMessage[]>([]);
	let inputValue = $state('');
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let messagesContainer: HTMLDivElement | undefined = $state();


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

		// Add user message
		const userMessage: ChatMessage = {
			id: generateMessageId(),
			role: 'user',
			content: createTextContent(userInput),
			createdAt: new Date().toISOString()
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
			isStreaming: true
		};
		messages = [...messages, assistantMessage];

		isLoading = true;

		// Build message history for context
		const messageHistory = messages.slice(0, -1).map((m) => ({
			role: m.role,
			content: getTextFromContent(m.content)
		}));

		await chatClient.sendMessage(
			{
				messages: messageHistory,
				context: {
					featureId: featureId ?? undefined,
					featureTitle: featureTitle || undefined,
					featureDetails: featureDetails || undefined,
					projectId: projectId,
					isLeaf: isLeaf
				},
				stream: true
			},
			{
				onTextDelta: (text) => {
					messages = messages.map((m) => {
						if (m.id === assistantId) {
							const content = [...m.content];
							const lastBlock = content[content.length - 1];

							// If last block is text, append to it; otherwise create new text block
							if (lastBlock?.type === 'text' && lastBlock.text !== undefined) {
								content[content.length - 1] = {
									...lastBlock,
									text: lastBlock.text + text
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
										toolInput: tool.input
									}
								]
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
										? { ...block, toolStatus: status as ContentBlock['toolStatus'] }
										: block
								)
							};
						}
						return m;
					});
				},

				onComplete: () => {
					messages = messages.map((m) =>
						m.id === assistantId ? { ...m, isStreaming: false } : m
					);
					isLoading = false;
				},

				onError: (err) => {
					error = err.message;
					messages = messages.map((m) =>
						m.id === assistantId
							? {
									...m,
									content: createTextContent('Sorry, something went wrong. Please try again.'),
									isStreaming: false
								}
							: m
					);
					isLoading = false;
				}
			}
		);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit(e);
		}
	}

	function clearChat() {
		messages = [];
		error = null;
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
	function getToolSummary(toolName: string, input?: Record<string, unknown>): string {
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
			<div class="empty-chat">
				<div class="empty-icon">
					<RobotIcon size={48} />
				</div>
				<p class="empty-title">Manifest It</p>
				<p class="empty-hint">
					{#if featureTitle}
						Describe what you want to manifest for "{featureTitle}"
					{:else}
						Describe what you want to manifest
					{/if}
				</p>
			</div>
		{:else}
			{#each messages as message (message.id)}
				<div
					class="message"
					class:user={message.role === 'user'}
					class:assistant={message.role === 'assistant'}
				>
					<div class="message-header">
						<span class="message-role">{message.role === 'user' ? 'You' : 'AI'}</span>
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
									<div class="tool-indicator" class:completed={block.toolStatus === 'completed'} class:manifest-tool={isManifest}>
										<span class="tool-icon">
											{#if isManifest}
												<!-- Manifest icon -->
												<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
													<path d="M4 4h4l4 8 4-8h4v16h-4v-9l-4 7-4-7v9H4V4z"/>
												</svg>
											{:else if block.toolStatus === 'completed'}
												<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
													<circle cx="12" cy="12" r="10"></circle>
													<polyline points="16 10 11 15 8 12"></polyline>
												</svg>
											{:else}
												<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
													<circle cx="12" cy="12" r="10"></circle>
													<circle cx="12" cy="12" r="3" fill="currentColor"></circle>
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
						{#if message.isStreaming}
							<span class="streaming-cursor"></span>
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

	<form class="chat-input-form" onsubmit={handleSubmit}>
		<textarea
			class="chat-input"
			placeholder="Manifest something..."
			bind:value={inputValue}
			onkeydown={handleKeydown}
			disabled={isLoading}
			rows={3}
		></textarea>
		<div class="input-toolbar">
			{#if messages.length > 0}
				<button type="button" class="clear-button" onclick={clearChat} disabled={isLoading}>
					Clear
				</button>
			{:else}
				<span></span>
			{/if}
			<button
				type="submit"
				class="send-button"
				disabled={isLoading || !inputValue.trim()}
				aria-label="Send message"
			>
				{#if isLoading}
					<span class="loading-spinner"></span>
				{:else}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
		margin: 0;
		font-size: 12px;
		color: var(--foreground-subtle);
		max-width: 220px;
		line-height: 1.4;
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
		0%, 50% { opacity: 1; }
		51%, 100% { opacity: 0; }
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
		font-size: 13px;
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
		margin-right: 4px;
		margin-bottom: 4px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--foreground-subtle);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.send-button:not(:disabled) {
		color: var(--state-implemented);
		cursor: pointer;
	}

	.send-button:not(:disabled):hover {
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
		to { transform: rotate(360deg); }
	}

	.clear-button {
		padding: 4px 8px;
		font-size: 11px;
		color: var(--foreground-subtle);
		background: transparent;
		border: none;
		cursor: pointer;
	}

	.clear-button:hover:not(:disabled) {
		color: var(--foreground);
		text-decoration: underline;
	}

	.clear-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
