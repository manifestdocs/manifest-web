
import type { components } from '$lib/api/schema.js';
import { findFeature, getDescendantIds, sortFeatures } from '$lib/components/features/featureTreeUtils.js';

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
    parentId: string | null
};

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
                    parentId
                });

                y += options.rowHeight;

                if ((isRoot || options.expandedIds().has(node.id)) && node.children.length > 0) {
                    traverse(node.children, node.id);
                }
            }
        }

        // We assume the passed features are already filtered if needed (displayFeatures)
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

    function handleDragStart(featureId: string, e: PointerEvent) {
        const allFeatures = options.features(); // This might be filtered, but drag start should work. 
        // Ideally we find in the full tree, but options.features likely passes displayFeatures.
        // However featureTreeUtils.findFeature searches recursively.

        const node = findFeature(allFeatures, featureId);
        if (!node) return;

        dragState = {
            featureId,
            feature: node,
            parentId: node.parent_id ?? null,
            descendantIds: getDescendantIds(node),
            pointerId: e.pointerId
        };
        dragPosition = { x: e.clientX, y: e.clientY };

        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }

    function handlePointerMove(e: PointerEvent) {
        if (!dragState || e.pointerId !== dragState.pointerId) return;

        dragPosition = { x: e.clientX, y: e.clientY };
        dropTarget = findDropTarget(e.clientY);
    }

    function handlePointerUp(e: PointerEvent) {
        if (!dragState || e.pointerId !== dragState.pointerId) return;

        const target = findDropTarget(e.clientY);

        if (target && isValidDropTarget(target.id)) {
            if (target.isLeafTarget && options.onCreateGroupRequest) {
                // Leaf-on-leaf drop: show dialog to create group
                const targetFeature = findFeature(options.features(), target.id);
                const targetPos = featurePositions.find(p => p.id === target.id);

                if (targetFeature) {
                    options.onCreateGroupRequest({
                        childIds: [dragState.featureId, target.id],
                        childTitles: [dragState.feature.title, targetFeature.title],
                        parentId: targetPos?.parentId ?? null
                    });
                }
            } else {
                // Regular group/root drop
                options.onExpandOnDrop(target.id);
                options.onReparent?.(dragState.featureId, target.id);
            }
        }

        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        dragState = null;
        dropTarget = null;
    }

    function handlePointerCancel(e: PointerEvent) {
        if (!dragState || e.pointerId !== dragState.pointerId) return;
        dragState = null;
        dropTarget = null;
    }

    return {
        get dragState() { return dragState; },
        get dragPosition() { return dragPosition; },
        get dropTarget() { return dropTarget; },
        handleDragStart,
        handlePointerMove,
        handlePointerUp,
        handlePointerCancel
    };
}

