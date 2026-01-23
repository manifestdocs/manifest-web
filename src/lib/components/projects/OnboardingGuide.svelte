<script lang="ts">
	import { base } from '$app/paths';

	type Scenario = 'no-projects' | 'no-directory';

	interface Props {
		scenario: Scenario;
		projectName?: string;
	}

	let { scenario, projectName }: Props = $props();

	const isNoProjects = $derived(scenario === 'no-projects');
</script>

<div class="onboarding-guide">
	<div class="guide-icon">
		<svg width="48" height="48" viewBox="0 0 48 48" fill="none">
			<rect x="8" y="8" width="32" height="32" rx="4" stroke="currentColor" stroke-width="2" />
			<path d="M16 20L20 24L16 28" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
			<path d="M24 28H32" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
		</svg>
	</div>

	<h2 class="guide-title">
		{#if isNoProjects}
			Initialize Your First Project
		{:else}
			Link a Working Directory
		{/if}
	</h2>

	<p class="guide-description">
		{#if isNoProjects}
			Manifest projects are initialized from your codebase using a CLI-based coding assistant.
			This allows AI-powered analysis of your code structure and git history.
		{:else}
			<strong>{projectName}</strong> needs a working directory to enable codebase analysis
			and feature discovery.
		{/if}
	</p>

	<div class="steps">
		<div class="step">
			<span class="step-number">1</span>
			<div class="step-content">
				<span class="step-title">Open your project directory</span>
				<span class="step-detail">In Claude Code, Cursor, or another CLI coding assistant</span>
			</div>
		</div>

		<div class="step">
			<span class="step-number">2</span>
			<div class="step-content">
				<span class="step-title">Install the Manifest plugin</span>
				<span class="step-detail">Add the MCP plugin to your assistant's configuration</span>
			</div>
		</div>

		<div class="step">
			<span class="step-number">3</span>
			<div class="step-content">
				<span class="step-title">Ask your assistant</span>
				<code class="step-command">
					{#if isNoProjects}
						"Initialize this project in Manifest"
					{:else}
						"Link this directory to {projectName} in Manifest"
					{/if}
				</code>
			</div>
		</div>
	</div>

	<p class="guide-note">
		This is a one-time setup. Once initialized, your project will appear here automatically.
	</p>

	<a href="{base}/docs/getting-started" class="docs-link">
		<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
			<path d="M6 3H3C2.44772 3 2 3.44772 2 4V13C2 13.5523 2.44772 14 3 14H12C12.5523 14 13 13.5523 13 13V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
			<path d="M7 9L14 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
			<path d="M10 2H14V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>
		View setup documentation
	</a>
</div>

<style>
	.onboarding-guide {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: 48px 32px;
		text-align: center;
		max-width: 480px;
		margin: 0 auto;
	}

	.guide-icon {
		color: var(--foreground-muted);
		margin-bottom: 24px;
	}

	.guide-title {
		font-size: 22px;
		font-weight: 600;
		color: var(--foreground);
		margin: 0 0 12px;
	}

	.guide-description {
		font-size: 14px;
		color: var(--foreground-subtle);
		line-height: 1.6;
		margin: 0 0 32px;
	}

	.guide-description strong {
		color: var(--foreground);
	}

	.steps {
		display: flex;
		flex-direction: column;
		gap: 16px;
		width: 100%;
		text-align: left;
		margin-bottom: 24px;
	}

	.step {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 12px 16px;
		background: var(--background-subtle);
		border: 1px solid var(--border-default);
		border-radius: 6px;
	}

	.step-number {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		font-size: 12px;
		font-weight: 600;
		color: var(--background);
		background: var(--foreground-muted);
		border-radius: 50%;
		flex-shrink: 0;
	}

	.step-content {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.step-title {
		font-size: 14px;
		font-weight: 500;
		color: var(--foreground);
	}

	.step-detail {
		font-size: 13px;
		color: var(--foreground-muted);
	}

	.step-command {
		display: block;
		padding: 8px 12px;
		font-size: 13px;
		font-family: var(--font-mono, monospace);
		color: var(--accent-green);
		background: var(--background);
		border: 1px solid var(--border-default);
		border-radius: 4px;
		margin-top: 4px;
	}

	.guide-note {
		font-size: 13px;
		color: var(--foreground-muted);
		margin: 0 0 20px;
		padding: 10px 16px;
		background: color-mix(in srgb, var(--accent-blue) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent-blue) 30%, transparent);
		border-radius: 6px;
	}

	.docs-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		font-weight: 500;
		color: var(--accent-blue);
		text-decoration: none;
		transition: opacity 0.15s ease;
	}

	.docs-link:hover {
		opacity: 0.8;
	}
</style>
