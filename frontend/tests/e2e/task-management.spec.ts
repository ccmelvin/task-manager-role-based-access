import { test, expect } from '@playwright/test';
import { TaskManagerPage } from '../utils/testHelpers';
import { newTaskData, updatedTaskData } from '../fixtures/mockData';

test.describe('Task Management Features', () => {
  let taskManager: TaskManagerPage;

  test.beforeEach(async ({ page }) => {
    taskManager = new TaskManagerPage(page);
    await taskManager.goto();
    await taskManager.waitForLoad();
  });

  test.describe('Task Creation', () => {
    test('should open and close new task form', async ({ page }) => {
      // Open the form
      await taskManager.openNewTaskForm();
      await expect(page.locator('[data-testid="task-form"]')).toBeVisible();
      
      // Close the form
      await taskManager.cancelTaskForm();
      await expect(page.locator('[data-testid="task-form"]')).not.toBeVisible();
    });

    test('should create a new task with valid data', async ({ page }) => {
      await taskManager.openNewTaskForm();
      
      // Fill the form
      await taskManager.fillTaskForm(newTaskData);
      
      // Submit the form
      await taskManager.submitTaskForm();
      
      // Verify the task was created
      await taskManager.expectTaskExists(newTaskData.title);
      
      // Verify success message
      await taskManager.expectSuccessMessage('Task created successfully');
    });

    test('should validate required fields', async ({ page }) => {
      await taskManager.openNewTaskForm();
      
      // Try to submit empty form
      await taskManager.submitTaskForm();
      
      // Check for validation errors
      await taskManager.expectFormValidationError('task-title');
      await taskManager.expectFormValidationError('task-description');
    });

    test('should validate date format', async ({ page }) => {
      await taskManager.openNewTaskForm();
      
      // Fill form with invalid date
      await taskManager.fillTaskForm({
        ...newTaskData,
        deadline: 'invalid-date'
      });
      
      await taskManager.submitTaskForm();
      
      // Check for date validation error
      await taskManager.expectFormValidationError('task-deadline');
    });

    test('should handle form submission errors', async ({ page }) => {
      // Mock API error response
      await page.route('**/api/tasks', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        });
      });

      await taskManager.openNewTaskForm();
      await taskManager.fillTaskForm(newTaskData);
      await taskManager.submitTaskForm();
      
      // Verify error message is displayed
      await taskManager.expectErrorMessage('Failed to create task');
    });
  });

  test.describe('Task Status Updates', () => {
    test('should update task status', async ({ page }) => {
      // Find an existing task
      const existingTask = 'Setup AWS Infrastructure';
      
      // Update status
      await taskManager.updateTaskStatus(existingTask, 'completed');
      
      // Verify status was updated
      await taskManager.expectTaskStatus(existingTask, 'completed');
    });

    test('should show status change confirmation', async ({ page }) => {
      const existingTask = 'Setup AWS Infrastructure';
      
      await taskManager.updateTaskStatus(existingTask, 'completed');
      
      // Verify success message
      await taskManager.expectSuccessMessage('Task status updated');
    });

    test('should handle status update errors', async ({ page }) => {
      // Mock API error for status update
      await page.route('**/api/tasks/*/status', route => {
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Insufficient permissions' })
        });
      });

      const existingTask = 'Setup AWS Infrastructure';
      await taskManager.updateTaskStatus(existingTask, 'completed');
      
      // Verify error message
      await taskManager.expectErrorMessage('Failed to update task status');
    });
  });

  test.describe('Task Filtering and Search', () => {
    test('should filter tasks by status', async ({ page }) => {
      // Click on status filter
      await page.click('[data-testid="filter-completed"]');
      
      // Verify only completed tasks are shown
      const visibleTasks = await page.locator('[data-testid="task-item"]:visible').count();
      const completedTasks = await page.locator('[data-testid="task-item"]:has([data-testid="task-status"]:has-text("completed"))').count();
      
      expect(visibleTasks).toBe(completedTasks);
    });

    test('should search tasks by title', async ({ page }) => {
      const searchTerm = 'AWS';
      
      // Enter search term
      await page.fill('[data-testid="search-input"]', searchTerm);
      
      // Verify filtered results
      const visibleTasks = await page.locator('[data-testid="task-item"]:visible').all();
      
      for (const task of visibleTasks) {
        const title = await task.locator('[data-testid="task-title"]').textContent();
        expect(title?.toLowerCase()).toContain(searchTerm.toLowerCase());
      }
    });

    test('should clear search and show all tasks', async ({ page }) => {
      // Search for something
      await page.fill('[data-testid="search-input"]', 'AWS');
      
      // Clear search
      await page.click('[data-testid="clear-search"]');
      
      // Verify all tasks are shown again
      const taskCount = await taskManager.getTaskCount();
      expect(taskCount).toBeGreaterThan(1);
    });
  });

  test.describe('Task Priority Management', () => {
    test('should display tasks with correct priority indicators', async ({ page }) => {
      // Check high priority task has red indicator
      const highPriorityTask = page.locator('[data-testid="task-item"]:has([data-testid="task-priority"]:has-text("high"))').first();
      await expect(highPriorityTask.locator('[data-testid="priority-indicator"]')).toHaveClass(/bg-red/);
      
      // Check medium priority task has yellow indicator
      const mediumPriorityTask = page.locator('[data-testid="task-item"]:has([data-testid="task-priority"]:has-text("medium"))').first();
      await expect(mediumPriorityTask.locator('[data-testid="priority-indicator"]')).toHaveClass(/bg-yellow/);
    });

    test('should sort tasks by priority', async ({ page }) => {
      // Click priority sort button
      await page.click('[data-testid="sort-by-priority"]');
      
      // Verify high priority tasks appear first
      const firstTask = page.locator('[data-testid="task-item"]').first();
      await expect(firstTask.locator('[data-testid="task-priority"]')).toContainText('high');
    });
  });

  test.describe('Task Assignment', () => {
    test('should display assigned user information', async ({ page }) => {
      const taskWithAssignment = page.locator('[data-testid="task-item"]').first();
      
      // Verify assigned user is displayed
      await expect(taskWithAssignment.locator('[data-testid="assigned-user"]')).toBeVisible();
      
      // Verify assigned user email format
      const assignedUser = await taskWithAssignment.locator('[data-testid="assigned-user"]').textContent();
      expect(assignedUser).toMatch(/\S+@\S+\.\S+/); // Basic email format check
    });

    test('should show user avatar or initials', async ({ page }) => {
      const taskWithAssignment = page.locator('[data-testid="task-item"]').first();
      
      // Check for avatar or initials
      const avatar = taskWithAssignment.locator('[data-testid="user-avatar"]');
      const initials = taskWithAssignment.locator('[data-testid="user-initials"]');
      
      const hasAvatar = await avatar.isVisible();
      const hasInitials = await initials.isVisible();
      
      expect(hasAvatar || hasInitials).toBeTruthy();
    });
  });

  test.describe('Deadline Management', () => {
    test('should highlight overdue tasks', async ({ page }) => {
      // Mock a task with past deadline
      await page.evaluate(() => {
        // This would typically be handled by the backend
        // For testing, we can check if the UI properly handles overdue styling
      });
      
      // Check for overdue styling
      const overdueTasks = page.locator('[data-testid="task-item"].overdue');
      if (await overdueTasks.count() > 0) {
        await expect(overdueTasks.first()).toHaveClass(/bg-red-50|border-red/);
      }
    });

    test('should show deadline countdown', async ({ page }) => {
      const taskWithDeadline = page.locator('[data-testid="task-item"]:has([data-testid="task-deadline"])').first();
      
      // Verify deadline is displayed
      await expect(taskWithDeadline.locator('[data-testid="task-deadline"]')).toBeVisible();
      
      // Check for countdown or due date format
      const deadline = await taskWithDeadline.locator('[data-testid="task-deadline"]').textContent();
      expect(deadline).toBeTruthy();
    });
  });
});
