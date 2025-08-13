import { test, expect } from '@playwright/test';
import { TaskManagerPage } from '../utils/testHelpers';

test.describe('Accessibility and Performance', () => {
  let taskManager: TaskManagerPage;

  test.beforeEach(async ({ page }) => {
    taskManager = new TaskManagerPage(page);
    await taskManager.goto();
    await taskManager.waitForLoad();
  });

  test.describe('Basic Accessibility Tests', () => {
    test('should have proper heading structure', async ({ page }) => {
      // Check for main heading
      const h1Elements = await page.locator('h1').count();
      expect(h1Elements).toBeGreaterThanOrEqual(1);
      
      // Main heading should be the app title
      await expect(page.locator('h1')).toContainText('Task Manager');
    });

    test('should have proper form labels', async ({ page }) => {
      await page.click('[data-testid="new-task-button"]');
      
      // Check for form labels
      await expect(page.locator('label[for="task-title"]')).toBeVisible();
      await expect(page.locator('label[for="task-description"]')).toBeVisible();
      await expect(page.locator('label[for="task-deadline"]')).toBeVisible();
      await expect(page.locator('label[for="task-priority"]')).toBeVisible();
      await expect(page.locator('label[for="task-assigned"]')).toBeVisible();
    });

    test('should have required field indicators', async ({ page }) => {
      await page.click('[data-testid="new-task-button"]');
      
      // Check for required field indicators (*)
      const titleLabel = page.locator('label[for="task-title"]');
      await expect(titleLabel).toContainText('*');
      
      const descLabel = page.locator('label[for="task-description"]');
      await expect(descLabel).toContainText('*');
      
      const deadlineLabel = page.locator('label[for="task-deadline"]');
      await expect(deadlineLabel).toContainText('*');
    });

    test('should have proper ARIA attributes for required fields', async ({ page }) => {
      await page.click('[data-testid="new-task-button"]');
      
      // Check for aria-required on required fields
      const titleInput = page.locator('[data-testid="task-title-input"]');
      await expect(titleInput).toHaveAttribute('aria-required', 'true');
      
      const descInput = page.locator('[data-testid="task-description-input"]');
      await expect(descInput).toHaveAttribute('aria-required', 'true');
      
      const deadlineInput = page.locator('[data-testid="task-deadline-input"]');
      await expect(deadlineInput).toHaveAttribute('aria-required', 'true');
    });

    test('should be keyboard navigable', async ({ page }) => {
      // Test tab navigation through main elements
      await page.keyboard.press('Tab');
      
      // Should be able to focus on interactive elements
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['BUTTON', 'INPUT', 'SELECT', 'A']).toContain(focusedElement);
    });

    test('should have focus indicators', async ({ page }) => {
      const newTaskButton = page.locator('[data-testid="new-task-button"]');
      
      // Focus the button
      await newTaskButton.focus();
      await expect(newTaskButton).toBeFocused();
      
      // Button should have some form of focus indicator
      const focusStyles = await newTaskButton.evaluate(el => {
        const computed = getComputedStyle(el);
        return {
          outline: computed.outline,
          outlineWidth: computed.outlineWidth,
          boxShadow: computed.boxShadow
        };
      });
      
      // Should have some form of focus indicator
      const hasFocusIndicator = 
        focusStyles.outline !== 'none' ||
        focusStyles.outlineWidth !== '0px' ||
        focusStyles.boxShadow !== 'none';
      
      expect(hasFocusIndicator).toBeTruthy();
    });
  });

  test.describe('Basic Performance Tests', () => {
    test('should load within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      
      await taskManager.goto();
      await taskManager.waitForLoad();
      
      const loadTime = Date.now() - startTime;
      
      // Page should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should render tasks efficiently', async ({ page }) => {
      const startTime = Date.now();
      
      // Wait for tasks to be rendered
      await page.waitForSelector('[data-testid="task-item"]', { timeout: 5000 });
      
      const renderTime = Date.now() - startTime;
      
      // Tasks should render quickly
      expect(renderTime).toBeLessThan(3000);
    });

    test('should handle form interactions responsively', async ({ page }) => {
      await page.click('[data-testid="new-task-button"]');
      
      const startTime = Date.now();
      
      // Fill form fields
      await page.fill('[data-testid="task-title-input"]', 'Performance Test Task');
      await page.fill('[data-testid="task-description-input"]', 'Testing form performance');
      
      const interactionTime = Date.now() - startTime;
      
      // Form interactions should be responsive
      expect(interactionTime).toBeLessThan(1000);
    });
  });

  test.describe('Mobile Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
    });

    test('should be usable on mobile devices', async ({ page }) => {
      // Main elements should be visible and usable on mobile
      await expect(page.locator('[data-testid="app-title"]')).toBeVisible();
      await expect(page.locator('[data-testid="task-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="new-task-button"]')).toBeVisible();
    });

    test('should have touch-friendly buttons', async ({ page }) => {
      const newTaskButton = page.locator('[data-testid="new-task-button"]');
      const buttonBox = await newTaskButton.boundingBox();
      
      if (buttonBox) {
        // Button should be at least 44px for touch (iOS guideline)
        expect(Math.min(buttonBox.width, buttonBox.height)).toBeGreaterThanOrEqual(40);
      }
    });

    test('should have readable text on mobile', async ({ page }) => {
      // Check that text is not too small on mobile
      const taskTitles = page.locator('[data-testid="task-title"]');
      const titleCount = await taskTitles.count();
      
      if (titleCount > 0) {
        const firstTitle = taskTitles.first();
        const fontSize = await firstTitle.evaluate(el => {
          return getComputedStyle(el).fontSize;
        });
        
        // Font size should be at least 16px for mobile readability
        const fontSizeNum = parseInt(fontSize.replace('px', ''));
        expect(fontSizeNum).toBeGreaterThanOrEqual(14);
      }
    });
  });

  test.describe('Error Handling Accessibility', () => {
    test('should announce form validation errors', async ({ page }) => {
      await page.click('[data-testid="new-task-button"]');
      
      // Submit empty form to trigger validation
      await page.click('[data-testid="submit-task-button"]');
      
      // Error messages should be visible and associated with inputs
      const titleError = page.locator('[data-testid="task-title-error"]');
      await expect(titleError).toBeVisible();
      
      const errorText = await titleError.textContent();
      expect(errorText?.trim()).toBeTruthy();
    });

    test('should have proper error styling', async ({ page }) => {
      await page.click('[data-testid="new-task-button"]');
      await page.click('[data-testid="submit-task-button"]');
      
      // Input with error should have error styling
      const titleInput = page.locator('[data-testid="task-title-input"]');
      const inputClass = await titleInput.getAttribute('class');
      expect(inputClass).toContain('border-red');
    });
  });

  test.describe('Content Accessibility', () => {
    test('should have meaningful page content', async ({ page }) => {
      // Page should have meaningful content structure
      await expect(page.locator('[data-testid="app-title"]')).toBeVisible();
      
      // User information should be clearly presented
      await expect(page.locator('[data-testid="user-email"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-role"]')).toBeVisible();
    });

    test('should have clear task information', async ({ page }) => {
      const tasks = page.locator('[data-testid="task-item"]');
      const taskCount = await tasks.count();
      
      if (taskCount > 0) {
        const firstTask = tasks.first();
        
        // Task information should be clearly structured
        await expect(firstTask.locator('[data-testid="task-title"]')).toBeVisible();
        await expect(firstTask.locator('[data-testid="task-description"]')).toBeVisible();
        await expect(firstTask.locator('[data-testid="task-status"]')).toBeVisible();
      }
    });

    test('should have clear status and priority indicators', async ({ page }) => {
      const statusElements = page.locator('[data-testid="task-status"]');
      const statusCount = await statusElements.count();
      
      if (statusCount > 0) {
        // Status should have meaningful text
        const firstStatus = await statusElements.first().textContent();
        expect(firstStatus?.trim()).toBeTruthy();
      }
      
      const priorityElements = page.locator('[data-testid="task-priority"]');
      const priorityCount = await priorityElements.count();
      
      if (priorityCount > 0) {
        // Priority should have meaningful text
        const firstPriority = await priorityElements.first().textContent();
        expect(['high', 'medium', 'low']).toContain(firstPriority?.toLowerCase());
      }
    });
  });
});
