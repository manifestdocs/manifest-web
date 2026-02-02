const STORAGE_KEY = 'manifest-sidebar-width';
const DEFAULT_WIDTH = 350;
const MIN_WIDTH = 200;
const MAX_WIDTH = 500;

function createSidebarWidthStore() {
  let width = $state(DEFAULT_WIDTH);

  // Load from localStorage on init (browser only)
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
        width = parsed;
      }
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
    resize(delta: number) {
      this.set(width + delta);
    },
    MIN_WIDTH,
    MAX_WIDTH,
  };
}

export const sidebarWidth = createSidebarWidthStore();
