const STORAGE_KEY = 'manifest-right-sidebar-width';
const SSR_FALLBACK = 350;
const MIN_WIDTH = 250;
const MAX_WIDTH = 800;

function getDefaultWidth(): number {
  if (typeof window === 'undefined') return SSR_FALLBACK;
  return Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth / 3)));
}

function createRightSidebarWidthStore() {
  let width = $state(SSR_FALLBACK);

  // Load from localStorage on init (browser only)
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
        width = parsed;
      } else {
        width = getDefaultWidth();
      }
    } else {
      width = getDefaultWidth();
    }
  }

  return {
    get value() {
      return width;
    },
    set(newWidth: number) {
      width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, String(width));
      }
    },
    MIN_WIDTH,
    MAX_WIDTH,
  };
}

export const rightSidebarWidth = createRightSidebarWidthStore();
