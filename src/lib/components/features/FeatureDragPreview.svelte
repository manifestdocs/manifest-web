<script lang="ts">
	import type { components } from '$lib/api/schema.js';
	import { GroupIcon, StateIcon } from '$lib/components/icons/index.js';

	type FeatureTreeNode = components['schemas']['FeatureTreeNode'];

	interface Props {
		feature: FeatureTreeNode;
		x: number;
		y: number;
	}

	let { feature, x, y }: Props = $props();

	const hasChildren = $derived(feature.children && feature.children.length > 0);
</script>

<div class="drag-preview" style:left="{x}px" style:top="{y}px">
	<span class="preview-content">
		{#if hasChildren}
			<GroupIcon size={14} />
		{:else}
			<StateIcon state={feature.state} size={14} />
		{/if}
		<span class="preview-title">{feature.title}</span>
	</span>
</div>

<style>
	.drag-preview {
		position: fixed;
		transform: translateY(-50%);
		z-index: 1000;
		pointer-events: none;
	}

	.preview-content {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 12px;
		background: var(--background);
		border: 1px solid var(--border-default);
		border-radius: 4px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		font-size: 13px;
	}

	.preview-title {
		color: var(--foreground);
		white-space: nowrap;
	}
</style>
