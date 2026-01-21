<script lang="ts">
	import logotype from '$lib/assets/logotype.png';

	interface Props {
		onCreateProject: () => void;
	}

	let { onCreateProject }: Props = $props();
</script>

<div class="welcome-screen">
	<div class="welcome-content">
		<img src={logotype} alt="Manifest" class="welcome-logo" />
		<h1 class="welcome-title">Welcome to Manifest</h1>
		<p class="welcome-tagline">
			Living documentation for feature-driven product engineering.
			Track what your system does, not just what you've done.
		</p>
		<button class="btn btn-primary btn-large" onclick={onCreateProject}>
			Create Your First Project
		</button>
		<p class="welcome-hint">
			Projects created via CLI will appear here automatically.
		</p>
	</div>
</div>

<style>
	.welcome-screen {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100vh;
		background: var(--background);
	}

	.welcome-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		max-width: 420px;
		text-align: center;
		padding: 32px;
	}

	.welcome-logo {
		height: 48px;
		width: auto;
		margin-bottom: 24px;
	}

	.welcome-title {
		font-size: 28px;
		font-weight: 600;
		color: var(--foreground);
		margin: 0 0 12px;
	}

	.welcome-tagline {
		font-size: 15px;
		color: var(--foreground-subtle);
		line-height: 1.6;
		margin: 0 0 32px;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 8px 16px;
		font-size: 14px;
		font-weight: 500;
		border-radius: 2px;
		border: 1px solid transparent;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn-large {
		padding: 12px 24px;
		font-size: 15px;
	}

	.btn-primary {
		background: var(--accent-green);
		color: #000;
		border-color: var(--accent-green);
	}

	.btn-primary:hover {
		filter: brightness(1.1);
	}

	.welcome-hint {
		font-size: 13px;
		color: var(--foreground-muted);
		margin-top: 24px;
	}
</style>
