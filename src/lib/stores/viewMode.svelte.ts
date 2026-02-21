const STORAGE_KEY = 'manifest_view_mode';

export type ViewMode = 'portfolio' | 'project';

function createViewModeStore() {
  let mode = $state<ViewMode>('portfolio');

  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'portfolio' || stored === 'project') {
      mode = stored;
    }
  }

  return {
    get value() {
      return mode;
    },
    set(newMode: ViewMode) {
      mode = newMode;
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, newMode);
      }
    },
    toggle() {
      this.set(mode === 'portfolio' ? 'project' : 'portfolio');
    },
  };
}

export const viewMode = createViewModeStore();
