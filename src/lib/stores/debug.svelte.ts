export type DebugEmptyState =
  | 'none'
  | 'no-projects'
  | 'no-directory'
  | 'no-features';

const STATES: DebugEmptyState[] = [
  'none',
  'no-projects',
  'no-directory',
  'no-features',
];

function createDebugStore() {
  let emptyState = $state<DebugEmptyState>('none');

  return {
    get value() {
      return emptyState;
    },
    set(state: DebugEmptyState) {
      emptyState = state;
    },
    cycle() {
      const currentIndex = STATES.indexOf(emptyState);
      const nextIndex = (currentIndex + 1) % STATES.length;
      emptyState = STATES[nextIndex];
      return emptyState;
    },
    reset() {
      emptyState = 'none';
    },
    get isActive() {
      return emptyState !== 'none';
    },
  };
}

export const debugEmptyState = createDebugStore();
