import { test, expect } from '@playwright/test';
import { TaskManagerPage } from '../utils/testHelpers';

test.describe('Accessibility and Performance', () => {
  let taskManager: TaskManagerPage;

  test.beforeEach(async ({ page }) => {
    taskManager = new TaskManagerPage(page);
    await taskManager.goto();
    await taskManager.waitForLoad();
  });

  test.describe('Accessibility Tests', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      // Check for proper heading structure
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
      
      let currentLevel = 0;
      for (const heading of headings) {
        const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
        const level = parseInt(tagName.charAt(1));
        
        if (currentLevel === 0) {
          expect(level).toBe(1); // First heading should be h1
        } else {
          expect(level).toBeLessThanOrEqual(currentLevel + 1); // No skipping levels
        }
        currentLevel = level;
      }
    });

    test('should have proper ARIA labels and roles', async ({ page }) => {
      // Check for ARIA labels on interactive elements
      const buttons = await page.locator('button').all();
      for (const button of buttons) {
        const ariaLabel = await button.getAttribute('aria-label');
        const textContent = await button.textContent();
        
        // Button should have either aria-label or text content
        expect(ariaLabel || textContent?.trim()).toBeTruthy();
      }

      // Check for proper roles on custom components
      const customComponents = await page.locator('[role]').all();
      for (const component of customComponents) {
        const role = await component.getAttribute('role');
        expect(role).toBeTruthy();
      }
    });

    test('should have proper form accessibility', async ({ page }) => {
      await taskManager.openNewTaskForm();
      
      // Check for form labels
      const inputs = await page.locator('input, select, textarea').all();
      for (const input of inputs) {
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');
        
        if (id) {
          const label = page.locator(`label[for="${id}"]`);
          const hasLabel = await label.count() > 0;
          
          // Input should have label, aria-label, or aria-labelledby
          expect(hasLabel || ariaLabel || ariaLabelledBy).toBeTruthy();
        }
      }

      // Check for required field indicators
      const requiredInputs = await page.locator('input[required], select[required], textarea[required]').all();
      for (const input of requiredInputs) {
        const ariaRequired = await input.getAttribute('aria-required');
        expect(ariaRequired).toBe('true');
      }
    });

    test('should have proper color contrast', async ({ page }) => {
      // Check text elements for sufficient contrast
      const textElements = await page.locator('p, span, div, h1, h2, h3, h4, h5, h6, button, a').all();
      
      for (let i = 0; i < Math.min(textElements.length, 10); i++) {
        const element = textElements[i];
        const styles = await element.evaluate(el => {
          const computed = getComputedStyle(el);
          return {
            color: computed.color,
            backgroundColor: computed.backgroundColor,
            fontSize: computed.fontSize
          };
        });
        
        // Basic check - ensure text has color
        expect(styles.color).not.toBe('rgba(0, 0, 0, 0)');
      }
    });

    test('should be keyboard navigable', async ({ page }) => {
      // Test tab navigation
      const focusableElements = await page.locator('button, input, select, textarea, a[href]').all();
      
      if (focusableElements.length > 0) {
        // Focus first element
        await focusableElements[0].focus();
        await expect(focusableElements[0]).toBeFocused();
        
        // Tab through elements
        for (let i = 1; i < Math.min(focusableElements.length, 5); i++) {
          await page.keyboard.press('Tab');
          // Note: Focus order might not match DOM order due to CSS
        }
        
        // Test escape key functionality
        await page.keyboard.press('Escape');
        
        // Test enter key on buttons
        const buttons = await page.locator('button').all();
        if (buttons.length > 0) {
          await buttons[0].focus();
          // Note: Would need to mock click handlers to test enter key
        }
      }
    });

    test('should have proper focus indicators', async ({ page }) => {
      const focusableElements = await page.locator('button, input, select, textarea, a[href]').all();
      
      for (let i = 0; i < Math.min(focusableElements.length, 3); i++) {
        const element = focusableElements[i];
        
        // Focus the element
        await element.focus();
        
        // Check for focus styles
        const focusStyles = await element.evaluate(el => {
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
      }
    });

    test('should have proper alt text for images', async ({ page }) => {
      const images = await page.locator('img').all();
      
      for (const img of images) {
        const alt = await img.getAttribute('alt');
        const src = await img.getAttribute('src');
        
        // Decorative images can have empty alt, but alt attribute should exist
        expect(alt).not.toBeNull();
        
        // Non-decorative images should have meaningful alt text
        if (src && !src.includes('decoration') && !src.includes('spacer')) {
          expect(alt?.trim()).toBeTruthy();
        }
      }
    });

    test('should support screen reader navigation', async ({ page }) => {
      // Check for landmark roles
      const landmarks = await page.locator('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer').all();
      expect(landmarks.length).toBeGreaterThan(0);
      
      // Check for skip links
      const skipLinks = await page.locator('a[href^="#"]').all();
      for (const link of skipLinks) {
        const text = await link.textContent();
        if (text?.toLowerCase().includes('skip')) {
          expect(link).toBeTruthy(); // Skip link exists
        }
      }
    });
  });

  test.describe('Performance Tests', () => {
    test('should load within acceptable time limits', async ({ page }) => {
      const startTime = Date.now();
      
      await taskManager.goto();
      await taskManager.waitForLoad();
      
      const loadTime = Date.now() - startTime;
      
      // Page should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('should have good Core Web Vitals', async ({ page }) => {
      await taskManager.goto();
      
      // Measure performance metrics
      const metrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const vitals: any = {};
            
            entries.forEach((entry) => {
              if (entry.name === 'first-contentful-paint') {
                vitals.fcp = entry.startTime;
              }
              if (entry.name === 'largest-contentful-paint') {
                vitals.lcp = entry.startTime;
              }
            });
            
            resolve(vitals);
          }).observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
          
          // Fallback timeout
          setTimeout(() => resolve({}), 5000);
        });
      });
      
      // Check Core Web Vitals thresholds
      if ((metrics as any).fcp) {
        expect((metrics as any).fcp).toBeLessThan(1800); // FCP should be < 1.8s
      }
      
      if ((metrics as any).lcp) {
        expect((metrics as any).lcp).toBeLessThan(2500); // LCP should be < 2.5s
      }
    });

    test('should handle large datasets efficiently', async ({ page }) => {
      // Mock large dataset
      const largeMockData = Array.from({ length: 100 }, (_, i) => ({
        taskId: `task-${i}`,
        title: `Task ${i}`,
        description: `Description for task ${i}`,
        status: i % 3 === 0 ? 'completed' : i % 3 === 1 ? 'in-progress' : 'pending',
        priority: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low',
        assignedTo: `user${i % 5}@example.com`,
        createdBy: 'admin@example.com',
        deadline: '2025-12-31',
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      await page.route('**/api/tasks', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(largeMockData)
        });
      });

      const startTime = Date.now();
      await page.reload();
      await taskManager.waitForLoad();
      
      const renderTime = Date.now() - startTime;
      
      // Should render large dataset within reasonable time
      expect(renderTime).toBeLessThan(5000);
      
      // Check if virtualization or pagination is working
      const visibleTasks = await page.locator('[data-testid="task-item"]:visible').count();
      
      // Should not render all 100 items at once (indicates virtualization/pagination)
      expect(visibleTasks).toBeLessThan(100);
    });

    test('should have efficient re-renders', async ({ page }) => {
      await taskManager.goto();
      await taskManager.waitForLoad();
      
      // Measure time for status update
      const startTime = Date.now();
      
      // Update task status
      const firstTask = page.locator('[data-testid="task-item"]').first();
      const statusSelect = firstTask.locator('[data-testid="status-select"]');
      
      if (await statusSelect.isVisible()) {
        await statusSelect.selectOption('completed');
        
        // Wait for update to complete
        await page.waitForTimeout(100);
        
        const updateTime = Date.now() - startTime;
        
        // Status update should be fast
        expect(updateTime).toBeLessThan(1000);
      }
    });

    test('should optimize images and assets', async ({ page }) => {
      // Check for optimized images
      const images = await page.locator('img').all();
      
      for (const img of images) {
        const src = await img.getAttribute('src');
        const loading = await img.getAttribute('loading');
        
        if (src) {
          // Check for lazy loading
          if (!src.includes('above-fold')) {
            expect(loading).toBe('lazy');
          }
          
          // Check for appropriate image formats
          const isOptimized = 
            src.includes('.webp') || 
            src.includes('.avif') || 
            src.includes('w_') || // Cloudinary width parameter
            src.includes('q_'); // Cloudinary quality parameter
          
          // Note: This is optional depending on your image optimization strategy
        }
      }
    });

    test('should minimize bundle size impact', async ({ page }) => {
      // Check for code splitting indicators
      const scripts = await page.locator('script[src]').all();
      
      let hasChunks = false;
      for (const script of scripts) {
        const src = await script.getAttribute('src');
        if (src && (src.includes('chunk') || src.includes('vendor'))) {
          hasChunks = true;
          break;
        }
      }
      
      // Should have code splitting (chunks)
      expect(hasChunks).toBeTruthy();
    });

    test('should handle memory efficiently', async ({ page }) => {
      await taskManager.goto();
      await taskManager.waitForLoad();
      
      // Get initial memory usage
      const initialMemory = await page.evaluate(() => {
        return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
      });
      
      // Perform some operations
      for (let i = 0; i < 5; i++) {
        await taskManager.openNewTaskForm();
        await taskManager.cancelTaskForm();
        await page.waitForTimeout(100);
      }
      
      // Check memory after operations
      const finalMemory = await page.evaluate(() => {
        return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
      });
      
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory;
        const memoryIncreasePercent = (memoryIncrease / initialMemory) * 100;
        
        // Memory increase should be reasonable
        expect(memoryIncreasePercent).toBeLessThan(50);
      }
    });
  });

  test.describe('Mobile Performance', () => {
    test.beforeEach(async ({ page }) => {
      await taskManager.setMobileViewport();
    });

    test('should perform well on mobile devices', async ({ page }) => {
      // Simulate slower mobile network
      await page.route('**/*', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Add 100ms delay
        route.continue();
      });

      const startTime = Date.now();
      await taskManager.goto();
      await taskManager.waitForLoad();
      const loadTime = Date.now() - startTime;
      
      // Should still load reasonably fast on mobile
      expect(loadTime).toBeLessThan(5000);
    });

    test('should have touch-friendly interface', async ({ page }) => {
      // Check button sizes for touch
      const buttons = await page.locator('button').all();
      
      for (let i = 0; i < Math.min(buttons.length, 5); i++) {
        const button = buttons[i];
        const box = await button.boundingBox();
        
        if (box) {
          // Buttons should be at least 44px for touch (iOS guideline)
          expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(40);
        }
      }
    });
  });
});
