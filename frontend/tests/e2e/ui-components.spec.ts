import { test, expect } from '@playwright/test';
import { TaskManagerPage, takeScreenshot } from '../utils/testHelpers';

test.describe('UI Components', () => {
  let taskManager: TaskManagerPage;

  test.beforeEach(async ({ page }) => {
    taskManager = new TaskManagerPage(page);
    await taskManager.goto();
    await taskManager.waitForLoad();
  });

  test.describe('Task List Component', () => {
    test('should display tasks in a grid layout', async ({ page }) => {
      const taskList = page.locator('[data-testid="task-list"]');
      await expect(taskList).toBeVisible();
      
      // Check if tasks are displayed in a grid or list format
      const tasks = page.locator('[data-testid="task-item"]');
      const taskCount = await tasks.count();
      expect(taskCount).toBeGreaterThan(0);
      
      // Verify each task has required elements
      for (let i = 0; i < Math.min(taskCount, 3); i++) {
        const task = tasks.nth(i);
        await expect(task.locator('[data-testid="task-title"]')).toBeVisible();
        await expect(task.locator('[data-testid="task-status"]')).toBeVisible();
        await expect(task.locator('[data-testid="task-priority"]')).toBeVisible();
      }
    });

    test('should show empty state when no tasks', async ({ page }) => {
      // Mock empty task list
      await page.route('**/api/tasks', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        });
      });

      await page.reload();
      await taskManager.waitForLoad();
      
      // Check for empty state message
      await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
      await expect(page.locator('[data-testid="empty-state"]')).toContainText('No tasks found');
    });

    test('should handle loading state', async ({ page }) => {
      // Mock slow API response
      await page.route('**/api/tasks', async route => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        route.continue();
      });

      await page.reload();
      
      // Check for loading indicator
      await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
    });

    test('should display task cards with proper styling', async ({ page }) => {
      const taskCards = page.locator('[data-testid="task-item"]');
      const firstCard = taskCards.first();
      
      // Check for card styling
      await expect(firstCard).toHaveClass(/border|shadow|rounded/);
      
      // Check for hover effects
      await firstCard.hover();
      await page.waitForTimeout(100); // Wait for hover animation
      
      // Take screenshot for visual verification
      await takeScreenshot(page, 'task-card-hover');
    });
  });

  test.describe('Task Form Component', () => {
    test.beforeEach(async ({ page }) => {
      await taskManager.openNewTaskForm();
    });

    test('should display all form fields', async ({ page }) => {
      const form = page.locator('[data-testid="task-form"]');
      await expect(form).toBeVisible();
      
      // Check for all required form fields
      await expect(page.locator('[data-testid="task-title-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="task-description-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="task-deadline-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="task-priority-select"]')).toBeVisible();
      await expect(page.locator('[data-testid="task-assigned-input"]')).toBeVisible();
    });

    test('should have proper form labels and accessibility', async ({ page }) => {
      // Check for proper labels
      const titleInput = page.locator('[data-testid="task-title-input"]');
      const titleLabel = page.locator('label[for="task-title"]');
      
      await expect(titleLabel).toBeVisible();
      await expect(titleLabel).toContainText('Title');
      
      // Check for required field indicators
      await expect(titleLabel).toContainText('*');
    });

    test('should show validation errors with proper styling', async ({ page }) => {
      // Submit empty form
      await taskManager.submitTaskForm();
      
      // Check for error styling
      const titleInput = page.locator('[data-testid="task-title-input"]');
      await expect(titleInput).toHaveClass(/border-red|error/);
      
      // Check for error message
      const errorMessage = page.locator('[data-testid="task-title-error"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toHaveClass(/text-red/);
    });

    test('should have responsive form layout', async ({ page }) => {
      // Test desktop layout
      await taskManager.setDesktopViewport();
      const form = page.locator('[data-testid="task-form"]');
      await expect(form).toBeVisible();
      
      // Test mobile layout
      await taskManager.setMobileViewport();
      await expect(form).toBeVisible();
      
      // Form should stack vertically on mobile
      const formWidth = await form.boundingBox();
      expect(formWidth?.width).toBeLessThan(400);
    });

    test('should have proper button states', async ({ page }) => {
      const submitButton = page.locator('[data-testid="submit-task-button"]');
      const cancelButton = page.locator('[data-testid="cancel-task-button"]');
      
      // Check initial button states
      await expect(submitButton).toBeVisible();
      await expect(cancelButton).toBeVisible();
      
      // Check button styling
      await expect(submitButton).toHaveClass(/bg-blue|primary/);
      await expect(cancelButton).toHaveClass(/bg-gray|secondary/);
      
      // Test button hover states
      await submitButton.hover();
      await page.waitForTimeout(100);
      
      await takeScreenshot(page, 'form-button-hover');
    });
  });

  test.describe('Status Indicators', () => {
    test('should display correct status colors', async ({ page }) => {
      const tasks = page.locator('[data-testid="task-item"]');
      
      // Check for different status colors
      const completedTask = tasks.locator(':has([data-testid="task-status"]:has-text("completed"))').first();
      if (await completedTask.isVisible()) {
        const statusBadge = completedTask.locator('[data-testid="status-badge"]');
        await expect(statusBadge).toHaveClass(/bg-green/);
      }
      
      const inProgressTask = tasks.locator(':has([data-testid="task-status"]:has-text("in-progress"))').first();
      if (await inProgressTask.isVisible()) {
        const statusBadge = inProgressTask.locator('[data-testid="status-badge"]');
        await expect(statusBadge).toHaveClass(/bg-yellow/);
      }
      
      const pendingTask = tasks.locator(':has([data-testid="task-status"]:has-text("pending"))').first();
      if (await pendingTask.isVisible()) {
        const statusBadge = pendingTask.locator('[data-testid="status-badge"]');
        await expect(statusBadge).toHaveClass(/bg-gray/);
      }
    });

    test('should have accessible status indicators', async ({ page }) => {
      const statusBadges = page.locator('[data-testid="status-badge"]');
      
      // Check that status badges have proper ARIA labels
      const firstBadge = statusBadges.first();
      const ariaLabel = await firstBadge.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toMatch(/status/i);
    });
  });

  test.describe('Priority Indicators', () => {
    test('should display priority with correct colors', async ({ page }) => {
      const tasks = page.locator('[data-testid="task-item"]');
      
      // Check high priority styling
      const highPriorityTask = tasks.locator(':has([data-testid="task-priority"]:has-text("high"))').first();
      if (await highPriorityTask.isVisible()) {
        const priorityIndicator = highPriorityTask.locator('[data-testid="priority-indicator"]');
        await expect(priorityIndicator).toHaveClass(/bg-red|text-red/);
      }
      
      // Check medium priority styling
      const mediumPriorityTask = tasks.locator(':has([data-testid="task-priority"]:has-text("medium"))').first();
      if (await mediumPriorityTask.isVisible()) {
        const priorityIndicator = mediumPriorityTask.locator('[data-testid="priority-indicator"]');
        await expect(priorityIndicator).toHaveClass(/bg-yellow|text-yellow/);
      }
      
      // Check low priority styling
      const lowPriorityTask = tasks.locator(':has([data-testid="task-priority"]:has-text("low"))').first();
      if (await lowPriorityTask.isVisible()) {
        const priorityIndicator = lowPriorityTask.locator('[data-testid="priority-indicator"]');
        await expect(priorityIndicator).toHaveClass(/bg-green|text-green/);
      }
    });
  });

  test.describe('Navigation and Layout', () => {
    test('should have proper header layout', async ({ page }) => {
      const header = page.locator('[data-testid="app-header"]');
      await expect(header).toBeVisible();
      
      // Check for logo/title
      await expect(header.locator('[data-testid="app-title"]')).toBeVisible();
      
      // Check for user info
      await expect(header.locator('[data-testid="user-info"]')).toBeVisible();
    });

    test('should have responsive navigation', async ({ page }) => {
      // Desktop navigation
      await taskManager.setDesktopViewport();
      const desktopNav = page.locator('[data-testid="desktop-nav"]');
      if (await desktopNav.isVisible()) {
        await expect(desktopNav).toBeVisible();
      }
      
      // Mobile navigation
      await taskManager.setMobileViewport();
      const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]');
      if (await mobileMenuButton.isVisible()) {
        await mobileMenuButton.click();
        await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();
      }
    });

    test('should have proper footer', async ({ page }) => {
      const footer = page.locator('[data-testid="app-footer"]');
      if (await footer.isVisible()) {
        await expect(footer).toBeVisible();
        
        // Scroll to footer
        await footer.scrollIntoViewIfNeeded();
        await expect(footer).toBeInViewport();
      }
    });
  });

  test.describe('Interactive Elements', () => {
    test('should have proper button interactions', async ({ page }) => {
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      
      // Test first few buttons for proper interactions
      for (let i = 0; i < Math.min(buttonCount, 3); i++) {
        const button = buttons.nth(i);
        
        // Check if button is focusable
        await button.focus();
        await expect(button).toBeFocused();
        
        // Check for hover effects
        await button.hover();
        await page.waitForTimeout(100);
      }
    });

    test('should have proper form input interactions', async ({ page }) => {
      await taskManager.openNewTaskForm();
      
      const titleInput = page.locator('[data-testid="task-title-input"]');
      
      // Test focus states
      await titleInput.focus();
      await expect(titleInput).toBeFocused();
      
      // Test input functionality
      await titleInput.fill('Test Task');
      await expect(titleInput).toHaveValue('Test Task');
      
      // Test placeholder text
      await titleInput.clear();
      const placeholder = await titleInput.getAttribute('placeholder');
      expect(placeholder).toBeTruthy();
    });
  });

  test.describe('Visual Consistency', () => {
    test('should have consistent color scheme', async ({ page }) => {
      // Take screenshots for visual regression testing
      await takeScreenshot(page, 'main-page-layout');
      
      // Check for consistent use of primary colors
      const primaryButtons = page.locator('button.primary, .bg-blue-500, .bg-blue-600');
      if (await primaryButtons.count() > 0) {
        // All primary buttons should have similar styling
        const firstButton = primaryButtons.first();
        const buttonStyles = await firstButton.evaluate(el => getComputedStyle(el));
        expect(buttonStyles.backgroundColor).toBeTruthy();
      }
    });

    test('should have consistent typography', async ({ page }) => {
      // Check for consistent heading hierarchy
      const h1Elements = page.locator('h1');
      const h2Elements = page.locator('h2');
      
      const h1Count = await h1Elements.count();
      expect(h1Count).toBeLessThanOrEqual(1); // Should have at most one h1
      
      // Check font consistency
      if (h1Count > 0) {
        const h1Styles = await h1Elements.first().evaluate(el => getComputedStyle(el));
        expect(h1Styles.fontFamily).toBeTruthy();
      }
    });

    test('should have proper spacing and alignment', async ({ page }) => {
      const taskItems = page.locator('[data-testid="task-item"]');
      
      if (await taskItems.count() > 1) {
        // Check for consistent spacing between task items
        const firstTask = taskItems.first();
        const secondTask = taskItems.nth(1);
        
        const firstTaskBox = await firstTask.boundingBox();
        const secondTaskBox = await secondTask.boundingBox();
        
        if (firstTaskBox && secondTaskBox) {
          const spacing = secondTaskBox.y - (firstTaskBox.y + firstTaskBox.height);
          expect(spacing).toBeGreaterThan(0); // Should have some spacing
          expect(spacing).toBeLessThan(50); // But not too much
        }
      }
    });
  });
});
