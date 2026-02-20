import { test, expect, type Page } from '@playwright/test';
import { homedir } from 'os';
import { join } from 'path';

/**
 * New project workflow — create a project through the 3-step wizard:
 *   Step 0: Name + initial version
 *   Step 1: Working directory + git remote
 *   Step 2: AI instructions (optional)
 *   → "Create Project"
 *
 * Note: the server denies paths under /tmp and /var, so we use ~/.manifest-e2e
 * as the base directory for test projects.
 */

const TEST_DIR = join(homedir(), '.manifest-e2e');

async function openNewProjectWizard(page: Page) {
  await page.goto('/app');
  const newProjectBtn = page.getByRole('button', { name: /new project|create project|add project/i });
  await newProjectBtn.click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

/** Walk through all 3 wizard steps and submit. */
async function createProject(page: Page, name: string) {
  await openNewProjectWizard(page);

  const dialog = page.getByRole('dialog');

  // Step 0: name + version
  await dialog.getByLabel('Project Name').fill(name);
  // Initial version defaults to 0.1.0 — leave it
  await dialog.getByRole('button', { name: 'Next' }).click();

  // Step 1: directory path (use a temp path — server will mkdir it)
  const dirPath = join(TEST_DIR, name.replace(/\s+/g, '-').toLowerCase());
  await dialog.getByLabel('Working Directory').fill(dirPath);
  await dialog.getByRole('button', { name: 'Next' }).click();

  // Step 2: instructions (optional — skip)
  await dialog.getByRole('button', { name: 'Create Project' }).click();

  // Wait for dialog to close and navigate to the new project
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  await page.waitForURL(/\/app\/.+/);
}

test('can create a new project', async ({ page }) => {
  await createProject(page, 'Test Project');
  // Project name appears in the sidebar button after creation
  await expect(page.getByRole('button', { name: /Test Project/ })).toBeVisible();
});

test('new project starts with an empty feature tree', async ({ page }) => {
  await createProject(page, 'Empty Project');

  // No feature rows in the tree yet
  const featureRows = page.locator('[role="treeitem"]');
  await expect(featureRows).toHaveCount(0);
});

test('project appears in the sidebar after creation', async ({ page }) => {
  await createProject(page, 'Sidebar Project');

  // Navigate away and back
  await page.goto('/app');
  await expect(page.getByRole('button', { name: /Sidebar Project/ })).toBeVisible();
});

test('wizard "Next" is disabled until name is filled in', async ({ page }) => {
  await openNewProjectWizard(page);
  const dialog = page.getByRole('dialog');

  // Name is empty — Next should be disabled
  const nextBtn = dialog.getByRole('button', { name: 'Next' });
  await expect(nextBtn).toBeDisabled();

  // Fill in name — Next becomes enabled
  await dialog.getByLabel('Project Name').fill('My Project');
  await expect(nextBtn).toBeEnabled();
});

test('can navigate back through wizard steps', async ({ page }) => {
  await openNewProjectWizard(page);
  const dialog = page.getByRole('dialog');

  // Advance to step 1
  await dialog.getByLabel('Project Name').fill('Back Test');
  await dialog.getByRole('button', { name: 'Next' }).click();

  // Back returns to step 0
  await dialog.getByRole('button', { name: 'Back' }).click();
  await expect(dialog.getByLabel('Project Name')).toBeVisible();
});

test('can create a feature in a new project', async ({ page }) => {
  await createProject(page, 'Feature Project');

  // Trigger create feature — look for an add/new feature button
  const addFeatureBtn = page.getByRole('button', { name: /add feature|new feature|\+ feature/i }).first();
  await addFeatureBtn.click();

  const featureDialog = page.getByRole('dialog');
  await expect(featureDialog).toBeVisible();

  const titleInput = featureDialog.getByRole('textbox').first();
  await titleInput.fill('User Authentication');
  await featureDialog.getByRole('button', { name: /create|add|save/i }).last().click();

  // Feature appears as a heading in the detail panel
  await expect(page.getByRole('heading', { name: 'User Authentication' })).toBeVisible();
});
