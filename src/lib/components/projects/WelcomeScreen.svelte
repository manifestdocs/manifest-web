<script lang="ts">
	import logotype from '$lib/assets/logotype.png';
	import OnboardingGuide from './OnboardingGuide.svelte';
</script>

<div class="welcome-screen">
	<div class="welcome-header">
		<img src={logotype} alt="Manifest" class="welcome-logo" />
		<p class="welcome-tagline">
			Living documentation for feature-driven product engineering
		</p>
	</div>

	<div class="welcome-content">
		<OnboardingGuide scenario="no-projects" />
	</div>
</div>

<style>
	.welcome-screen {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		background: var(--background);
	}

	.welcome-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 48px 32px 24px;
		border-bottom: 1px solid var(--border-default);
		background: var(--background-subtle);
	}

	.welcome-logo {
		width: 280px;
		height: auto;
		margin-bottom: 8px;
	}

	.welcome-tagline {
		font-size: 14px;
		color: var(--foreground-muted);
		margin: 0;
	}

	.welcome-content {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
