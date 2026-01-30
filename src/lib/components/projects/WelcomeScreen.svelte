<script lang="ts">
	import OnboardingGuide from './OnboardingGuide.svelte';
</script>

<div class="welcome-screen">
	<OnboardingGuide scenario="no-projects" />
</div>

<style>
	.welcome-screen {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100vh;
		background: var(--background);
	}
</style>
