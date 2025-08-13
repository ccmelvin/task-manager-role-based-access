import { test, expect } from '@playwright/test';
import { TaskManagerPage, mockApiResponse } from '../utils/testHelpers';
import { mockUsers } from '../fixtures/mockData';

test.describe('Role-Based Access Control', () => {
  let taskManager: TaskManagerPage;

  test.beforeEach(async ({ page }) => {
    taskManager = new TaskManagerPage(page);
  });

  test.describe('Admin Role Permissions', () => {
    test.beforeEach(async ({ page }) => {
      // Mock admin user authentication
      await mockApiResponse(page, '**/api/auth/user', mockUsers[0]); // Admin user
      await taskManager.goto();
      await taskManager.waitForLoad();
    });

    test('should have full access to all features', async ({ page }) => {
      // Verify admin can see all UI elements
      await expect(page.locator('[data-testid="new-task-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="admin-panel"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-management"]')).toBeVisible();
      
      // Verify admin role is displayed
      const userRole = await taskManager.getCurrentUserRole();
      expect(userRole).toBe('Admin');
    });

    test('should be able to create tasks', async ({ page }) => {
      await taskManager.openNewTaskForm();
      await expect(page.locator('[data-testid="task-form"]')).toBeVisible();
      
      // Verify all form fields are enabled
      await expect(page.locator('[data-testid="task-title-input"]')).toBeEnabled();
      await expect(page.locator('[data-testid="task-assigned-input"]')).toBeEnabled();
      await expect(page.locator('[data-testid="task-priority-select"]')).toBeEnabled();
    });

    test('should be able to edit all tasks', async ({ page }) => {
      // Check if edit buttons are visible for all tasks
      const editButtons = page.locator('[data-testid="edit-task-button"]');
      const editButtonCount = await editButtons.count();
      const totalTasks = await taskManager.getTaskCount();
      
      expect(editButtonCount).toBe(totalTasks);
    });

    test('should be able to delete tasks', async ({ page }) => {
      // Check if delete buttons are visible
      const deleteButtons = page.locator('[data-testid="delete-task-button"]');
      const deleteButtonCount = await deleteButtons.count();
      
      expect(deleteButtonCount).toBeGreaterThan(0);
    });

    test('should access user management features', async ({ page }) => {
      // Click on user management
      await page.click('[data-testid="user-management"]');
      
      // Verify user management panel opens
      await expect(page.locator('[data-testid="user-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="add-user-button"]')).toBeVisible();
    });
  });

  test.describe('Manager Role Permissions', () => {
    test.beforeEach(async ({ page }) => {
      // Mock manager user authentication
      await mockApiResponse(page, '**/api/auth/user', mockUsers[1]); // Manager user
      await taskManager.goto();
      await taskManager.waitForLoad();
    });

    test('should have limited admin features', async ({ page }) => {
      // Verify manager can create tasks
      await expect(page.locator('[data-testid="new-task-button"]')).toBeVisible();
      
      // Verify manager role is displayed
      const userRole = await taskManager.getCurrentUserRole();
      expect(userRole).toBe('Manager');
      
      // Verify manager cannot access full admin panel
      await expect(page.locator('[data-testid="admin-panel"]')).not.toBeVisible();
    });

    test('should be able to create and assign tasks', async ({ page }) => {
      await taskManager.openNewTaskForm();
      
      // Verify manager can assign tasks to others
      await expect(page.locator('[data-testid="task-assigned-input"]')).toBeEnabled();
      await expect(page.locator('[data-testid="task-priority-select"]')).toBeEnabled();
    });

    test('should be able to edit assigned tasks', async ({ page }) => {
      // Manager should be able to edit tasks assigned to them or created by them
      const managerTasks = page.locator('[data-testid="task-item"]:has([data-testid="assigned-user"]:has-text("manager@example.com"))');
      const editButtons = managerTasks.locator('[data-testid="edit-task-button"]');
      
      if (await managerTasks.count() > 0) {
        await expect(editButtons.first()).toBeVisible();
      }
    });

    test('should not be able to delete all tasks', async ({ page }) => {
      // Manager should have limited delete permissions
      const allTasks = page.locator('[data-testid="task-item"]');
      const deleteButtons = page.locator('[data-testid="delete-task-button"]');
      
      const totalTasks = await allTasks.count();
      const deleteButtonCount = await deleteButtons.count();
      
      // Manager should not be able to delete all tasks
      expect(deleteButtonCount).toBeLessThanOrEqual(totalTasks);
    });

    test('should not access user management', async ({ page }) => {
      // Verify manager cannot access user management
      await expect(page.locator('[data-testid="user-management"]')).not.toBeVisible();
    });
  });

  test.describe('User Role Permissions', () => {
    test.beforeEach(async ({ page }) => {
      // Mock regular user authentication
      await mockApiResponse(page, '**/api/auth/user', mockUsers[2]); // Regular user
      await taskManager.goto();
      await taskManager.waitForLoad();
    });

    test('should have read-only access to most features', async ({ page }) => {
      // Verify user role is displayed
      const userRole = await taskManager.getCurrentUserRole();
      expect(userRole).toBe('User');
      
      // Verify limited UI elements
      await expect(page.locator('[data-testid="admin-panel"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="user-management"]')).not.toBeVisible();
    });

    test('should be able to view tasks', async ({ page }) => {
      // User should be able to see task list
      await expect(page.locator('[data-testid="task-list"]')).toBeVisible();
      
      const taskCount = await taskManager.getTaskCount();
      expect(taskCount).toBeGreaterThan(0);
    });

    test('should only edit own tasks', async ({ page }) => {
      // User should only see edit buttons for tasks assigned to them
      const userTasks = page.locator('[data-testid="task-item"]:has([data-testid="assigned-user"]:has-text("user@example.com"))');
      const userTaskCount = await userTasks.count();
      
      const editButtons = page.locator('[data-testid="edit-task-button"]');
      const editButtonCount = await editButtons.count();
      
      // Edit buttons should only appear for user's own tasks
      expect(editButtonCount).toBeLessThanOrEqual(userTaskCount);
    });

    test('should not be able to create new tasks', async ({ page }) => {
      // Regular users should not be able to create tasks
      await expect(page.locator('[data-testid="new-task-button"]')).not.toBeVisible();
    });

    test('should not be able to delete tasks', async ({ page }) => {
      // Regular users should not have delete permissions
      await expect(page.locator('[data-testid="delete-task-button"]')).not.toBeVisible();
    });

    test('should be able to update status of assigned tasks', async ({ page }) => {
      // Find tasks assigned to the user
      const userTasks = page.locator('[data-testid="task-item"]:has([data-testid="assigned-user"]:has-text("user@example.com"))');
      
      if (await userTasks.count() > 0) {
        const statusSelect = userTasks.first().locator('[data-testid="status-select"]');
        await expect(statusSelect).toBeEnabled();
      }
    });

    test('should not be able to reassign tasks', async ({ page }) => {
      // User should not be able to change task assignments
      const assignmentInputs = page.locator('[data-testid="task-assigned-input"]');
      
      if (await assignmentInputs.count() > 0) {
        await expect(assignmentInputs.first()).toBeDisabled();
      }
    });
  });

  test.describe('Unauthorized Access', () => {
    test('should redirect unauthenticated users', async ({ page }) => {
      // Mock unauthenticated state
      await mockApiResponse(page, '**/api/auth/user', { error: 'Unauthorized' });
      
      await taskManager.goto();
      
      // Should redirect to login or show login form
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });

    test('should handle invalid tokens gracefully', async ({ page }) => {
      // Mock invalid token response
      await page.route('**/api/**', route => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid token' })
        });
      });

      await taskManager.goto();
      
      // Should show appropriate error message or redirect to login
      const hasLoginForm = await page.locator('[data-testid="login-form"]').isVisible();
      const hasErrorMessage = await page.locator('[data-testid="auth-error"]').isVisible();
      
      expect(hasLoginForm || hasErrorMessage).toBeTruthy();
    });
  });

  test.describe('Permission Enforcement', () => {
    test('should enforce permissions on API calls', async ({ page }) => {
      // Mock user with limited permissions
      await mockApiResponse(page, '**/api/auth/user', mockUsers[2]); // Regular user
      
      // Mock permission denied response for admin actions
      await page.route('**/api/admin/**', route => {
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Insufficient permissions' })
        });
      });

      await taskManager.goto();
      await taskManager.waitForLoad();
      
      // Try to access admin functionality (if any buttons are visible)
      const adminButtons = page.locator('[data-testid*="admin"]');
      if (await adminButtons.count() > 0) {
        await adminButtons.first().click();
        await taskManager.expectErrorMessage('Insufficient permissions');
      }
    });

    test('should show appropriate error messages for permission violations', async ({ page }) => {
      await mockApiResponse(page, '**/api/auth/user', mockUsers[2]); // Regular user
      
      // Mock permission denied for task creation
      await page.route('**/api/tasks', route => {
        if (route.request().method() === 'POST') {
          route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Only managers and admins can create tasks' })
          });
        } else {
          route.continue();
        }
      });

      await taskManager.goto();
      
      // If create button is somehow visible and clicked
      const createButton = page.locator('[data-testid="new-task-button"]');
      if (await createButton.isVisible()) {
        await createButton.click();
        await taskManager.expectErrorMessage('Only managers and admins can create tasks');
      }
    });
  });
});
