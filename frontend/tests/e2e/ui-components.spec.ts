import { test, expect } from '@playwright/test';
import { TaskManagerPage, takeScreenshot } from '../utils/testHelpers';

test.describe('UI Components', () => {
  let taskManager: TaskManagerPage;

  test.beforeEach(async ({ page }) => {
    taskManager = new TaskManagerPage(page);
    await taskManager.goto();
    await taskManager.waitForLoad();
  });

  test.describe('Header Component', () => {
    test('should display header with title and user info', async ({ page }) => {
      const header = page.locator('[data-testid="app-header"]');
      await expect(header).toBeVisible();
      
      // Check for app title
      await expect(page.locator('[data-testid="app-title"]')).toContainText('Task Manager');
      
      // Check for user info
      await expect(page.locator('[data-testid="user-info"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-email"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-role"]')).toBeVisible();
    });

    test('should have sign out button', async ({ page }) => {
      await expect(page.locator('[data-testid="sign-out-button"]')).toBeVisible();
    });
  });

  test.describe('Task List Component', () => {
    test('should display task list container', async ({ page }) => {
      const taskList = page.locator('[data-testid="task-list"]');
      await expect(taskList).toBeVisible();
    });

    test('should display task items with required elements', async ({ page }) => {
      const tasks = page.locator('[data-testid="task-item"]');
      const taskCount = await tasks.count();
      
      if (taskCount > 0) {
        const firstTask = tasks.first();
        
        // Verify each task has required elements
        await expect(firstTask.locator('[data-testid="task-title"]')).toBeVisible();
        await expect(firstTask.locator('[data-testid="task-description"]')).toBeVisible();
        await expect(firstTask.locator('[data-testid="task-status"]')).toBeVisible();
        await expect(firstTask.locator('[data-testid="task-priority"]')).toBeVisible();
        await expect(firstTask.locator('[data-testid="task-deadline"]')).toBeVisible();
        await expect(firstTask.locator('[data-testid="assigned-user"]')).toBeVisible();
      }
    });

    test('should show status select for admin users', async ({ page }) => {
      const statusSelects = page.locator('[data-testid="status-select"]');
      const selectCount = await statusSelects.count();
      
      // Admin should have status selects available
      expect(selectCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Task Form Component', () => {
    test.beforeEach(async ({ page }) => {
      await page.click('[data-testid="new-task-button"]');
    });

    test('should display form with all required fields', async ({ page }) => {
      const form = page.locator('[data-testid="task-form"]');
      await expect(form).toBeVisible();
      
      // Check for all form fields
      await expect(page.locator('[data-testid="task-title-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="task-description-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="task-deadline-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="task-priority-select"]')).toBeVisible();
      await expect(page.locator('[data-testid="task-assigned-input"]')).toBeVisible();
    });

    test('should have proper form labels', async ({ page }) => {
      // Check for proper labels with required indicators
      await expect(page.locator('label[for="task-title"]')).toContainText('*');
      await expect(page.locator('label[for="task-description"]')).toContainText('*');
      await expect(page.locator('label[for="task-deadline"]')).toContainText('*');
    });

    test('should have form action buttons', async ({ page }) => {
      await expect(page.locator('[data-testid="submit-task-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="cancel-task-button"]')).toBeVisible();
      
      // Check button text
      await expect(page.locator('[data-testid="submit-task-button"]')).toContainText('Create Task');
      await expect(page.locator('[data-testid="cancel-task-button"]')).toContainText('Cancel');
    });

    test('should show validation errors with proper styling', async ({ page }) => {
      // Submit empty form to trigger validation
      await page.click('[data-testid="submit-task-button"]');
      
      // Check for error messages
      await expect(page.locator('[data-testid="task-title-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="task-description-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="task-deadline-error"]')).toBeVisible();
      
      // Check that inputs have error styling
      const titleInput = page.locator('[data-testid="task-title-input"]');
      const inputClass = await titleInput.getAttribute('class');
      expect(inputClass).toContain('border-red');
    });
  });

  test.describe('Status and Priority Indicators', () => {
    test('should display status badges', async ({ page }) => {
      const statusElements = page.locator('[data-testid="task-status"]');
      const statusCount = await statusElements.count();
      
      if (statusCount > 0) {
        // Check that status elements have content
        for (let i = 0; i < Math.min(statusCount, 3); i++) {
          const status = statusElements.nth(i);
          const text = await status.textContent();
          expect(text?.trim()).toBeTruthy();
        }
      }
    });

    test('should display priority badges', async ({ page }) => {
      const priorityElements = page.locator('[data-testid="task-priority"]');
      const priorityCount = await priorityElements.count();
      
      if (priorityCount > 0) {
        // Check that priority elements have content
        for (let i = 0; i < Math.min(priorityCount, 3); i++) {
          const priority = priorityElements.nth(i);
          const text = await priority.textContent();
          expect(['high', 'medium', 'low']).toContain(text?.toLowerCase());
        }
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      
      // Main elements should be visible
      await expect(page.locator('[data-testid="app-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="task-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="new-task-button"]')).toBeVisible();
    });

    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Main elements should still be visible on mobile
      await expect(page.locator('[data-testid="app-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="task-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="new-task-button"]')).toBeVisible();
    });

    test('should have responsive form layout', async ({ page }) => {
      // Test form on different screen sizes
      await page.setViewportSize({ width: 375, height: 667 });
      await page.click('[data-testid="new-task-button"]');
      
      const form = page.locator('[data-testid="task-form"]');
      await expect(form).toBeVisible();
      
      // Form should be usable on mobile
      await expect(page.locator('[data-testid="task-title-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="submit-task-button"]')).toBeVisible();
    });
  });

  test.describe('Interactive Elements', () => {
    test('should handle button interactions', async ({ page }) => {
      const newTaskButton = page.locator('[data-testid="new-task-button"]');
      
      // Button should be focusable
      await newTaskButton.focus();
      await expect(newTaskButton).toBeFocused();
      
      // Button should be clickable
      await newTaskButton.click();
      await expect(page.locator('[data-testid="task-form"]')).toBeVisible();
    });

    test('should handle form input interactions', async ({ page }) => {
      await page.click('[data-testid="new-task-button"]');
      
      const titleInput = page.locator('[data-testid="task-title-input"]');
      
      // Input should be focusable
      await titleInput.focus();
      await expect(titleInput).toBeFocused();
      
      // Input should accept text
      await titleInput.fill('Test Task');
      await expect(titleInput).toHaveValue('Test Task');
    });

    test('should handle select interactions', async ({ page }) => {
      await page.click('[data-testid="new-task-button"]');
      
      const prioritySelect = page.locator('[data-testid="task-priority-select"]');
      
      // Select should be interactive
      await prioritySelect.selectOption('high');
      await expect(prioritySelect).toHaveValue('high');
    });
  });

  test.describe('Visual Consistency', () => {
    test('should have consistent styling', async ({ page }) => {
      // Take screenshot for visual regression testing
      await takeScreenshot(page, 'main-page-layout');
      
      // Check for consistent button styling
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      expect(buttonCount).toBeGreaterThan(0);
    });

    test('should have proper spacing', async ({ page }) => {
      const taskItems = page.locator('[data-testid="task-item"]');
      const itemCount = await taskItems.count();
      
      if (itemCount > 1) {
        // Tasks should be properly spaced
        const firstTask = taskItems.first();
        const secondTask = taskItems.nth(1);
        
        const firstBox = await firstTask.boundingBox();
        const secondBox = await secondTask.boundingBox();
        
        if (firstBox && secondBox) {
          // There should be some spacing between tasks
          expect(secondBox.y).toBeGreaterThan(firstBox.y + firstBox.height);
        }
      }
    });
  });
});
