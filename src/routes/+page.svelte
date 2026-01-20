<script lang="ts">
    import logotype from "$lib/assets/logotype.png";
    import illustrationSpecRip from "$lib/assets/illustration-spec-rip.png";
    import illustrationRunningRobot from "$lib/assets/illustration-running-robot.png";
    import illustrationCowboy from "$lib/assets/illustration-cowboy.png";

    const brewCommand = "brew install rocket-tycoon/tap/manifest";
    const claudeCommand = "/install rocket-tycoon/claude-plugins/manifest";

    let copiedBrew = $state(false);
    let copiedClaude = $state(false);
    let highlightInstall = $state(false);

    function scrollToInstall() {
        const topSection = document.getElementById("top");
        if (topSection) {
            topSection.scrollIntoView({ behavior: "smooth" });
            setTimeout(() => {
                highlightInstall = true;
                setTimeout(() => (highlightInstall = false), 2000);
            }, 500);
        }
    }

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

<div class="marketing-page">
    <main>
        <section id="top" class="hero">
            <img src={logotype} alt="Manifest" class="hero-logotype" />
            <h1>
                Living documentation for feature-driven <span class="nowrap"
                    >product engineering</span
                >
            </h1>
            <p class="hero-subheadline">
                No vibes. No stale specs. Just up-to-date documentation for
                humans and AI agents.
            </p>
        </section>

        <section class="install-section">
            <div class="install-options" class:highlight={highlightInstall}>
                <div class="install-option">
                    <span class="install-label">Install via brew</span>
                    <div class="install-wrapper">
                        <code class="install-command">{brewCommand}</code>
                        <button
                            class="copy-button"
                            onclick={copyBrewCommand}
                            aria-label="Copy brew command"
                        >
                            {#if copiedBrew}
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            {:else}
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <rect
                                        width="14"
                                        height="14"
                                        x="8"
                                        y="8"
                                        rx="2"
                                        ry="2"
                                    />
                                    <path
                                        d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"
                                    />
                                </svg>
                            {/if}
                        </button>
                    </div>
                </div>
                <div class="install-option">
                    <span class="install-label">or in Claude Code...</span>
                    <div class="install-wrapper">
                        <code class="install-command">{claudeCommand}</code>
                        <button
                            class="copy-button"
                            onclick={copyClaudeCommand}
                            aria-label="Copy Claude command"
                        >
                            {#if copiedClaude}
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            {:else}
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <rect
                                        width="14"
                                        height="14"
                                        x="8"
                                        y="8"
                                        rx="2"
                                        ry="2"
                                    />
                                    <path
                                        d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"
                                    />
                                </svg>
                            {/if}
                        </button>
                    </div>
                </div>
            </div>
        </section>

        <section id="pain-points" class="pain-points">
            <h2 class="section-title">
                Traditional PM tools aren't designed for AI agents
            </h2>
            <div class="pain-cards">
                <div class="pain-card">
                    <div class="pain-card-illustration-container">
                        <img
                            src={illustrationSpecRip}
                            alt="RIP Spec document"
                            class="pain-card-illustration pain-card-illustration--spec"
                        />
                    </div>
                    <h3>Specs die on day one</h3>
                    <p>
                        Your PRD was accurate for about 24 hours. Now it's just
                        polluting your repo or buried in Confluence.
                    </p>
                </div>
                <div class="pain-card">
                    <div class="pain-card-illustration-container">
                        <img
                            src={illustrationRunningRobot}
                            alt="Robot running fast"
                            class="pain-card-illustration pain-card-illustration--robot"
                        />
                    </div>
                    <h3>Changes happen too fast</h3>
                    <p>
                        Agents ship changes faster than you can update Jira.
                        Your tracking system is already behind.
                    </p>
                </div>
                <div class="pain-card">
                    <div class="pain-card-illustration-container">
                        <img
                            src={illustrationCowboy}
                            alt="Cowboy coding"
                            class="pain-card-illustration pain-card-illustration--cowboy"
                        />
                    </div>
                    <h3>Lost agentic cowboys</h3>
                    <p>
                        Agents at full gallop get lost. No trail of where
                        they've been, no map for where they're going.
                    </p>
                </div>
            </div>
        </section>

        <section class="solution">
            <h2 class="section-title">
                A better way to track coding agents' work
            </h2>
            <div class="value-props">
                <div class="value-prop">
                    <h3>
                        <span class="value-icon">
                            <!-- Implemented state icon (filled circle with checkmark) -->
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 16 16"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <circle
                                    cx="8"
                                    cy="8"
                                    r="7"
                                    fill="var(--state-implemented)"
                                />
                                <path
                                    d="M4.5 8L7 10.5L11.5 5.5"
                                    stroke="var(--background)"
                                    stroke-width="1.5"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                />
                            </svg>
                        </span>
                        Features, not tickets
                    </h3>
                    <p>
                        Features describe what your system <strong
                            >can do</strong
                        >—living capabilities that evolve, not work items to
                        close and forget.
                    </p>
                </div>
                <div class="value-prop">
                    <h3>
                        <span class="value-icon">
                            <!-- Clock icon -->
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="var(--accent-green)"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                        </span>
                        Product history linked to code
                    </h3>
                    <p>
                        Every feature has a history: who worked on it, what was
                        decided, how it evolved. Like <code>git log</code> for your
                        product.
                    </p>
                </div>
                <div class="value-prop">
                    <h3>
                        <span class="value-icon">
                            <!-- Lucide bot icon (Claude orange) -->
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#E07A3E"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <path d="M12 8V4H8" />
                                <rect
                                    width="16"
                                    height="12"
                                    x="4"
                                    y="8"
                                    rx="2"
                                />
                                <path d="M2 14h2" />
                                <path d="M20 14h2" />
                                <path d="M15 13v2" />
                                <path d="M9 13v2" />
                            </svg>
                        </span>
                        Built for AI agents
                    </h3>
                    <p>
                        MCP server integration means both CLI and IDE based
                        agents can read and update features directly.
                    </p>
                </div>
            </div>
        </section>

        <section class="comparison">
            <h2 class="section-title">Traditional tools vs Manifest</h2>
            <div class="comparison-table-wrapper">
                <table class="comparison-table">
                    <thead>
                        <tr>
                            <th>Traditional PM tools</th>
                            <th>Manifest</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Work items (close and forget)</td>
                            <td
                                ><span class="check">✓</span> Features (living documentation)</td
                            >
                        </tr>
                        <tr>
                            <td>Tickets accumulate as noise</td>
                            <td
                                ><span class="check">✓</span> Feature tree stays current</td
                            >
                        </tr>
                        <tr>
                            <td>"What did we ship?"</td>
                            <td
                                ><span class="check">✓</span> "What can our product
                                do?"</td
                            >
                        </tr>
                        <tr>
                            <td>Spec docs rot instantly</td>
                            <td
                                ><span class="check">✓</span> Features evolve with
                                code</td
                            >
                        </tr>
                        <tr>
                            <td>Manual tracking</td>
                            <td
                                ><span class="check">✓</span> AI agent integration</td
                            >
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>

        <section class="cta-section">
            <button class="cta-button" onclick={scrollToInstall}
                >Install Now</button
            >
        </section>
    </main>

    <footer class="site-footer">
        <div class="footer-content">
            <p>&copy; 2026 Rocket Tycoon</p>
        </div>
    </footer>
</div>

<style>
    .marketing-page {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
    }

    .nowrap {
        white-space: nowrap;
    }

    /* Sections */
    main {
        flex: 1;
        display: flex;
        flex-direction: column;
    }

    section {
        padding: 50px 24px;
    }

    .section-title {
        font-size: 24px;
        font-weight: 600;
        text-align: center;
        margin: 0 0 24px;
        color: var(--foreground);
    }

    .pain-points .section-title {
        margin-bottom: 12px;
    }

    /* Hero */
    .hero {
        text-align: center;
        padding: 22px 24px 17px;
        max-width: 1100px;
        margin: 0 auto;
    }

    /* Install Section */
    .install-section {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 10px 24px 16px;
    }

    .hero-logotype {
        width: 324px;
        height: auto;
        margin: 0 auto 12px;
        display: block;
    }

    .hero h1 {
        font-size: 32px;
        font-weight: 700;
        line-height: 1.2;
        margin: 0 0 8px;
        color: var(--foreground);
    }

    .hero-subheadline {
        font-size: 16px;
        line-height: 1.5;
        color: var(--foreground-muted);
        margin: 0 0 8px;
    }

    .hero-subheadline strong {
        color: var(--foreground);
    }

    .install-wrapper {
        display: inline-flex;
        align-items: stretch;
        border: 1px solid var(--border-muted);
    }

    .install-command {
        display: inline-block;
        padding: 10px 20px;
        font-family: "IBM Plex Mono", ui-monospace, monospace;
        font-size: 14px;
        color: var(--foreground);
        background: var(--background);
        user-select: all;
        cursor: text;
    }

    .copy-button {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 12px;
        background: var(--background);
        border: none;
        border-left: 1px solid var(--border-muted);
        color: var(--foreground-muted);
        cursor: pointer;
        transition: color 0.15s ease;
    }

    .copy-button:hover {
        color: var(--foreground);
    }

    .install-options {
        display: flex;
        align-items: stretch;
        justify-content: center;
        gap: 24px;
        flex-wrap: wrap;
        padding: 16px;
        border: 2px solid transparent;
        transition: border-color 0.3s ease;
    }

    .install-options.highlight {
        border-color: var(--accent-green);
    }

    .install-option {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
    }

    .install-label {
        color: var(--foreground-muted);
        font-size: 14px;
    }

    /* Pain Points */
    .pain-points {
        background: var(--background);
        padding-top: 44px;
        padding-bottom: 25px;
    }

    .pain-cards {
        max-width: 1000px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0;
    }

    .pain-card {
        background: var(--background);
        padding: 24px;
        text-align: center;
        position: relative;
    }

    .pain-card:not(:last-child)::after {
        content: "";
        position: absolute;
        right: 0;
        top: 20px;
        bottom: 0;
        width: 1px;
        background: var(--border-muted);
    }

    .pain-card h3 {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 8px;
        color: var(--foreground);
    }

    .pain-card p {
        font-size: 14px;
        line-height: 1.5;
        color: var(--foreground-muted);
        margin: 0;
    }

    .pain-card-illustration-container {
        height: 140px;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        margin-bottom: 10px;
    }

    .pain-card-illustration {
        max-width: 160px;
        height: auto;
        display: block;
    }

    .pain-card-illustration--spec {
        max-width: 190px;
        transform: translateY(15px);
    }

    .pain-card-illustration--robot {
        max-width: 190px;
        transform: translateY(8px);
    }

    .pain-card-illustration--cowboy {
        max-width: 175px;
        transform: translateY(-4px);
    }

    /* Solution / Value Props */
    .solution {
        background: var(--background);
        padding-top: 25px;
        padding-bottom: 52px;
    }

    .value-props {
        max-width: 1000px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 32px;
    }

    .value-prop {
        text-align: center;
    }

    .value-prop h3 {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 12px;
        color: var(--foreground);
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }

    .value-prop h3 .value-icon {
        display: flex;
        align-items: center;
    }

    .value-prop p {
        font-size: 15px;
        line-height: 1.6;
        color: var(--foreground-muted);
        margin: 0;
    }

    .value-prop p strong {
        color: var(--foreground);
    }

    .value-prop p code {
        padding: 2px 6px;
        font-size: 13px;
        border: 1px solid var(--border-muted);
        white-space: nowrap;
    }

    /* Comparison */
    .comparison {
        background: var(--background);
        padding-top: 25px;
        padding-bottom: 52px;
    }

    .comparison-table-wrapper {
        max-width: 1000px;
        margin: 0 auto;
        overflow-x: auto;
    }

    .comparison-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 15px;
    }

    .comparison-table th,
    .comparison-table td {
        padding: 12px 20px;
        text-align: left;
        border: 1px solid var(--border-default);
    }

    .comparison-table th {
        background: var(--background);
        font-weight: 600;
        color: var(--foreground);
    }

    .comparison-table td {
        background: var(--background);
        color: var(--foreground-muted);
    }

    .comparison-table td:last-child {
        color: var(--accent-green);
    }

    .comparison-table .check {
        font-weight: 700;
        margin-right: 4px;
    }

    /* CTA Section */
    .cta-section {
        text-align: center;
        background: var(--background);
        padding: 24px 24px 64px;
    }

    .cta-button {
        font-size: 16px;
        font-weight: 500;
        color: var(--accent-green);
        background: transparent;
        border: 2px solid var(--accent-green);
        padding: 12px 32px;
        cursor: pointer;
        transition:
            background 0.15s ease,
            color 0.15s ease;
    }

    .cta-button:hover {
        background: var(--accent-green);
        color: var(--background);
    }

    /* Footer */
    .site-footer {
        background: var(--background);
        border-top: 1px solid var(--border-muted);
        padding: 24px;
    }

    .footer-content {
        max-width: 1000px;
        margin: 0 auto;
        text-align: center;
    }

    .footer-content p {
        margin: 0;
        font-size: 14px;
        color: var(--foreground-subtle);
    }

    /* Responsive */
    @media (max-width: 768px) {
        section {
            padding: 32px 16px;
        }

        .hero {
            padding: 16px 16px 32px;
        }

        .hero-logotype {
            width: 280px;
        }

        .hero h1 {
            font-size: 24px;
        }

        .hero-subheadline {
            font-size: 15px;
        }

        .section-title {
            font-size: 22px;
            margin-bottom: 24px;
        }

        .pain-cards {
            grid-template-columns: 1fr;
        }

        .pain-card {
            padding: 20px;
            border-right: none;
            border-bottom: 1px solid var(--border-muted);
        }

        .pain-card:last-child {
            border-bottom: none;
        }

        .value-prop {
            padding: 20px;
        }
    }
</style>
