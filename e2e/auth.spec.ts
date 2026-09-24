import { expect, test } from '@playwright/test'

test('mock-auth opens the app without a login step', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/todo\/#\/$/)
  await expect(page.getByRole('heading', { name: 'Att göra' })).toBeVisible()
  await expect(page.getByText('Testa dra och släppa uppgifter')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Logga in på To Do' })).toHaveCount(0)
})

test('smart views are reachable from their routes', async ({ page }) => {
  await page.goto('#/important')

  await expect(page).toHaveURL(/\/todo\/#\/important$/)
  await expect(page.getByRole('heading', { name: 'Viktigt' })).toBeVisible()
  await expect(page.getByText('Testa dra och släppa uppgifter')).toBeVisible()
})
