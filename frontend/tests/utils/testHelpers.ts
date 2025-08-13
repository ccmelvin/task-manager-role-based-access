import { Page, expect } from '@playwright/test';
import { Task } from '../../src/types';

export class TaskManagerPage {
  constructor(public readonly page: Page) {}

  // Navigation helpers
  async goto() {
    await this.page.goto('/');
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  // Task list helpers
  async getTaskCount() {
    return await this.page.locator('[data-testid="task-item"]').count();
  }

  async getTaskByTitle(title: string) {
    return this.page.locator(`[data-testid="task-item"]:has-text("${title}")`);
  }

  async getTaskStatus(taskTitle: string) {
    const task = await this.getTaskByTitle(taskTitle);
    return await task.locator('[data-testid="task-status"]').textContent();
  }

  async updateTaskStatus(taskTitle: string, newStatus: string) {
    const task = await this.getTaskByTitle(taskTitle);
    await task.locator('[data-testid="status-select"]').selectOption(newStatus);
  }

  // Task form helpers
  async openNewTaskForm() {
    await this.page.click('[data-testid="new-task-button"]');
  }

  async fillTaskForm(taskData: Partial<Task>) {
    if (taskData.title) {
      await this.page.fill('[data-testid="task-title-input"]', taskData.title);
    }
    if (taskData.description) {
      await this.page.fill('[data-testid="task-description-input"]', taskData.description);
    }
    if (taskData.deadline) {
      await this.page.fill('[data-testid="task-deadline-input"]', taskData.deadline);
    }
    if (taskData.priority) {
      await this.page.selectOption('[data-testid="task-priority-select"]', taskData.priority);
    }
    if (taskData.assignedTo) {
      await this.page.fill('[data-testid="task-assigned-input"]', taskData.assignedTo);
    }
  }

  async submitTaskForm() {
    await this.page.click('[data-testid="submit-task-button"]');
  }

  async cancelTaskForm() {
    await this.page.click('[data-testid="cancel-task-button"]');
  }

  // Validation helpers
  async expectTaskExists(title: string) {
    await expect(this.getTaskByTitle(title)).toBeVisible();
  }

  async expectTaskNotExists(title: string) {
    await expect(this.getTaskByTitle(title)).not.toBeVisible();
  }

  async expectTaskStatus(title: string, expectedStatus: string) {
    const status = await this.getTaskStatus(title);
    expect(status?.toLowerCase()).toContain(expectedStatus.toLowerCase());
  }

  // User role helpers
  async getCurrentUserRole() {
    return await this.page.locator('[data-testid="user-role"]').textContent();
  }

  async getCurrentUserEmail() {
    return await this.page.locator('[data-testid="user-email"]').textContent();
  }

  // Error handling helpers
  async expectErrorMessage(message: string) {
    await expect(this.page.locator('[data-testid="error-message"]')).toContainText(message);
  }

  async expectSuccessMessage(message: string) {
    await expect(this.page.locator('[data-testid="success-message"]')).toContainText(message);
  }

  // Form validation helpers
  async expectFormValidationError(fieldName: string) {
    await expect(this.page.locator(`[data-testid="${fieldName}-error"]`)).toBeVisible();
  }

  // Responsive design helpers
  async setMobileViewport() {
    await this.page.setViewportSize({ width: 375, height: 667 });
  }

  async setDesktopViewport() {
    await this.page.setViewportSize({ width: 1280, height: 720 });
  }

  // Accessibility helpers
  async checkAccessibility() {
    // Check for proper heading structure
    const h1Count = await this.page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);

    // Check for alt text on images
    const images = await this.page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      expect(alt).toBeTruthy();
    }

    // Check for form labels
    const inputs = await this.page.locator('input').all();
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      if (id) {
        const label = this.page.locator(`label[for="${id}"]`);
        await expect(label).toBeVisible();
      }
    }
  }

  // Performance helpers
  async measurePageLoadTime() {
    const startTime = Date.now();
    await this.goto();
    await this.waitForLoad();
    return Date.now() - startTime;
  }
}

// Utility functions
export async function waitForAnimation(page: Page, timeout = 1000) {
  await page.waitForTimeout(timeout);
}

export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({ 
    path: `test-results/screenshots/${name}.png`,
    fullPage: true 
  });
}

export async function mockApiResponse(page: Page, url: string, response: any) {
  await page.route(url, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response)
    });
  });
}
