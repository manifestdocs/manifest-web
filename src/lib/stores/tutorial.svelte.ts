const PROJECT_KEY = 'manifest_tutorial_completed';
const PORTFOLIO_KEY = 'manifest_tutorial_portfolio_completed';

function readFlag(key: string): boolean {
  return typeof window !== 'undefined' && localStorage.getItem(key) === 'true';
}

function writeFlag(key: string, value: boolean) {
  if (typeof window === 'undefined') return;
  if (value) {
    localStorage.setItem(key, 'true');
  } else {
    localStorage.removeItem(key);
  }
}

function createTutorialStore() {
  let projectCompleted = $state(readFlag(PROJECT_KEY));
  let portfolioCompleted = $state(readFlag(PORTFOLIO_KEY));

  return {
    get projectCompleted() {
      return projectCompleted;
    },
    get portfolioCompleted() {
      return portfolioCompleted;
    },
    completeProject() {
      projectCompleted = true;
      writeFlag(PROJECT_KEY, true);
    },
    completePortfolio() {
      portfolioCompleted = true;
      writeFlag(PORTFOLIO_KEY, true);
    },
    resetProject() {
      projectCompleted = false;
      writeFlag(PROJECT_KEY, false);
    },
    resetPortfolio() {
      portfolioCompleted = false;
      writeFlag(PORTFOLIO_KEY, false);
    },
  };
}

export const tutorial = createTutorialStore();
