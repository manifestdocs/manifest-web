<script lang="ts">
  interface Props {
    size?: number;
    class?: string;
    muted?: boolean;
  }

  let { size = 16, class: className = '', muted = false }: Props = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 16 16"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  class={className}
  aria-hidden="true"
>
  {#if muted}
    <!-- Bell with diagonal slash -->
    <path
      d="M4.5 10.5V6.5C4.5 4.567 6.067 3 8 3C9.933 3 11.5 4.567 11.5 6.5V10.5H4.5Z"
      stroke="currentColor"
      stroke-width="1.2"
      stroke-linejoin="round"
    />
    <path
      d="M3.5 10.5H12.5"
      stroke="currentColor"
      stroke-width="1.2"
      stroke-linecap="round"
    />
    <path
      d="M6.5 10.5V11.5C6.5 12.328 7.172 13 8 13C8.828 13 9.5 12.328 9.5 11.5V10.5"
      stroke="currentColor"
      stroke-width="1.2"
    />
    <!-- Diagonal slash -->
    <line
      x1="3"
      y1="13"
      x2="13"
      y2="3"
      stroke="currentColor"
      stroke-width="1.2"
      stroke-linecap="round"
    />
  {:else}
    <!-- Regular bell -->
    <path
      d="M4.5 10.5V6.5C4.5 4.567 6.067 3 8 3C9.933 3 11.5 4.567 11.5 6.5V10.5H4.5Z"
      stroke="currentColor"
      stroke-width="1.2"
      stroke-linejoin="round"
    />
    <path
      d="M3.5 10.5H12.5"
      stroke="currentColor"
      stroke-width="1.2"
      stroke-linecap="round"
    />
    <path
      d="M6.5 10.5V11.5C6.5 12.328 7.172 13 8 13C8.828 13 9.5 12.328 9.5 11.5V10.5"
      stroke="currentColor"
      stroke-width="1.2"
    />
  {/if}
</svg>
