import { test, expect } from '@playwright/test';

/**
 * Empty state — fresh install with no data.
 * The server starts with a blank database for every E2E run.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/app');
});

test('shows the app shell without crashing', async ({ page }) => {
  await expect(page).not.toHaveTitle(/error/i);
  // App layout should be present
  await expect(page.locator('body')).toBeVisible();
});

test('shows no projects in the sidebar', async ({ page }) => {
  // The projects list should be empty — no project links
  const projectLinks = page.getByRole('link', { name: /project/i });
  await expect(projectLinks).toHaveCount(0);
});

test('shows a prompt to create the first project', async ({ page }) => {
  // Look for some kind of empty state / onboarding signal
  // This could be a button, heading, or placeholder text
  const createCta = page.getByRole('button', { name: /new project|create project|add project/i });
  await expect(createCta).toBeVisible();
});

test('settings page loads without error', async ({ page }) => {
  await page.goto('/app/settings');
  await expect(page.locator('body')).toBeVisible();
  await expect(page).not.toHaveTitle(/error/i);
});
