<script lang="ts">
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';

	interface Props {
		content: string;
		class?: string;
	}

	let { content, class: className = '' }: Props = $props();

	// Configure marked for GitHub-flavored markdown
	marked.setOptions({
		gfm: true,
		breaks: true
	});

	const renderedHtml = $derived.by(() => {
		if (!content) return '';
		const html = marked.parse(content, { async: false }) as string;
		return DOMPurify.sanitize(html);
	});
</script>

<div class="markdown-view prose {className}">
	{@html renderedHtml}
</div>

<style>
	.markdown-view {
		font-size: 16px;
		line-height: 1.7;
		color: var(--foreground);
	}

	.markdown-view :global(ul),
	.markdown-view :global(ol) {
		margin: 1em 0 1.5em 0;
		padding-left: 2.5em;
	}

	.markdown-view :global(ul) {
		list-style-type: disc;
	}

	.markdown-view :global(ol) {
		list-style-type: decimal;
	}

	.markdown-view :global(li) {
		margin: 0.25em 0;
	}

	.markdown-view :global(li > ul),
	.markdown-view :global(li > ol) {
		margin: 0.25em 0;
	}
</style>
