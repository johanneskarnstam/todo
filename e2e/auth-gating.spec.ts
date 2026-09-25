import { expect, test } from '@playwright/test'

test('redirects unauthenticated users from private routes to login', async ({ page }) => {
  for (const route of ['/', '/my-day', '/important', '/planned']) {
    await page.goto(`#${route}`)

    await expect(page).toHaveURL(/\/todo\/#\/login$/)
    await expect(page.getByRole('heading', { name: 'Logga in på To Do' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Att göra' })).toHaveCount(0)
  }
})

test('keeps public auth routes accessible without a user', async ({ page }) => {
  await page.goto('#/register')

  await expect(page).toHaveURL(/\/todo\/#\/register$/)
  await expect(page.getByRole('heading', { name: 'Skapa ditt konto' })).toBeVisible()
})