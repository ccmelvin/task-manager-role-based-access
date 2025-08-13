import { test, expect } from '@playwright/test';

test.describe('Basic Application Tests', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check if the page has loaded by looking for the title
    await expect(page).toHaveTitle(/React App/);
    
    // Check if the main heading is visible
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Task Manager');
  });

  test('should display demo mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for demo mode indicator
    await expect(page.locator('text=Demo Mode')).toBeVisible();
    await expect(page.locator('text=AWS services disabled')).toBeVisible();
  });

  test('should display user information', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check if user info is displayed
    await expect(page.locator('text=demo@example.com')).toBeVisible();
    await expect(page.locator('text=Role: Admin')).toBeVisible();
  });

  test('should display tasks', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check if at least one task is displayed
    await expect(page.locator('text=Setup AWS Infrastructure')).toBeVisible();
    await expect(page.locator('text=Implement Authentication')).toBeVisible();
  });

  test('should have create task functionality', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check if create task button is visible
    const createButton = page.locator('button:has-text("Create Task")');
    await expect(createButton).toBeVisible();
    
    // Click create task button
    await createButton.click();
    
    // Check if form appears
    await expect(page.locator('text=Create New Task')).toBeVisible();
    await expect(page.locator('input[name="title"]')).toBeVisible();
    
    // Cancel the form
    await page.click('button:has-text("Cancel")');
    
    // Form should disappear
    await expect(page.locator('text=Create New Task')).not.toBeVisible();
  });

  test('should handle sign out and sign in flow', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Click sign out button
    const signOutButton = page.locator('button:has-text("Sign Out")');
    await expect(signOutButton).toBeVisible();
    await signOutButton.click();
    
    // Should show login form
    await expect(page.locator('text=Continue as Demo User')).toBeVisible();
    await expect(page.locator('text=Task Manager - Demo Mode')).toBeVisible();
    
    // Sign back in
    await page.click('button:has-text("Continue as Demo User")');
    
    // Should be back to main app
    await expect(page.locator('h1:has-text("Task Manager")')).toBeVisible();
    await expect(page.locator('text=demo@example.com')).toBeVisible();
  });

  test('should display task details', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check if task details are visible
    await expect(page.locator('text=Deploy CDK stack')).toBeVisible();
    await expect(page.locator('text=Due:')).toBeVisible();
    await expect(page.locator('text=Assigned to:')).toBeVisible();
  });

  test('should have status selectors for admin', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Admin should see status selectors
    const statusSelects = page.locator('select');
    const selectCount = await statusSelects.count();
    
    // Should have at least one status selector
    expect(selectCount).toBeGreaterThan(0);
    
    if (selectCount > 0) {
      // Should be able to change status
      const firstSelect = statusSelects.first();
      await expect(firstSelect).toBeVisible();
      
      // Get current value and change it
      const currentValue = await firstSelect.inputValue();
      const newValue = currentValue === 'completed' ? 'in-progress' : 'completed';
      await firstSelect.selectOption(newValue);
      
      // Verify the change
      await expect(firstSelect).toHaveValue(newValue);
    }
  });
});
