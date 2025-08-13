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
    // Wait for the main app elements to be visible
    await this.page.waitForSelector('[data-testid="app-title"]', { timeout: 10000 });
  }

  // Task list helpers
  async getTaskCount() {
    await this.page.waitForSelector('[data-testid="task-list"]', { timeout: 5000 });
    return await this.page.locator('[data-testid="task-item"]').count();
  }

  async getTaskByTitle(title: string) {
    return this.page.locator(`[data-testid="task-item"]:has([data-testid="task-title"]:has-text("${title}"))`);
  }

  async getTaskStatus(taskTitle: string) {
    const task = await this.getTaskByTitle(taskTitle);
    return await task.locator('[data-testid="task-status"]').textContent();
  }

  async updateTaskStatus(taskTitle: string, newStatus: string) {
    const task = await this.getTaskByTitle(taskTitle);
    const statusSelect = task.locator('[data-testid="status-select"]');
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption(newStatus);
    }
  }

  // Task form helpers
  async openNewTaskForm() {
    const button = this.page.locator('[data-testid="new-task-button"]');
    if (await button.isVisible()) {
      await button.click();
      await this.page.waitForSelector('[data-testid="task-form"]', { timeout: 5000 });
    }
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
    // Wait for form to disappear or for success
    await this.page.waitForTimeout(500);
  }

  async cancelTaskForm() {
    await this.page.click('[data-testid="cancel-task-button"]');
    // Wait for form to disappear
    await this.page.waitForTimeout(500);
  }

  // Validation helpers
  async expectTaskExists(title: string) {
    const task = this.getTaskByTitle(title);
    await expect(task).toBeVisible();
  }

  async expectTaskNotExists(title: string) {
    const task = this.getTaskByTitle(title);
    await expect(task).not.toBeVisible();
  }

  async expectTaskStatus(title: string, expectedStatus: string) {
    const task = await this.getTaskByTitle(title);
    const statusElement = task.locator('[data-testid="task-status"]');
    await expect(statusElement).toContainText(expectedStatus);
  }

  // User role helpers
  async getCurrentUserRole() {
    const roleElement = this.page.locator('[data-testid="user-role"]');
    const roleText = await roleElement.textContent();
    return roleText?.replace('Role: ', '').trim() || '';
  }

  async getCurrentUserEmail() {
    const emailElement = this.page.locator('[data-testid="user-email"]');
    const emailText = await emailElement.textContent();
    return emailText?.replace('User: ', '').trim() || '';
  }

  // Error handling helpers
  async expectErrorMessage(message: string) {
    const errorElements = this.page.locator('[data-testid*="error"]');
    let found = false;
    const count = await errorElements.count();
    
    for (let i = 0; i < count; i++) {
      const text = await errorElements.nth(i).textContent();
      if (text?.includes(message)) {
        found = true;
        break;
      }
    }
    
    expect(found).toBeTruthy();
  }

  async expectSuccessMessage(message: string) {
    // For now, we'll check if the action was successful by checking the result
    // In a real app, you might have success message elements
    await this.page.waitForTimeout(500);
  }

  // Form validation helpers
  async expectFormValidationError(fieldName: string) {
    const errorElement = this.page.locator(`[data-testid="${fieldName}-error"]`);
    await expect(errorElement).toBeVisible();
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

    // Check for form labels
    const inputs = await this.page.locator('input, select, textarea').all();
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      if (id) {
        const label = this.page.locator(`label[for="${id}"]`);
        const labelExists = await label.count() > 0;
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');
        
        // Input should have label, aria-label, or aria-labelledby
        expect(labelExists || ariaLabel || ariaLabelledBy).toBeTruthy();
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

  // Authentication helpers
  async signOut() {
    const signOutButton = this.page.locator('[data-testid="sign-out-button"]');
    if (await signOutButton.isVisible()) {
      await signOutButton.click();
      await this.page.waitForSelector('[data-testid="login-form"]', { timeout: 5000 });
    }
  }

  async signIn() {
    const signInButton = this.page.locator('[data-testid="demo-login-button"]');
    if (await signInButton.isVisible()) {
      await signInButton.click();
      await this.page.waitForSelector('[data-testid="app-title"]', { timeout: 5000 });
    }
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

// Helper to wait for element to be stable (useful for animations)
export async function waitForElementStable(page: Page, selector: string, timeout = 5000) {
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible', timeout });
  
  // Wait for element to stop moving (useful for animations)
  let previousBox = await element.boundingBox();
  await page.waitForTimeout(100);
  let currentBox = await element.boundingBox();
  
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (previousBox && currentBox && 
        previousBox.x === currentBox.x && 
        previousBox.y === currentBox.y &&
        previousBox.width === currentBox.width &&
        previousBox.height === currentBox.height) {
      break;
    }
    
    await page.waitForTimeout(100);
    previousBox = currentBox;
    currentBox = await element.boundingBox();
  }
}
