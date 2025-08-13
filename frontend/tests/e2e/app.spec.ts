import { test, expect } from '@playwright/test';
import { TaskManagerPage } from '../utils/testHelpers';

test.describe('Task Manager Application', () => {
  let taskManager: TaskManagerPage;

  test.beforeEach(async ({ page }) => {
    taskManager = new TaskManagerPage(page);
    await taskManager.goto();
  });

  test('should load the application successfully', async ({ page }) => {
    // Check if the main heading is visible
    await expect(page.locator('[data-testid="app-title"]')).toContainText('Task Manager');
    
    // Check if the application loads without errors
    await taskManager.waitForLoad();
    
    // Verify basic UI elements are present
    await expect(page.locator('[data-testid="task-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="new-task-button"]')).toBeVisible();
  });

  test('should display user information', async ({ page }) => {
    // Check if user email is displayed
    const userEmail = await page.locator('[data-testid="user-email"]').textContent();
    expect(userEmail).toContain('demo@example.com');
    
    // Check if user role is displayed
    const userRole = await page.locator('[data-testid="user-role"]').textContent();
    expect(userRole).toContain('Admin');
  });

  test('should display mock tasks', async ({ page }) => {
    // Wait for tasks to load
    await taskManager.waitForLoad();
    
    // Check if tasks are displayed
    const taskCount = await page.locator('[data-testid="task-item"]').count();
    expect(taskCount).toBeGreaterThan(0);
    
    // Verify specific mock tasks are present
    await expect(page.locator('[data-testid="task-title"]:has-text("Setup AWS Infrastructure")')).toBeVisible();
    await expect(page.locator('[data-testid="task-title"]:has-text("Implement Authentication")')).toBeVisible();
  });

  test('should handle responsive design', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator('[data-testid="task-list"]')).toBeVisible();
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('[data-testid="task-list"]')).toBeVisible();
    
    // Check if header is still visible on mobile
    await expect(page.locator('[data-testid="app-header"]')).toBeVisible();
  });

  test('should have proper page title', async ({ page }) => {
    await expect(page).toHaveTitle(/React App/); // Default React app title
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
      !error.includes('DevTools') &&
      !error.includes('Download the React DevTools')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('should handle task creation flow', async ({ page }) => {
    // Click new task button
    await page.click('[data-testid="new-task-button"]');
    
    // Verify form appears
    await expect(page.locator('[data-testid="task-form"]')).toBeVisible();
    
    // Cancel form
    await page.click('[data-testid="cancel-task-button"]');
    
    // Verify form disappears
    await expect(page.locator('[data-testid="task-form"]')).not.toBeVisible();
  });

  test('should display task status and priority correctly', async ({ page }) => {
    await taskManager.waitForLoad();
    
    // Check that tasks have status indicators
    const statusElements = page.locator('[data-testid="task-status"]');
    const statusCount = await statusElements.count();
    expect(statusCount).toBeGreaterThan(0);
    
    // Check that tasks have priority indicators
    const priorityElements = page.locator('[data-testid="task-priority"]');
    const priorityCount = await priorityElements.count();
    expect(priorityCount).toBeGreaterThan(0);
  });

  test('should show demo mode indicator', async ({ page }) => {
    // Check for demo mode indicator
    await expect(page.locator('text=Demo Mode')).toBeVisible();
    await expect(page.locator('text=AWS services disabled')).toBeVisible();
  });
});
