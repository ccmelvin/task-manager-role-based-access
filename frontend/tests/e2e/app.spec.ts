import { test, expect } from '@playwright/test';
import { TaskManagerPage } from '../utils/testHelpers';
import { mockTasks, mockUsers } from '../fixtures/mockData';

test.describe('Task Manager Application', () => {
  let taskManager: TaskManagerPage;

  test.beforeEach(async ({ page }) => {
    taskManager = new TaskManagerPage(page);
    await taskManager.goto();
  });

  test('should load the application successfully', async ({ page }) => {
    // Check if the main heading is visible
    await expect(page.locator('h1')).toContainText('Task Manager');
    
    // Check if the application loads without errors
    await taskManager.waitForLoad();
    
    // Verify basic UI elements are present
    await expect(page.locator('[data-testid="task-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="new-task-button"]')).toBeVisible();
  });

  test('should display user information', async ({ page }) => {
    // Check if user email is displayed
    const userEmail = await taskManager.getCurrentUserEmail();
    expect(userEmail).toBeTruthy();
    
    // Check if user role is displayed
    const userRole = await taskManager.getCurrentUserRole();
    expect(userRole).toBeTruthy();
  });

  test('should display mock tasks', async ({ page }) => {
    // Wait for tasks to load
    await taskManager.waitForLoad();
    
    // Check if tasks are displayed
    const taskCount = await taskManager.getTaskCount();
    expect(taskCount).toBeGreaterThan(0);
    
    // Verify specific mock tasks are present
    await taskManager.expectTaskExists('Setup AWS Infrastructure');
    await taskManager.expectTaskExists('Implement User Authentication');
  });

  test('should handle responsive design', async ({ page }) => {
    // Test desktop view
    await taskManager.setDesktopViewport();
    await expect(page.locator('[data-testid="task-list"]')).toBeVisible();
    
    // Test mobile view
    await taskManager.setMobileViewport();
    await expect(page.locator('[data-testid="task-list"]')).toBeVisible();
    
    // Check if mobile navigation works (if implemented)
    const mobileMenu = page.locator('[data-testid="mobile-menu"]');
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();
      await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();
    }
  });

  test('should have proper page title and meta tags', async ({ page }) => {
    await expect(page).toHaveTitle(/Task Manager/);
    
    // Check for viewport meta tag (important for mobile)
    const viewportMeta = page.locator('meta[name="viewport"]');
    await expect(viewportMeta).toHaveAttribute('content', /width=device-width/);
  });

  test('should load without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await taskManager.goto();
    await taskManager.waitForLoad();
    
    // Allow for some common React development warnings
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('Warning:') && 
      !error.includes('DevTools')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('should handle network failures gracefully', async ({ page }) => {
    // Simulate network failure
    await page.route('**/*', route => route.abort());
    
    await taskManager.goto();
    
    // The app should still load the basic UI even without network
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should be accessible', async ({ page }) => {
    await taskManager.checkAccessibility();
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'INPUT', 'A', 'SELECT']).toContain(focusedElement);
  });

  test('should measure performance', async ({ page }) => {
    const loadTime = await taskManager.measurePageLoadTime();
    
    // Page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
    
    // Check for performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart
      };
    });
    
    expect(performanceMetrics.domContentLoaded).toBeLessThan(2000);
  });
});
