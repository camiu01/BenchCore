/**
 * @file publishing.spec.ts
 * @brief Browser login, draft privacy, publication and global session revocation.
 */
import { expect, test } from '@playwright/test';

test('administrator publishes through real forms and revokes the session', async ({
	page,
	request
}) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.locator('#email').fill('fixture-admin');
	await page.locator('#password').fill('fixture-browser-password');
	await page.locator('form[action="?/login"] button[type="submit"]').click();
	await expect(page).toHaveURL(/\/admin$/);
	await page.goto('/admin/posts/new');
	await page.waitForLoadState('networkidle');
	await page.locator('#title').fill('Browser publishing journey');
	await expect(page.locator('#title')).toHaveValue('Browser publishing journey');
	await page.locator('#slug').fill('browser-publishing-journey');
	await expect(page.locator('#title')).toHaveValue('Browser publishing journey');
	await page.locator('#content').fill('Browser-created fixture body.');
	await expect(page.locator('#title')).toHaveValue('Browser publishing journey');
	await expect(page.locator('#slug')).toHaveValue('browser-publishing-journey');
	await page.locator('button[formaction="?/save"]').click();
	await expect(page).toHaveURL(/\/admin$/);
	const edit = await page
		.getByRole('link', { name: 'Browser publishing journey', exact: true })
		.getAttribute('href');
	expect(edit).toMatch(/^\/admin\/posts\/[a-f0-9-]+$/);
	const draft = await request.get('/posts/browser-publishing-journey');
	expect(draft.status()).toBe(404);
	await page.goto(edit ?? '');
	await page.waitForLoadState('networkidle');
	await page.locator('#status').selectOption('published');
	await page.locator('button[formaction="?/save"]').click();
	await expect(page).toHaveURL(/\/admin$/);
	const published = await request.get('/posts/browser-publishing-journey');
	expect(published.status()).toBe(200);
	expect(await published.text()).toContain('Browser-created fixture body.');
	await page.goto('/account/security');
	await page.locator('form[action="?/logoutAll"] button').click();
	await expect(page).toHaveURL(/\/login$/);
	await page.goto('/admin');
	await expect(page).toHaveURL(/\/login/);
});
