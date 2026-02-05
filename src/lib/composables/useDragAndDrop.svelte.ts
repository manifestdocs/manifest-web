import type { components } from '$lib/api/schema.js';
import {
  findFeature,
  getDescendantIds,
  sortFeatures,
} from '$lib/components/features/featureTreeUtils.js';

type FeatureTreeNode = components['schemas']['FeatureTreeNode'];

type DragState = {
  featureId: string;
  feature: FeatureTreeNode;
  parentId: string | null;
  descendantIds: Set<string>;
  pointerId: number;
};

type DropTarget = {
  id: string;
  isLeafTarget: boolean;
};

type GroupCreationRequest = {
  childIds: [string, string];
  childTitles: [string, string];
  parentId: string | null;
};

type FeaturePosition = {
  id: string;
  top: number;
  bottom: number;
  isGroup: boolean;
  isRoot: boolean;
  isLeaf: boolean;
  parentId: string | null;
};

type LongPressState = {
  featureId: string;
  pointerId: number;
  startX: number;
  startY: number;
  timerId: ReturnType<typeof setTimeout>;
  targetElement: HTMLElement;
};

const LONG_PRESS_MS = 300;
const MOVE_THRESHOLD_PX = 5;

export function useDragAndDrop(options: {
  features: () => FeatureTreeNode[];
  expandedIds: () => Set<string>;
  treeContentRef: () => HTMLElement | null;
  rowHeight: number;
  onReparent?: (featureId: string, newParentId: string | null) => void;
  onCreateGroupRequest?: (data: GroupCreationRequest) => void;
  onExpandOnDrop: (id: string) => void;
}) {
  let dragState = $state<DragState | null>(null);
  let dragPosition = $state({ x: 0, y: 0 });
  let dropTarget = $state<DropTarget | null>(null);

  // Long-press state machine: IDLE -> PENDING -> DRAGGING
  let longPress = $state<LongPressState | null>(null);
  let suppressNextClick = $state(false);

  // Build a map of feature positions for drop detection
  const featurePositions = $derived.by(() => {
    const treeRef = options.treeContentRef();
    if (!treeRef) return [];

    const positions: FeaturePosition[] = [];
    let y = 0;

    function traverse(nodes: FeatureTreeNode[], parentId: string | null) {
      for (const node of sortFeatures(nodes)) {
        const isGroup = node.children.length > 0;
        const isRoot = node.is_root ?? false;
        const isLeaf = !isGroup && !isRoot;

        positions.push({
          id: node.id,
          top: y,
          bottom: y + options.rowHeight,
          isGroup,
          isRoot,
          isLeaf,
          parentId,
        });

        y += options.rowHeight;

        if (
          (isRoot || options.expandedIds().has(node.id)) &&
          node.children.length > 0
        ) {
          traverse(node.children, node.id);
        }
      }
    }

    traverse(options.features(), null);
    return positions;
  });

  function isValidDropTarget(targetId: string): boolean {
    if (!dragState) return false;
    if (targetId === dragState.featureId) return false;
    if (targetId === dragState.parentId) return false;
    if (dragState.descendantIds.has(targetId)) return false;
    return true;
  }

  function isDraggingLeaf(): boolean {
    return dragState !== null && dragState.feature.children.length === 0;
  }

  function findDropTarget(clientY: number): DropTarget | null {
    const treeRef = options.treeContentRef();
    if (!treeRef || !dragState) return null;

    const rect = treeRef.getBoundingClientRect();
    const scrollTop = treeRef.scrollTop;
    const relativeY = clientY - rect.top + scrollTop;

    for (const pos of featurePositions) {
      if (relativeY >= pos.top && relativeY < pos.bottom) {
        // Groups and root can always be drop targets
        if ((pos.isGroup || pos.isRoot) && isValidDropTarget(pos.id)) {
          return { id: pos.id, isLeafTarget: false };
        }
        // Leaf-on-leaf: allow if dragging a leaf onto another leaf
        if (pos.isLeaf && isDraggingLeaf() && isValidDropTarget(pos.id)) {
          return { id: pos.id, isLeafTarget: true };
        }
        return null;
      }
    }
    return null;
  }

  function startDrag(featureId: string, e: PointerEvent, element: HTMLElement) {
    const allFeatures = options.features();
    const node = findFeature(allFeatures, featureId);
    if (!node) return;

    dragState = {
      featureId,
      feature: node,
      parentId: node.parent_id ?? null,
      descendantIds: getDescendantIds(node),
      pointerId: e.pointerId,
    };
    dragPosition = { x: e.clientX, y: e.clientY };
    suppressNextClick = true;

    element.setPointerCapture(e.pointerId);
  }

  function cancelLongPress() {
    if (longPress) {
      clearTimeout(longPress.timerId);
      longPress = null;
    }
  }

  function handleRowPointerDown(featureId: string, e: PointerEvent) {
    // Only primary button
    if (e.button !== 0) return;

    // Don't start long-press on toggle buttons
    if ((e.target as HTMLElement).closest('.toggle-btn')) return;

    const element = e.currentTarget as HTMLElement;

    const timerId = setTimeout(() => {
      if (!longPress) return;
      // Timer fired — transition to DRAGGING
      const pending = longPress;
      longPress = null;
      startDrag(pending.featureId, e, pending.targetElement);
    }, LONG_PRESS_MS);

    longPress = {
      featureId,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      timerId,
      targetElement: element,
    };
  }

  function shouldSuppressClick(): boolean {
    if (suppressNextClick) {
      suppressNextClick = false;
      return true;
    }
    return false;
  }

  function handlePointerMove(e: PointerEvent) {
    // Cancel long-press if pointer moved too far during PENDING
    if (longPress && e.pointerId === longPress.pointerId) {
      const dx = e.clientX - longPress.startX;
      const dy = e.clientY - longPress.startY;
      if (dx * dx + dy * dy > MOVE_THRESHOLD_PX * MOVE_THRESHOLD_PX) {
        cancelLongPress();
      }
      return;
    }

    // Normal drag tracking
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    dragPosition = { x: e.clientX, y: e.clientY };
    dropTarget = findDropTarget(e.clientY);
  }

  function handlePointerUp(e: PointerEvent) {
    // Cancel long-press if released early (quick click)
    if (longPress && e.pointerId === longPress.pointerId) {
      cancelLongPress();
      return;
    }

    if (!dragState || e.pointerId !== dragState.pointerId) return;

    const target = findDropTarget(e.clientY);

    if (target && isValidDropTarget(target.id)) {
      if (target.isLeafTarget && options.onCreateGroupRequest) {
        const targetFeature = findFeature(options.features(), target.id);
        const targetPos = featurePositions.find((p) => p.id === target.id);

        if (targetFeature) {
          options.onCreateGroupRequest({
            childIds: [dragState.featureId, target.id],
            childTitles: [dragState.feature.title, targetFeature.title],
            parentId: targetPos?.parentId ?? null,
          });
        }
      } else {
        options.onExpandOnDrop(target.id);
        options.onReparent?.(dragState.featureId, target.id);
      }
    }

    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    dragState = null;
    dropTarget = null;
  }

  function handlePointerCancel(e: PointerEvent) {
    // Cancel long-press
    if (longPress && e.pointerId === longPress.pointerId) {
      cancelLongPress();
      return;
    }

    if (!dragState || e.pointerId !== dragState.pointerId) return;
    dragState = null;
    dropTarget = null;
  }

  return {
    get dragState() {
      return dragState;
    },
    get dragPosition() {
      return dragPosition;
    },
    get dropTarget() {
      return dropTarget;
    },
    get longPressFeatureId(): string | null {
      return longPress?.featureId ?? null;
    },
    handleRowPointerDown,
    shouldSuppressClick,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  };
}
