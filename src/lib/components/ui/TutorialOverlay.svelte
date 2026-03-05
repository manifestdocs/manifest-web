<script lang="ts">
  import {
    StateIcon,
    SettingsIcon,
    PlusIcon,
    BellIcon,
  } from '$lib/components/icons/index.js';

  export type TutorialMode = 'project' | 'portfolio';

  type IconId = 'settings' | 'plus' | 'bell' | 'view-toggle';

  interface Detail {
    label: string;
    text: string;
    icon?: IconId;
  }

  interface Step {
    selector: string;
    cardPosition: 'right' | 'below';
    title: string;
    description: string;
    details: Detail[];
    /** Show the state icon legend after details */
    showStateLegend?: boolean;
  }

  const projectSteps: Step[] = [
    {
      selector: 'aside.left-panel',
      cardPosition: 'right',
      title: 'Feature Tree',
      description:
        "Your project's capabilities live here, organized in a hierarchy you control.",
      showStateLegend: true,
      details: [
        {
          label: 'Drag & drop',
          text: 'Rearrange features by dragging them into new positions or groups.',
        },
        {
          label: 'Right-click',
          text: 'Add child features, wrap in a group, archive, or delete.',
        },
        {
          label: 'State icons',
          text: 'Each feature shows its state — see the legend below.',
        },
      ],
    },
    {
      selector: 'nav.tab-strip',
      cardPosition: 'below',
      title: 'Edit, Plan, Activity',
      description: 'Three tabs for different workflows:',
      details: [
        {
          label: 'Edit',
          text: 'Read and write feature specs — the default view for day-to-day work.',
        },
        {
          label: 'Plan',
          text: 'Organize features into versioned releases and track progress toward milestones.',
        },
        {
          label: 'Activity',
          text: 'See a timeline of recent changes — completions, edits, and agent work.',
        },
      ],
    },
    {
      selector: 'div.project-controls',
      cardPosition: 'below',
      title: 'Project Controls',
      description: 'Quick access to project-level actions:',
      details: [
        {
          label: 'Project selector',
          text: 'Switch between projects in your workspace.',
        },
        {
          label: 'Settings',
          text: 'Configure project directories, instructions, and key prefix.',
          icon: 'settings',
        },
        {
          label: 'New project',
          text: 'Create a new project from scratch or from an existing codebase.',
          icon: 'plus',
        },
        {
          label: 'Notifications',
          text: 'Get browser alerts when AI agents complete features.',
          icon: 'bell',
        },
        {
          label: 'View toggle',
          text: 'Switch between the single-project view and the portfolio overview.',
          icon: 'view-toggle',
        },
      ],
    },
  ];

  const portfolioSteps: Step[] = [
    {
      selector: '.lanes',
      cardPosition: 'right',
      title: 'Project Lanes',
      description: 'Each lane shows one project and its features at a glance.',
      showStateLegend: true,
      details: [
        {
          label: 'Click a project name',
          text: 'Open it in the full project view to edit specs and plan versions.',
        },
        {
          label: 'Click a feature',
          text: 'Jump straight to that feature in the project view.',
        },
        {
          label: 'State icons',
          text: 'Each feature shows its state — see the legend below.',
        },
      ],
    },
    {
      selector: 'div.project-controls',
      cardPosition: 'below',
      title: 'Portfolio Controls',
      description: 'Manage your workspace from here:',
      details: [
        {
          label: 'New project',
          text: 'Create a new project from scratch or from an existing codebase.',
          icon: 'plus',
        },
        {
          label: 'Notifications',
          text: 'Get browser alerts when AI agents complete features.',
          icon: 'bell',
        },
        {
          label: 'View toggle',
          text: 'Switch to the single-project view to focus on one project at a time.',
          icon: 'view-toggle',
        },
      ],
    },
  ];

  let { mode = 'project', onComplete }: { mode?: TutorialMode; onComplete: () => void } = $props();

  const steps = $derived(mode === 'portfolio' ? portfolioSteps : projectSteps);

  let currentStep = $state(0);
  let targetRect = $state<DOMRect | null>(null);

  function measureTarget() {
    const el = document.querySelector(steps[currentStep].selector);
    targetRect = el ? el.getBoundingClientRect() : null;
  }

  $effect(() => {
    currentStep;
    measureTarget();
  });

  $effect(() => {
    function onResize() {
      measureTarget();
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });

  $effect(() => {
    function onKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        dismiss();
      } else if (e.key === 'ArrowRight') {
        next();
      } else if (e.key === 'ArrowLeft') {
        back();
      }
    }
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  });

  function next() {
    if (currentStep < steps.length - 1) {
      currentStep++;
    } else {
      dismiss();
    }
  }

  function back() {
    if (currentStep > 0) {
      currentStep--;
    }
  }

  function dismiss() {
    onComplete();
  }

  const pad = 6;
  const cardGap = 12;
  const cardWidth = 340;
  const viewportMargin = 12;

  const clipPath = $derived.by(() => {
    if (!targetRect) return 'none';
    const r = targetRect;
    const x1 = r.left - pad;
    const y1 = r.top - pad;
    const x2 = r.right + pad;
    const y2 = r.bottom + pad;
    return `polygon(
      0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
      ${x1}px ${y1}px, ${x1}px ${y2}px, ${x2}px ${y2}px, ${x2}px ${y1}px, ${x1}px ${y1}px
    )`;
  });

  const cardStyle = $derived.by(() => {
    if (!targetRect) return '';
    const step = steps[currentStep];
    const r = targetRect;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x: number;
    let y: number;

    if (step.cardPosition === 'right') {
      x = r.right + pad + cardGap;
      y = r.top;
    } else {
      x = r.left;
      y = r.bottom + pad + cardGap;
    }

    // Clamp horizontal: keep card fully within viewport
    x = Math.max(viewportMargin, Math.min(x, vw - cardWidth - viewportMargin));

    // Clamp vertical: use the card's rendered height via a rough estimate
    // (title + desc + details + footer ≈ 60px + details * 28px + 48px)
    const estimatedHeight = 108 + steps[currentStep].details.length * 28;
    y = Math.max(viewportMargin, Math.min(y, vh - estimatedHeight - viewportMargin));

    return `left: ${x}px; top: ${y}px;`;
  });

  const highlightStyle = $derived.by(() => {
    if (!targetRect) return '';
    const r = targetRect;
    return `left: ${r.left - pad}px; top: ${r.top - pad}px; width: ${r.width + pad * 2}px; height: ${r.height + pad * 2}px;`;
  });

  const isLast = $derived(currentStep === steps.length - 1);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="tutorial-backdrop" style:clip-path={clipPath} onclick={dismiss}></div>

{#if targetRect}
  <div class="tutorial-highlight" style={highlightStyle}></div>
{/if}

<div class="tutorial-card" style={cardStyle}>
  <h3 class="tutorial-title">{steps[currentStep].title}</h3>
  <p class="tutorial-description">{steps[currentStep].description}</p>

  <ul class="tutorial-details">
    {#each steps[currentStep].details as detail}
      <li>
        {#if detail.icon === 'settings'}
          <span class="detail-icon"><SettingsIcon size={12} /></span>
        {:else if detail.icon === 'plus'}
          <span class="detail-icon"><PlusIcon size={14} /></span>
        {:else if detail.icon === 'bell'}
          <span class="detail-icon"><BellIcon size={14} /></span>
        {:else if detail.icon === 'view-toggle'}
          <span class="detail-icon">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <line x1="1" y1="3" x2="13" y2="3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="1" y1="11" x2="13" y2="11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </span>
        {/if}
        <span><strong>{detail.label}:</strong> {detail.text}</span>
      </li>
    {/each}
  </ul>

  {#if steps[currentStep].showStateLegend}
    <div class="state-legend">
      <span class="legend-entry"><StateIcon state="proposed" size={12} /> Proposed</span>
      <span class="legend-entry"><StateIcon state="in_progress" size={12} /> In Progress</span>
      <span class="legend-entry"><StateIcon state="implemented" size={12} /> Implemented</span>
      <span class="legend-entry"><StateIcon state="blocked" size={12} /> Blocked</span>
    </div>
  {/if}

  <div class="tutorial-footer">
    <div class="tutorial-steps">
      {#each steps as _, i}
        <span class="step-number" class:active={i === currentStep}>{i + 1}</span>
      {/each}
    </div>
    <div class="tutorial-actions">
      {#if currentStep > 0}
        <button class="tutorial-btn secondary" onclick={back}>Back</button>
      {/if}
      <button class="tutorial-btn primary" onclick={next}>
        {isLast ? 'Done' : 'Next'}
      </button>
    </div>
  </div>
</div>

<style>
  .tutorial-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.6);
    transition: clip-path 0.3s ease;
  }

  .tutorial-card {
    position: fixed;
    z-index: 201;
    width: 340px;
    padding: 16px;
    background: var(--background);
    border: 1px solid var(--border-default);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    transition:
      left 0.3s ease,
      top 0.3s ease;
  }

  .tutorial-title {
    margin: 0 0 6px;
    font-size: 15px;
    font-weight: 600;
    color: var(--foreground);
  }

  .tutorial-description {
    margin: 0 0 10px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--foreground-muted);
  }

  .tutorial-details {
    margin: 0 0 14px;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tutorial-details li {
    display: flex;
    align-items: baseline;
    gap: 0;
    font-size: 12px;
    line-height: 1.45;
    color: var(--foreground-muted);
  }

  .tutorial-details strong {
    color: var(--foreground);
    font-weight: 550;
  }

  .detail-icon {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    margin-right: 5px;
    color: var(--foreground-muted);
    position: relative;
    top: 1.5px;
  }

  .state-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
    margin-bottom: 14px;
    padding: 8px 10px;
    background: var(--background-subtle);
    border-radius: 6px;
  }

  .legend-entry {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--foreground-muted);
  }

  .tutorial-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .tutorial-highlight {
    position: fixed;
    z-index: 201;
    border: 2px solid var(--accent-blue);
    border-radius: 4px;
    pointer-events: none;
    transition:
      left 0.3s ease,
      top 0.3s ease,
      width 0.3s ease,
      height 0.3s ease;
  }

  .tutorial-steps {
    display: flex;
    gap: 6px;
  }

  .step-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    font-size: 11px;
    font-weight: 600;
    background: var(--background-muted);
    color: var(--foreground-muted);
    transition:
      background 0.2s,
      color 0.2s;
  }

  .step-number.active {
    background: var(--accent-blue);
    color: white;
  }

  .tutorial-actions {
    display: flex;
    gap: 8px;
  }

  .tutorial-btn {
    padding: 5px 14px;
    font-size: 13px;
    font-weight: 500;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s;
  }

  .tutorial-btn.primary {
    background: var(--accent-blue);
    color: white;
  }

  .tutorial-btn.primary:hover {
    filter: brightness(1.1);
  }

  .tutorial-btn.secondary {
    background: var(--background-muted);
    color: var(--foreground-muted);
  }

  .tutorial-btn.secondary:hover {
    background: var(--background-emphasis);
    color: var(--foreground);
  }
</style>
