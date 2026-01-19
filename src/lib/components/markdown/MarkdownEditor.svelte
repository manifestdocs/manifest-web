<script lang="ts">
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';

	interface Props {
		value: string;
		placeholder?: string;
		rows?: number;
		onchange?: (value: string) => void;
	}

	let { value = $bindable(), placeholder = '', rows = 20, onchange }: Props = $props();

	let activeTab = $state<'write' | 'preview'>('write');
	let textarea: HTMLTextAreaElement | undefined = $state();

	// Configure marked for GitHub-flavored markdown
	marked.setOptions({
		gfm: true,
		breaks: true
	});

	const renderedHtml = $derived.by(() => {
		if (!value) return '';
		const html = marked.parse(value, { async: false }) as string;
		return DOMPurify.sanitize(html);
	});

	function insertAtCursor(before: string, after: string = '') {
		if (!textarea) return;

		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const selectedText = value.substring(start, end);

		const newText = before + selectedText + after;
		const newValue = value.substring(0, start) + newText + value.substring(end);

		value = newValue;
		onchange?.(newValue);

		// Restore cursor position after the inserted text
		requestAnimationFrame(() => {
			if (!textarea) return;
			const newCursorPos = start + before.length + selectedText.length + after.length;
			textarea.focus();
			textarea.setSelectionRange(
				start + before.length,
				start + before.length + selectedText.length
			);
		});
	}

	function insertLinePrefix(prefix: string) {
		if (!textarea) return;

		const start = textarea.selectionStart;
		const lineStart = value.lastIndexOf('\n', start - 1) + 1;

		const newValue = value.substring(0, lineStart) + prefix + value.substring(lineStart);
		value = newValue;
		onchange?.(newValue);

		requestAnimationFrame(() => {
			if (!textarea) return;
			textarea.focus();
			textarea.setSelectionRange(start + prefix.length, start + prefix.length);
		});
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		value = target.value;
		onchange?.(target.value);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Tab') {
			e.preventDefault();
			insertAtCursor('  ');
		}
		// Ctrl/Cmd + B for bold
		if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
			e.preventDefault();
			insertAtCursor('**', '**');
		}
		// Ctrl/Cmd + I for italic
		if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
			e.preventDefault();
			insertAtCursor('_', '_');
		}
		// Ctrl/Cmd + K for link
		if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
			e.preventDefault();
			insertAtCursor('[', '](url)');
		}
	}
</script>

<div class="markdown-editor">
	<div class="editor-header">
		<div class="tabs">
			<button
				type="button"
				class="tab"
				class:active={activeTab === 'write'}
				onclick={() => (activeTab = 'write')}
			>
				Write
			</button>
			<button
				type="button"
				class="tab"
				class:active={activeTab === 'preview'}
				onclick={() => (activeTab = 'preview')}
			>
				Preview
			</button>
		</div>

		{#if activeTab === 'write'}
			<div class="toolbar">
				<button
					type="button"
					class="toolbar-btn"
					title="Heading (Ctrl+Shift+H)"
					onclick={() => insertLinePrefix('## ')}
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
						<path d="M3.75 2a.75.75 0 0 1 .75.75V7h7V2.75a.75.75 0 0 1 1.5 0v10.5a.75.75 0 0 1-1.5 0V8.5h-7v4.75a.75.75 0 0 1-1.5 0V2.75A.75.75 0 0 1 3.75 2Z"/>
					</svg>
				</button>
				<button
					type="button"
					class="toolbar-btn"
					title="Bold (Ctrl+B)"
					onclick={() => insertAtCursor('**', '**')}
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
						<path d="M4 2.5h4.5a2.5 2.5 0 0 1 0 5H4V2.5Z"/>
						<path d="M4 7.5h5.5a2.5 2.5 0 0 1 0 5H4V7.5Z"/>
					</svg>
				</button>
				<button
					type="button"
					class="toolbar-btn"
					title="Italic (Ctrl+I)"
					onclick={() => insertAtCursor('_', '_')}
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
						<path d="M6 2.75A.75.75 0 0 1 6.75 2h6.5a.75.75 0 0 1 0 1.5h-2.505l-3.858 9H9.25a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5h2.505l3.858-9H6.75A.75.75 0 0 1 6 2.75Z"/>
					</svg>
				</button>

				<div class="toolbar-divider"></div>

				<button
					type="button"
					class="toolbar-btn"
					title="Quote"
					onclick={() => insertLinePrefix('> ')}
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
						<path d="M1.75 2.5a.75.75 0 0 0 0 1.5h10.5a.75.75 0 0 0 0-1.5H1.75Zm4 5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Zm0 5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5ZM2.5 7.75v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 1.5 0Z"/>
					</svg>
				</button>
				<button
					type="button"
					class="toolbar-btn"
					title="Code"
					onclick={() => insertAtCursor('`', '`')}
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
						<path d="m11.28 3.22 4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.94 8l-3.72-3.72a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215Zm-6.56 0a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L2.06 8l3.72 3.72a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L.47 8.53a.75.75 0 0 1 0-1.06Z"/>
					</svg>
				</button>
				<button
					type="button"
					class="toolbar-btn"
					title="Link (Ctrl+K)"
					onclick={() => insertAtCursor('[', '](url)')}
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
						<path d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z"/>
					</svg>
				</button>

				<div class="toolbar-divider"></div>

				<button
					type="button"
					class="toolbar-btn"
					title="Bulleted list"
					onclick={() => insertLinePrefix('- ')}
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
						<path d="M5.75 2.5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5ZM2 14a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-6a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM2 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/>
					</svg>
				</button>
				<button
					type="button"
					class="toolbar-btn"
					title="Numbered list"
					onclick={() => insertLinePrefix('1. ')}
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
						<path d="M5 3.25a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 5 3.25Zm0 5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 5 8.25Zm0 5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1-.75-.75ZM.924 10.32l.003-.004a.851.851 0 0 1 .144-.153A.66.66 0 0 1 1.5 10c.195 0 .306.068.374.146a.57.57 0 0 1 .128.376c0 .453-.269.682-.8 1.078l-.035.025C.692 11.98 0 12.495 0 13.5a.75.75 0 0 0 .75.75h2.5a.75.75 0 0 0 0-1.5H1.5v-.003c.195-.149.383-.299.54-.449.617-.592.936-1.175.936-1.94 0-.634-.24-1.123-.647-1.474-.397-.344-.896-.509-1.469-.509-.415 0-.77.09-1.04.261a1.897 1.897 0 0 0-.552.491c-.212.291-.153.67.135.885.288.215.67.157.885-.135.023-.032.07-.086.12-.117.04-.026.139-.078.382-.078ZM1 2.75A.75.75 0 0 1 1.75 2h.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-3.75H1.75A.75.75 0 0 1 1 2.75Z"/>
					</svg>
				</button>
				<button
					type="button"
					class="toolbar-btn"
					title="Task list"
					onclick={() => insertLinePrefix('- [ ] ')}
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
						<rect x="1.5" y="2" width="3" height="3" rx="0.5"/>
						<path d="M6.5 3.5h8"/>
						<rect x="1.5" y="6.5" width="3" height="3" rx="0.5"/>
						<path d="M6.5 8h8"/>
						<path d="M2 12l1 1 2-2"/>
						<path d="M6.5 12.5h8"/>
					</svg>
				</button>
			</div>
		{/if}
	</div>

	<div class="editor-body">
		{#if activeTab === 'write'}
			<textarea
				bind:this={textarea}
				class="editor-textarea font-mono"
				{placeholder}
				{rows}
				value={value}
				oninput={handleInput}
				onkeydown={handleKeydown}
			></textarea>
		{:else}
			<div class="editor-preview prose">
				{#if value}
					{@html renderedHtml}
				{:else}
					<p class="preview-empty">Nothing to preview</p>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.markdown-editor {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border-default);
		border-radius: 6px;
		background: var(--background-subtle);
		overflow: hidden;
		transition: border-color 0.15s ease;
	}

	.markdown-editor:focus-within {
		border-color: var(--accent-blue);
	}

	.editor-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		background: var(--background-muted);
		border-bottom: 1px solid var(--border-default);
		gap: 12px;
	}

	.tabs {
		display: flex;
		gap: 4px;
	}

	.tab {
		padding: 6px 12px;
		font-size: 13px;
		font-weight: 500;
		color: var(--foreground-muted);
		background: transparent;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.tab:hover {
		color: var(--foreground);
		background: var(--background-emphasis);
	}

	.tab.active {
		color: var(--foreground);
		background: var(--background-subtle);
	}

	.toolbar {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.toolbar-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		color: var(--foreground-muted);
		background: transparent;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.toolbar-btn:hover {
		color: var(--foreground);
		background: var(--background-emphasis);
	}

	.toolbar-divider {
		width: 1px;
		height: 16px;
		margin: 0 6px;
		background: var(--border-default);
	}

	.editor-body {
		flex: 1;
		min-height: 0;
	}

	.editor-textarea {
		width: 100%;
		height: 100%;
		min-height: 300px;
		padding: 16px;
		font-size: 14px;
		line-height: 1.6;
		color: var(--foreground);
		background: transparent;
		border: none;
		resize: vertical;
	}

	.editor-textarea:focus {
		outline: none;
	}

	.editor-textarea::placeholder {
		color: var(--foreground-subtle);
	}

	.editor-preview {
		padding: 16px;
		min-height: 300px;
		overflow-y: auto;
	}

	.preview-empty {
		color: var(--foreground-subtle);
		font-style: italic;
	}
</style>
