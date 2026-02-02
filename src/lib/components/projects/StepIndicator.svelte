<script lang="ts">
  import { CheckIcon } from '$lib/components/icons/index.js';

  interface Step {
    label: string;
  }

  interface Props {
    steps: Step[];
    currentStep: number;
  }

  let { steps, currentStep }: Props = $props();
</script>

<div class="step-indicator">
  {#each steps as step, index (index)}
    <div
      class="step"
      class:active={index === currentStep}
      class:completed={index < currentStep}
    >
      <div class="step-circle">
        {#if index < currentStep}
          <CheckIcon size={12} />
        {:else}
          {index + 1}
        {/if}
      </div>
      <span class="step-label">{step.label}</span>
    </div>
    {#if index < steps.length - 1}
      <div class="step-connector" class:completed={index < currentStep}></div>
    {/if}
  {/each}
</div>

<style>
  .step-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 4px;
  }

  .step {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .step-circle {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 500;
    background: var(--background-muted);
    color: var(--foreground-muted);
    border: 1px solid var(--border-default);
    transition: all 0.15s ease;
  }

  .step.active .step-circle {
    background: var(--accent-blue);
    color: #fff;
    border-color: var(--accent-blue);
  }

  .step.completed .step-circle {
    background: var(--accent-green);
    color: #000;
    border-color: var(--accent-green);
  }

  .step-label {
    font-size: 13px;
    color: var(--foreground-muted);
    transition: color 0.15s ease;
  }

  .step.active .step-label {
    color: var(--foreground);
    font-weight: 500;
  }

  .step.completed .step-label {
    color: var(--foreground);
  }

  .step-connector {
    flex: 1;
    height: 1px;
    min-width: 24px;
    background: var(--border-default);
    transition: background 0.15s ease;
  }

  .step-connector.completed {
    background: var(--accent-green);
  }
</style>
