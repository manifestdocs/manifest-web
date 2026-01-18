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
		font-size: 14px;
		line-height: 1.7;
		color: var(--foreground);
	}
</style>
