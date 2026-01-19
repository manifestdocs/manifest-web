<script lang="ts">
	interface Props {
		size?: number;
		class?: string;
	}

	let { size = 16, class: className = '' }: Props = $props();
</script>

<!-- 2x2 grid of circles -->
<svg
	width={size}
	height={size}
	viewBox="0 0 16 16"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	class={className}
	aria-label="Feature group"
>
	<circle cx="4.5" cy="4.5" r="2.5" fill="var(--foreground-muted)" />
	<circle cx="11.5" cy="4.5" r="2.5" fill="var(--foreground-muted)" />
	<circle cx="4.5" cy="11.5" r="2.5" fill="var(--foreground-muted)" />
	<circle cx="11.5" cy="11.5" r="2.5" fill="var(--foreground-muted)" />
</svg>
