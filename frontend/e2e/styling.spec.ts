/**
 * @file styling.spec.ts
 * @brief Shared CSS customization, narrow layouts and motion regression checks.
 */
import { expect, test } from '@playwright/test';

test('customization layer overrides shared selectors and inherited tokens', async ({ page }) => {
	await page.route('**/css-customization-test.css', (route) =>
		route.fulfill({
			contentType: 'text/css',
			body: `@layer customization {
			:root { --sheet-width: 800px; --record-padding: 28px; }
			.record-title { text-transform: none; }
		}`
		})
	);
	await page.goto('/posts');
	await page.evaluate(() => {
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '/css-customization-test.css';
		document.head.append(link);
	});
	await expect(page.locator('.wrapper')).toHaveCSS('max-width', '800px');
	await expect(page.locator('.record').first()).toHaveCSS('padding-top', '28px');
	await expect(page.locator('.record-title').first()).toHaveCSS('text-transform', 'none');
});

for (const width of [320, 390, 768, 1280]) {
	test(`shared layout and controls fit at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/posts');
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
		expect(overflow).toBe(false);
		await expect(page.locator('.theme-btn').first()).toHaveCSS('min-height', '44px');
		await expect(page.locator('.wrapper')).toHaveCSS('animation-name', 'none');
		await page.screenshot({ path: `../artifacts/css-${width}-light.png`, fullPage: true });
		await page.getByRole('button', { name: 'dark', exact: true }).click();
		await expect(page.locator('.theme-picker .theme-btn.active')).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		await page.screenshot({ path: `../artifacts/css-${width}-dark.png`, fullPage: true });
	});
}
