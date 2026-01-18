<script lang="ts">
	interface Props {
		size?: number;
		class?: string;
	}

	let { size = 16, class: className = '' }: Props = $props();
</script>

<!-- 2x2 grid of squares -->
<svg
	width={size}
	height={size}
	viewBox="0 0 16 16"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	class={className}
	aria-label="Feature group"
>
	<rect x="2" y="2" width="5" height="5" rx="1" fill="var(--foreground-muted)" />
	<rect x="9" y="2" width="5" height="5" rx="1" fill="var(--foreground-muted)" />
	<rect x="2" y="9" width="5" height="5" rx="1" fill="var(--foreground-muted)" />
	<rect x="9" y="9" width="5" height="5" rx="1" fill="var(--foreground-muted)" />
</svg>
