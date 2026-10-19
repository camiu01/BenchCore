/**
 * @file accessibility.spec.ts
 * @brief WCAG 2.1 A/AA automation across reader/admin routes, themes and narrow viewports.
 */
import { expect, test } from '@playwright/test';
import axe from 'axe-core';

declare global {
	interface Window {
		axe: typeof axe;
	}
}

const publicRoutes = [
	'/',
	'/posts',
	'/posts/accessible-engineering',
	'/posts/private-engineering',
	'/tags',
	'/tags/Engineering%20%26%20circuits',
	'/graph',
	'/about',
	'/help',
	'/privacy',
	'/cookies',
	'/login',
	'/register',
	'/forgot-password',
	'/reset-password',
	'/newsletter',
	'/newsletter/confirm',
	'/newsletter/unsubscribe',
	'/missing-fixture-page'
];
const adminRoutes = [
	'/account',
	'/account/security',
	'/admin',
	'/admin/posts/new',
	'/admin/tags',
	'/admin/categories',
	'/admin/comments',
	'/admin/users',
	'/admin/audit',
	'/admin/import',
	'/admin/newsletter',
	'/admin/posts/fixture-edit'
];

for (const theme of ['light', 'dark', 'oled']) {
	for (const route of [...publicRoutes, ...adminRoutes]) {
		test(`${theme}: ${route}`, async ({ page }) => {
			await page.setViewportSize({ width: 390, height: 844 });
			await page.addInitScript((value) => localStorage.setItem('site-theme', value), theme);
			const admin = adminRoutes.includes(route);
			if (admin) {
				const login = await page.request.post('/api/auth/login', {
					headers: { origin: 'http://127.0.0.1:5198' },
					data: { username: 'fixture-admin', password: 'fixture-browser-password' }
				});
				expect(login.status()).toBe(200);
			}
			let path = route;
			if (route === '/admin/posts/fixture-edit') {
				await page.goto('/admin');
				path = (await page.locator('a.admin-post-title').first().getAttribute('href')) ?? '';
				expect(path).toMatch(/^\/admin\/posts\/[a-f0-9-]+$/);
			}
			const response = await page.goto(path);
			expect(response?.status()).toBe(route === '/missing-fixture-page' ? 404 : 200);
			await page.evaluate(() =>
				Promise.all(document.getAnimations().map((animation) => animation.finished))
			);
			await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
			await expect(page.locator('h1')).toHaveCount(1);
			await expect(page.locator('main')).toHaveCount(1);
			const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
			expect(overflow, 'No horizontal document overflow at 390px').toBe(false);
			await page.evaluate(axe.source);
			const result = await page.evaluate(() =>
				window.axe.run(document, {
					runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
				})
			);
			expect(
				result.violations.map(({ id, nodes }) => ({
					id,
					targets: nodes.map(({ target, failureSummary }) => ({ target, failureSummary }))
				}))
			).toEqual([]);
			await page.keyboard.press('Tab');
			await expect(page.locator('.skip-link')).toBeFocused();
			await page.keyboard.press('Enter');
			await expect(page.locator('#main-content')).toBeFocused();
		});
	}
}
