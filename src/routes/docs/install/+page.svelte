<script lang="ts">
    const brewCommand = "brew install rocket-tycoon/tap/manifest";
    const claudeCommand = "/install-plugin rocket-tycoon/claude-plugins manifest";

    let copiedBrew = $state(false);
    let copiedClaude = $state(false);

    async function copyBrewCommand() {
        await navigator.clipboard.writeText(brewCommand);
        copiedBrew = true;
        setTimeout(() => (copiedBrew = false), 2000);
    }

    async function copyClaudeCommand() {
        await navigator.clipboard.writeText(claudeCommand);
        copiedClaude = true;
        setTimeout(() => (copiedClaude = false), 2000);
    }
</script>

<div class="docs-page">
    <nav class="docs-nav">
        <a href="/" class="back-link">&larr; Back to Home</a>
    </nav>

    <main class="docs-content">
        <h1>Installation</h1>

        <section class="install-step">
            <h2>1. Install via Homebrew</h2>
            <p>
                Manifest is distributed via Homebrew for macOS and Linux. This installs the <code>manifest</code> binary
                which runs as a local server and provides MCP tools for AI agents.
            </p>
            <div class="code-block">
                <code>{brewCommand}</code>
                <button class="copy-button" onclick={copyBrewCommand} aria-label="Copy command">
                    {#if copiedBrew}
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    {:else}
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                    {/if}
                </button>
            </div>
            <p class="note">
                After installation, run <code>manifest serve</code> to start the server, or use <code>brew services start manifest</code> to run it as a background service.
            </p>
        </section>

        <section class="install-step">
            <h2>2. Add the Claude Code Plugin (Optional)</h2>
            <p>
                If you use <a href="https://claude.ai/code" target="_blank" rel="noopener">Claude Code</a>,
                install the Manifest plugin to give Claude direct access to your feature tree via MCP.
            </p>
            <div class="code-block">
                <code>{claudeCommand}</code>
                <button class="copy-button" onclick={copyClaudeCommand} aria-label="Copy command">
                    {#if copiedClaude}
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    {:else}
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                    {/if}
                </button>
            </div>
            <p class="note">
                The plugin requires the Homebrew installation above. It connects to your local Manifest server
                and provides MCP tools like <code>get_feature</code>, <code>start_feature</code>, and <code>complete_feature</code>.
            </p>
        </section>

        <section class="install-step">
            <h2>Verify Installation</h2>
            <p>Check that everything is working:</p>
            <div class="code-block">
                <code>manifest --version</code>
            </div>
            <p>
                Then start the server and open the web interface at <a href="http://localhost:17010">http://localhost:17010</a>:
            </p>
            <div class="code-block">
                <code>manifest serve</code>
            </div>
        </section>

        <section class="install-step">
            <h2>Next Steps</h2>
            <ul>
                <li><a href="/docs/">Read the documentation</a> to learn about features and workflows</li>
                <li><a href="/app">Open the app</a> to create your first project</li>
            </ul>
        </section>
    </main>
</div>

<style>
    .docs-page {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        background: var(--background);
    }

    .docs-nav {
        padding: 1em 1.5em;
        border-bottom: 1px solid var(--border-muted);
    }

    .back-link {
        color: var(--foreground-muted);
        text-decoration: none;
        font-size: 0.875em;
    }

    .back-link:hover {
        color: var(--foreground);
    }

    .docs-content {
        max-width: 48em;
        margin: 0 auto;
        padding: 2em 1.5em 4em;
    }

    h1 {
        font-size: 2em;
        font-weight: 700;
        margin: 0 0 1.5em;
        color: var(--foreground);
    }

    h2 {
        font-size: 1.25em;
        font-weight: 600;
        margin: 0 0 0.75em;
        color: var(--foreground);
    }

    .install-step {
        margin-bottom: 2.5em;
    }

    .install-step p {
        color: var(--foreground-muted);
        line-height: 1.6;
        margin: 0 0 1em;
    }

    .install-step a {
        color: var(--accent-green);
        text-decoration: none;
    }

    .install-step a:hover {
        text-decoration: underline;
    }

    .install-step ul {
        color: var(--foreground-muted);
        line-height: 1.8;
        padding-left: 1.5em;
        margin: 0;
    }

    .install-step li {
        margin-bottom: 0.5em;
    }

    .code-block {
        display: flex;
        align-items: stretch;
        border: 1px solid var(--border-muted);
        margin-bottom: 1em;
    }

    .code-block code {
        flex: 1;
        display: block;
        padding: 0.875em 1.25em;
        font-family: "IBM Plex Mono", ui-monospace, monospace;
        font-size: 0.875em;
        color: var(--foreground);
        background: var(--background-muted);
        user-select: all;
    }

    .copy-button {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 1em;
        background: var(--background-muted);
        border: none;
        border-left: 1px solid var(--border-muted);
        color: var(--foreground-muted);
        cursor: pointer;
        transition: color 0.15s ease;
    }

    .copy-button:hover {
        color: var(--foreground);
    }

    .note {
        font-size: 0.875em;
        color: var(--foreground-subtle);
    }

    .note code {
        padding: 0.125em 0.375em;
        font-size: 0.9em;
        background: var(--background-muted);
        border: 1px solid var(--border-muted);
    }

    @media (max-width: 48em) {
        .docs-content {
            padding: 1.5em 1em 3em;
        }

        h1 {
            font-size: 1.5em;
        }
    }
</style>
