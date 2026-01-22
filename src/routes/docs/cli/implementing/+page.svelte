<script lang="ts">
    import { Admonition, CodeBlock } from '$lib/components/docs';
</script>

<h1>Implementing Features</h1>

<p>How agents pull and implement work from the feature tree.</p>

<p>With your feature tree planned, agents can start implementing. This page explains what you tell the agent vs. what the agent handles automatically.</p>

<h2>The work cycle</h2>

<CodeBlock code={`┌──────────┐    ┌─────────┐    ┌───────────┐    ┌──────────┐
│ DISCOVER │───▶│  START  │───▶│ IMPLEMENT │───▶│ COMPLETE │
└──────────┘    └─────────┘    └───────────┘    └──────────┘
      │                                               │
      └───────────────────────────────────────────────┘
                         (repeat)`} />

<h2>Discover</h2>

<p><strong>You say:</strong></p>

<CodeBlock code="What should I work on next?" />

<p><strong>Agent handles:</strong></p>

<ul>
    <li>Calls <code>get_next_feature</code> to find the highest priority work</li>
    <li>Prioritizes: "now" version → priority order → backlog</li>
    <li>Returns the feature spec with acceptance criteria</li>
</ul>

<p><strong>You can also ask:</strong></p>

<CodeBlock code={`What features are proposed?
Show me the details for OAuth`} />

<Admonition type="skill" title="Claude Code slash command /manifest:next">
    {#snippet children()}
        <p>Use <code>/manifest:next</code> to quickly see the highest-priority feature ready for work.</p>
    {/snippet}
</Admonition>

<Admonition type="skill" title="Claude Code slash command /manifest:feature [query]">
    {#snippet children()}
        <p>Use <code>/manifest:feature OAuth</code> to search for and display feature details.</p>
    {/snippet}
</Admonition>

<h2>Start</h2>

<p><strong>You say:</strong></p>

<CodeBlock code="Implement OAuth" />

<p><strong>Agent handles:</strong></p>

<ul>
    <li>Calls <code>start_feature</code> to claim the work</li>
    <li>Transitions state: <code>proposed</code> (◇) → <code>in_progress</code> (○)</li>
    <li>Other agents see this feature is taken</li>
</ul>

<Admonition type="skill" title="Claude Code slash command /manifest:start [feature]">
    {#snippet children()}
        <p>Use <code>/manifest:start OAuth</code> to begin work, or <code>/manifest:start</code> without arguments to start the next priority feature.</p>
    {/snippet}
</Admonition>

<h2>Implement</h2>

<p><strong>You do:</strong> Review code, answer questions, guide decisions.</p>

<p><strong>Agent handles:</strong> Writing code, running tests, making commits. The agent uses the feature spec as its guide.</p>

<h2>Complete</h2>

<p><strong>Agent handles automatically</strong> when implementation is done:</p>

<ul>
    <li>Calls <code>complete_feature</code> with a summary of what was done</li>
    <li>Creates a history log entry with timestamp</li>
    <li>Links commits from the session</li>
    <li>Transitions state: <code>in_progress</code> (○) → <code>implemented</code> (●)</li>
</ul>

<p>The history entry becomes a permanent record:</p>

<CodeBlock code={`Feature: OAuth Integration (●)

History:
  2024-03-20 - Implemented Google OAuth with token refresh
               - Added OAuth config and providers
               - Built token storage with encryption
               Commits: abc123, def456`} />

<Admonition type="skill" title="Claude Code slash command /manifest:complete">
    {#snippet children()}
        <p>Use <code>/manifest:complete</code> to explicitly complete the current in-progress feature. The agent will gather commits and prompt for a summary.</p>
    {/snippet}
</Admonition>

<h2>Quick reference</h2>

<table>
    <thead>
        <tr>
            <th>You say</th>
            <th>Agent handles</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>"What should I work on next?"</td>
            <td>Finds highest priority feature</td>
        </tr>
        <tr>
            <td>"Implement OAuth"</td>
            <td>Claims feature, writes code, completes</td>
        </tr>
    </tbody>
</table>

<h2>Next step</h2>

<p>Continue to <a href="/docs/cli/versions">Product versions</a>.</p>
