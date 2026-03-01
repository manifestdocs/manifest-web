<script lang="ts">
  import { getAuthApiContext } from '$lib/api/auth-context.js';
  import type { components } from '$lib/api/schema.js';

  const authApi = getAuthApiContext();

  type Proof = components['schemas']['Proof'];

  interface Props {
    featureId: string;
    gitRemote?: string | null;
  }

  let { featureId, gitRemote }: Props = $props();

  let showOutput = $state(false);
  let proof = $state<Proof | null>(null);
  let allProofs = $state<Proof[]>([]);
  let showHistory = $state(false);
  let loadingHistory = $state(false);

  // Load latest proof when featureId changes
  $effect(() => {
    loadLatestProof(featureId);
  });

  async function loadLatestProof(fid: string) {
    try {
      const api = await authApi.getClient();
      const { data } = await api.GET('/features/{id}/proofs', {
        params: { path: { id: fid } },
      });
      if (data && data.length > 0) {
        proof = data[0];
      } else {
        proof = null;
      }
    } catch {
      proof = null;
    }
  }

  const stats = $derived(() => {
    if (!proof?.tests) return null;
    const tests = proof.tests;
    let passed = 0, failed = 0, errored = 0, skipped = 0;
    for (const t of tests) {
      if (t.state === 'passed') passed++;
      else if (t.state === 'failed') failed++;
      else if (t.state === 'errored') errored++;
      else if (t.state === 'skipped') skipped++;
    }
    return { passed, failed, errored, skipped, total: tests.length };
  });

  function stateIcon(state: string): string {
    switch (state) {
      case 'passed': return '\u2713';
      case 'failed': return '\u2717';
      case 'errored': return '!';
      case 'skipped': return '\u2298';
      default: return '?';
    }
  }

  function formatDuration(ms: number | null | undefined): string {
    if (ms == null) return '\u2014';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function formatTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function githubPermalink(path: string, line?: number | null): string | null {
    if (!gitRemote || !proof?.commit_sha) return null;
    let base = gitRemote
      .replace(/\.git$/, '')
      .replace(/^git@github\.com:/, 'https://github.com/')
      .replace(/^ssh:\/\/git@github\.com\//, 'https://github.com/');
    const url = `${base}/blob/${proof.commit_sha}/${path}`;
    return line ? `${url}#L${line}` : url;
  }

  async function loadHistory() {
    if (loadingHistory || allProofs.length > 0) {
      showHistory = !showHistory;
      return;
    }
    loadingHistory = true;
    try {
      const api = await authApi.getClient();
      const { data } = await api.GET('/features/{id}/proofs', {
        params: { path: { id: featureId } },
      });
      if (data) {
        allProofs = data;
      }
    } catch {
      allProofs = [];
    } finally {
      loadingHistory = false;
      showHistory = true;
    }
  }
</script>

<section class="evidence-panel" aria-label="Evidence">
  <header class="panel-header">
    <h2 class="panel-title">Evidence</h2>
    {#if proof}
      {@const s = stats()}
      <div class="header-meta">
        {#if s}
          <span class="stats">
            {#if s.passed > 0}<span class="stat passed">{'\u2713'} {s.passed}</span>{/if}
            {#if s.failed > 0}<span class="stat failed">{'\u2717'} {s.failed}</span>{/if}
            {#if s.errored > 0}<span class="stat errored">! {s.errored}</span>{/if}
            {#if s.skipped > 0}<span class="stat skipped">{'\u2298'} {s.skipped}</span>{/if}
          </span>
        {:else}
          <span class="stat {proof.exit_code === 0 ? 'passed' : 'failed'}">
            {proof.exit_code === 0 ? '\u2713' : '\u2717'} exit {proof.exit_code}
          </span>
        {/if}
        {#if proof.commit_sha}
          <span class="commit-ref">{proof.commit_sha.slice(0, 7)}</span>
        {/if}
        <span class="time-ago">{formatTimeAgo(proof.created_at)}</span>
      </div>
    {/if}
  </header>

  <div class="panel-body">
    {#if !proof}
      <p class="empty-state">No test evidence recorded for this feature.</p>
    {:else}
      <!-- Test results (structured) -->
      {#if proof.tests && proof.tests.length > 0}
        <div class="test-results">
          {#each proof.tests as test}
            <div class="test-row" data-state={test.state}>
              <span class="test-icon" aria-hidden="true">{stateIcon(test.state)}</span>
              <span class="test-name">{test.name}</span>
              {#if test.suite}
                <span class="test-suite">{test.suite}</span>
              {/if}
              <span class="test-duration">{formatDuration(test.duration_ms)}</span>
              {#if test.file}
                {@const link = githubPermalink(test.file, test.line)}
                {#if link}
                  <a class="test-file" href={link} target="_blank" rel="noopener">
                    {test.file}{test.line ? `:${test.line}` : ''}
                  </a>
                {:else}
                  <span class="test-file">{test.file}{test.line ? `:${test.line}` : ''}</span>
                {/if}
              {/if}
            </div>
            {#if test.state === 'failed' && test.message}
              <div class="test-message">{test.message}</div>
            {/if}
          {/each}
        </div>
      {/if}

      <!-- Command -->
      <div class="command-row">
        <code>$ {proof.command}</code>
      </div>

      <!-- Raw output (collapsible) -->
      {#if proof.output}
        <button class="toggle-btn" onclick={() => (showOutput = !showOutput)} type="button">
          {showOutput ? '\u25be Hide' : '\u25b8 Show'} raw output
        </button>
        {#if showOutput}
          <pre class="raw-output">{proof.output}</pre>
        {/if}
      {/if}

      <!-- Evidence files -->
      {#if proof.evidence && proof.evidence.length > 0}
        <div class="evidence-files">
          <div class="evidence-label">Evidence</div>
          {#each proof.evidence as ev}
            {@const link = githubPermalink(ev.path)}
            <div class="evidence-item">
              {#if link}
                <a href={link} target="_blank" rel="noopener">{ev.path} &#8599;</a>
              {:else}
                <span>{ev.path}</span>
              {/if}
              {#if ev.note}
                <span class="evidence-note">&mdash; {ev.note}</span>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <!-- Proof history toggle -->
      <button class="toggle-btn" onclick={loadHistory} type="button">
        {#if loadingHistory}
          Loading...
        {:else}
          {showHistory ? '\u25be Hide' : '\u25b8 Show'} proof history
        {/if}
      </button>
      {#if showHistory && allProofs.length > 1}
        <div class="proof-history">
          {#each allProofs.slice(1) as oldProof}
            <div class="history-entry">
              <span class="history-time">{formatTimeAgo(oldProof.created_at)}</span>
              {#if oldProof.tests}
                {@const p = oldProof.tests.filter(t => t.state === 'passed').length}
                {@const f = oldProof.tests.filter(t => t.state === 'failed').length}
                <span class="history-stats">
                  {#if p > 0}<span class="stat passed">{'\u2713'} {p}</span>{/if}
                  {#if f > 0}<span class="stat failed">{'\u2717'} {f}</span>{/if}
                </span>
              {:else}
                <span class="history-stats">
                  <span class="stat {oldProof.exit_code === 0 ? 'passed' : 'failed'}">
                    exit {oldProof.exit_code}
                  </span>
                </span>
              {/if}
              {#if oldProof.commit_sha}
                <span class="commit-ref">{oldProof.commit_sha.slice(0, 7)}</span>
              {/if}
              <code class="history-cmd">$ {oldProof.command}</code>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</section>

<style>
  /* ── Section header ─────────────────────────────────── */

  .panel-header {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 36px;
    padding: 0 14px;
    background: var(--background-subtle);
    border-bottom: 1px solid var(--border-default);
    flex-shrink: 0;
  }

  .panel-title {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--foreground-muted);
    margin: 0;
    flex-shrink: 0;
  }

  .header-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    margin-left: auto;
  }

  /* ── Stats ──────────────────────────────────────────── */

  .stats {
    display: flex;
    gap: 8px;
  }

  .stat {
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }

  .stat.passed { color: var(--accent-green); }
  .stat.failed, .stat.errored { color: var(--accent-red); }
  .stat.skipped { color: var(--foreground-muted); }

  .commit-ref {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--foreground-muted);
    white-space: nowrap;
  }

  .time-ago {
    font-size: 11px;
    color: var(--foreground-subtle);
    white-space: nowrap;
  }

  /* ── Body ───────────────────────────────────────────── */

  .panel-body {
    padding: 12px 14px 0;
  }

  .empty-state {
    font-size: 13px;
    color: var(--foreground-muted);
    margin: 0;
    padding: 4px 0;
  }

  /* ── Test results ───────────────────────────────────── */

  .test-results {
    margin-bottom: 12px;
  }

  .test-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 0;
    font-size: 13px;
  }

  .test-icon {
    width: 16px;
    text-align: center;
    font-weight: 600;
    flex-shrink: 0;
  }

  .test-row[data-state='passed'] .test-icon { color: var(--accent-green); }
  .test-row[data-state='failed'] .test-icon,
  .test-row[data-state='errored'] .test-icon { color: var(--accent-red); }
  .test-row[data-state='skipped'] .test-icon { color: var(--foreground-muted); }

  .test-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--foreground);
  }

  .test-suite {
    font-size: 11px;
    color: var(--foreground-muted);
  }

  .test-duration {
    font-size: 11px;
    color: var(--foreground-subtle);
    font-family: var(--font-mono, monospace);
    min-width: 40px;
    text-align: right;
  }

  .test-file {
    font-size: 11px;
    color: var(--foreground-muted);
    font-family: var(--font-mono, monospace);
    text-decoration: none;
  }

  a.test-file:hover {
    color: var(--accent-blue);
    text-decoration: underline;
  }

  .test-message {
    padding: 4px 0 4px 24px;
    font-size: 12px;
    color: var(--accent-red);
    font-family: var(--font-mono, monospace);
    white-space: pre-wrap;
  }

  /* ── Command ────────────────────────────────────────── */

  .command-row {
    padding: 8px 0;
    border-top: 1px solid var(--border-muted);
  }

  .command-row code {
    font-size: 12px;
    color: var(--foreground-muted);
    font-family: var(--font-mono, monospace);
  }

  /* ── Toggle buttons ─────────────────────────────────── */

  .toggle-btn {
    display: block;
    background: none;
    border: none;
    padding: 6px 0;
    font-size: 12px;
    color: var(--foreground-muted);
    cursor: pointer;
  }

  .toggle-btn:hover {
    color: var(--accent-blue);
  }

  .toggle-btn:focus-visible {
    outline: 2px solid var(--accent-blue);
    outline-offset: 2px;
  }

  /* ── Raw output ─────────────────────────────────────── */

  .raw-output {
    margin: 0 0 8px;
    padding: 10px 12px;
    background: var(--background-subtle);
    font-size: 11px;
    line-height: 1.5;
    color: var(--foreground-muted);
    overflow-x: auto;
    max-height: 300px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }

  /* ── Evidence files ─────────────────────────────────── */

  .evidence-files {
    padding: 8px 0;
    border-top: 1px solid var(--border-muted);
  }

  .evidence-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--foreground-subtle);
    margin-bottom: 4px;
  }

  .evidence-item {
    padding: 2px 0 2px 0;
    font-size: 12px;
  }

  .evidence-item a {
    color: var(--accent-blue);
    text-decoration: none;
    font-family: var(--font-mono, monospace);
  }

  .evidence-item a:hover {
    text-decoration: underline;
  }

  .evidence-note {
    color: var(--foreground-muted);
    font-style: italic;
  }

  /* ── Proof history ──────────────────────────────────── */

  .proof-history {
    padding: 4px 0;
  }

  .history-entry {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-size: 12px;
    color: var(--foreground-muted);
    border-bottom: 1px solid var(--border-muted);
  }

  .history-entry:last-child {
    border-bottom: none;
  }

  .history-time {
    min-width: 60px;
    font-size: 11px;
    color: var(--foreground-subtle);
  }

  .history-stats {
    display: flex;
    gap: 6px;
  }

  .history-cmd {
    font-size: 11px;
    font-family: var(--font-mono, monospace);
    color: var(--foreground-subtle);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
