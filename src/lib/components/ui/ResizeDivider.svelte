<script lang="ts">
  interface Props {
    onResize: (deltaX: number) => void;
  }

  let { onResize }: Props = $props();

  let isDragging = $state(false);

  function handlePointerDown(e: PointerEvent) {
    e.preventDefault();
    isDragging = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging) return;
    onResize(e.movementX);
  }

  function handlePointerUp(e: PointerEvent) {
    isDragging = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }

  function handleKeyDown(e: KeyboardEvent) {
    const step = e.shiftKey ? 20 : 5;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onResize(-step);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onResize(step);
    }
  }
</script>

<div
  class="resize-divider"
  class:dragging={isDragging}
  role="slider"
  aria-orientation="horizontal"
  aria-label="Resize sidebar"
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={50}
  tabindex="0"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
  onkeydown={handleKeyDown}
>
  <div class="line"></div>
</div>

<style>
  .resize-divider {
    position: relative;
    width: 9px;
    margin-left: -4px;
    margin-right: -4px;
    cursor: col-resize;
    z-index: 10;
    display: flex;
    justify-content: center;
    flex-shrink: 0;
  }

  .line {
    width: 1px;
    height: 100%;
    background: var(--border-default);
    transition: background 0.1s ease;
  }

  .resize-divider:hover .line,
  .resize-divider.dragging .line {
    background: var(--accent-blue);
  }

  .resize-divider:focus {
    outline: none;
  }

  .resize-divider:focus-visible .line {
    background: var(--accent-blue);
  }
</style>
