import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('should load the page without errors', async ({ page }) => {
    // Just try to load the page
    await page.goto('/');
    
    // Wait a bit for the page to load
    await page.waitForTimeout(2000);
    
    // Check if we can find any text on the page
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
    
    console.log('Page loaded successfully');
  });

  test('should have a title', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    const title = await page.title();
    expect(title).toBeTruthy();
    
    console.log('Page title:', title);
  });
});
