<script lang="ts">
    import { Admonition, CodeBlock, CopyableCommand } from '$lib/components/docs';
</script>

<h1>Install</h1>

<p>Get Manifest running on your machine.</p>

<h2>1. Install via Homebrew</h2>

<CopyableCommand command="brew install rocket-tycoon/tap/manifest" />

<p>This installs the <code>manifest</code> binary which runs the MCP server for AI agents.</p>

<h2>2. Add the Claude Code plugin</h2>

<p>Using Claude Code? Add the plugin for slash commands and enhanced workflows:</p>

<CopyableCommand command="/install rocket-tycoon/claude-plugins/manifest" />

<Admonition type="note">
    {#snippet children()}
        <p>Not using Claude Code? Configure MCP manually for your agent below.</p>
    {/snippet}
</Admonition>

<h2>Configure other agents</h2>

<p><strong>Claude Code (manual)</strong> — Add to <code>~/.claude/config.json</code>:</p>

<CodeBlock language="json" code={`{
  "mcpServers": {
    "manifest": {
      "command": "manifest-server",
      "args": ["mcp"]
    }
  }
}`} />

<p><strong>Codex (OpenAI)</strong> — Add to <code>~/.codex/config.toml</code>:</p>

<CodeBlock language="toml" code={`[mcp_servers.manifest]
command = "manifest-server"
args = ["mcp"]`} />

<h2>Verify installation</h2>

<p>Check that everything is working:</p>

<CopyableCommand command="manifest --version" />

<p>Then start the server and open the web interface at <a href="http://localhost:17010" target="_blank" rel="noopener">http://localhost:17010</a>:</p>

<CopyableCommand command="manifest serve" />

<h2>Next step</h2>

<p>Continue to <a href="/docs/cli/initialize">Initialize a project</a>.</p>
