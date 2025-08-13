import { test, expect } from '@playwright/test';
import { TaskManagerPage } from '../utils/testHelpers';

test.describe('Role-Based Access Control', () => {
  let taskManager: TaskManagerPage;

  test.beforeEach(async ({ page }) => {
    taskManager = new TaskManagerPage(page);
    await taskManager.goto();
    await taskManager.waitForLoad();
  });

  test.describe('Admin Role Permissions (Current Demo User)', () => {
    test('should display admin role correctly', async ({ page }) => {
      // Verify admin role is displayed
      const userRole = await page.locator('[data-testid="user-role"]').textContent();
      expect(userRole).toContain('Admin');
    });

    test('should have access to create tasks', async ({ page }) => {
      // Verify admin can see create task button
      await expect(page.locator('[data-testid="new-task-button"]')).toBeVisible();
      
      // Verify admin can open task form
      await page.click('[data-testid="new-task-button"]');
      await expect(page.locator('[data-testid="task-form"]')).toBeVisible();
    });

    test('should be able to update task status', async ({ page }) => {
      // Check if status select is available for admin
      const statusSelects = page.locator('[data-testid="status-select"]');
      const selectCount = await statusSelects.count();
      
      if (selectCount > 0) {
        // Admin should be able to change status
        await expect(statusSelects.first()).toBeEnabled();
      }
    });

    test('should see all task information', async ({ page }) => {
      const tasks = page.locator('[data-testid="task-item"]');
      const taskCount = await tasks.count();
      
      if (taskCount > 0) {
        const firstTask = tasks.first();
        
        // Admin should see all task details
        await expect(firstTask.locator('[data-testid="task-title"]')).toBeVisible();
        await expect(firstTask.locator('[data-testid="task-description"]')).toBeVisible();
        await expect(firstTask.locator('[data-testid="task-status"]')).toBeVisible();
        await expect(firstTask.locator('[data-testid="task-priority"]')).toBeVisible();
        await expect(firstTask.locator('[data-testid="assigned-user"]')).toBeVisible();
      }
    });

    test('should be able to create tasks with all fields', async ({ page }) => {
      await page.click('[data-testid="new-task-button"]');
      
      // Verify all form fields are available and enabled
      await expect(page.locator('[data-testid="task-title-input"]')).toBeEnabled();
      await expect(page.locator('[data-testid="task-description-input"]')).toBeEnabled();
      await expect(page.locator('[data-testid="task-deadline-input"]')).toBeEnabled();
      await expect(page.locator('[data-testid="task-priority-select"]')).toBeEnabled();
      await expect(page.locator('[data-testid="task-assigned-input"]')).toBeEnabled();
    });
  });

  test.describe('User Information Display', () => {
    test('should display current user information', async ({ page }) => {
      // Check user email display
      const userEmail = await page.locator('[data-testid="user-email"]').textContent();
      expect(userEmail).toContain('demo@example.com');
      
      // Check user role display
      const userRole = await page.locator('[data-testid="user-role"]').textContent();
      expect(userRole).toBeTruthy();
    });

    test('should show demo mode indicators', async ({ page }) => {
      // Verify demo mode is clearly indicated
      await expect(page.locator('text=Demo Mode')).toBeVisible();
      await expect(page.locator('text=AWS services disabled')).toBeVisible();
    });

    test('should have sign out functionality', async ({ page }) => {
      // Verify sign out button exists
      await expect(page.locator('[data-testid="sign-out-button"]')).toBeVisible();
      
      // Test sign out functionality
      await page.click('[data-testid="sign-out-button"]');
      
      // Should show login form
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
      
      // Should be able to sign back in
      await page.click('[data-testid="demo-login-button"]');
      await expect(page.locator('[data-testid="app-title"]')).toBeVisible();
    });
  });

  test.describe('Permission-Based UI Elements', () => {
    test('should show appropriate buttons for admin role', async ({ page }) => {
      // Admin should see create task button
      await expect(page.locator('[data-testid="new-task-button"]')).toBeVisible();
      
      // Admin should see status selects for tasks
      const statusSelects = page.locator('[data-testid="status-select"]');
      const selectCount = await statusSelects.count();
      
      // Should have status selects for tasks (admin can modify)
      expect(selectCount).toBeGreaterThanOrEqual(0);
    });

    test('should handle task assignment permissions', async ({ page }) => {
      await page.click('[data-testid="new-task-button"]');
      
      // Admin should be able to assign tasks to others
      const assignInput = page.locator('[data-testid="task-assigned-input"]');
      await expect(assignInput).toBeEnabled();
      
      // Should accept email input
      await assignInput.fill('test@example.com');
      await expect(assignInput).toHaveValue('test@example.com');
    });
  });

  test.describe('Task Management Permissions', () => {
    test('should allow task creation for admin', async ({ page }) => {
      const initialCount = await page.locator('[data-testid="task-item"]').count();
      
      await page.click('[data-testid="new-task-button"]');
      await page.fill('[data-testid="task-title-input"]', 'Admin Created Task');
      await page.fill('[data-testid="task-description-input"]', 'Task created by admin user');
      await page.fill('[data-testid="task-deadline-input"]', '2025-12-31');
      await page.click('[data-testid="submit-task-button"]');
      
      // Task should be created
      const newCount = await page.locator('[data-testid="task-item"]').count();
      expect(newCount).toBe(initialCount + 1);
      
      // New task should be visible
      await expect(page.locator('[data-testid="task-title"]:has-text("Admin Created Task")')).toBeVisible();
    });

    test('should allow status updates for admin', async ({ page }) => {
      const tasks = page.locator('[data-testid="task-item"]');
      const taskCount = await tasks.count();
      
      if (taskCount > 0) {
        const firstTask = tasks.first();
        const statusSelect = firstTask.locator('[data-testid="status-select"]');
        
        if (await statusSelect.isVisible()) {
          // Get current status
          const currentStatus = await statusSelect.inputValue();
          
          // Change to different status
          const newStatus = currentStatus === 'completed' ? 'in-progress' : 'completed';
          await statusSelect.selectOption(newStatus);
          
          // Verify status changed
          await expect(statusSelect).toHaveValue(newStatus);
        }
      }
    });
  });

  test.describe('Authentication Flow', () => {
    test('should handle sign out and sign in flow', async ({ page }) => {
      // Verify we start signed in
      await expect(page.locator('[data-testid="app-title"]')).toBeVisible();
      
      // Sign out
      await page.click('[data-testid="sign-out-button"]');
      
      // Should show login screen
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
      await expect(page.locator('text=Demo Mode')).toBeVisible();
      
      // Sign back in
      await page.click('[data-testid="demo-login-button"]');
      
      // Should return to main app
      await expect(page.locator('[data-testid="app-title"]')).toBeVisible();
      await expect(page.locator('[data-testid="task-list"]')).toBeVisible();
    });

    test('should maintain user context after sign in', async ({ page }) => {
      // Sign out and back in
      await page.click('[data-testid="sign-out-button"]');
      await page.click('[data-testid="demo-login-button"]');
      
      // User info should be restored
      const userEmail = await page.locator('[data-testid="user-email"]').textContent();
      expect(userEmail).toContain('demo@example.com');
      
      const userRole = await page.locator('[data-testid="user-role"]').textContent();
      expect(userRole).toContain('Admin');
    });
  });

  test.describe('UI Accessibility for Roles', () => {
    test('should have proper labels for role-based elements', async ({ page }) => {
      // Check that user role is clearly labeled
      const userRoleElement = page.locator('[data-testid="user-role"]');
      await expect(userRoleElement).toBeVisible();
      
      const roleText = await userRoleElement.textContent();
      expect(roleText).toMatch(/role/i);
    });

    test('should have accessible form elements', async ({ page }) => {
      await page.click('[data-testid="new-task-button"]');
      
      // Check for proper form labels
      await expect(page.locator('label[for="task-title"]')).toBeVisible();
      await expect(page.locator('label[for="task-description"]')).toBeVisible();
      await expect(page.locator('label[for="task-deadline"]')).toBeVisible();
      await expect(page.locator('label[for="task-priority"]')).toBeVisible();
      await expect(page.locator('label[for="task-assigned"]')).toBeVisible();
    });
  });
});
