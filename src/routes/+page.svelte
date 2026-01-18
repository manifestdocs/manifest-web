<script lang="ts">
	// Root page - shows loading while layout redirects to first project
</script>

<div class="loading-container">
	<div class="spinner"></div>
	<span>Loading projects...</span>
</div>

<style>
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		gap: 16px;
		color: var(--foreground-subtle);
		background: var(--background);
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--border-default);
		border-top-color: var(--accent-blue);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
