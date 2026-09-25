import { expect, test } from '@playwright/test'

test('settings exposes preferences and data actions', async ({ page }) => {
  await page.goto('#/settings')

  await expect(page.getByRole('heading', { name: 'Inställningar' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Utseende' })).toBeVisible()
  await expect(page.getByLabel('Tema')).toHaveValue('light')
  await expect(page.getByLabel('Sortering')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Exportera data' })).toBeVisible()
  await expect(page.getByText('Status: Online')).toBeVisible()

  await page.getByLabel('Tema').selectOption('dark')
  await expect(page.getByLabel('Tema')).toHaveValue('dark')
})