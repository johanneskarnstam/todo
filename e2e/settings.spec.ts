import { expect, test } from '@playwright/test'

test('settings exposes preferences and data actions', async ({ page }) => {
  await page.goto('#/settings')

  await expect(page.getByRole('heading', { name: 'Inställningar', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Utseende' })).toBeVisible()
  await expect(page.getByLabel('Tema')).toHaveValue('light')
  await expect(page.getByText('Sortering och arbetsflöde ställs in per lista.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Exportera data' })).toBeVisible()
  await expect(page.getByText('Online', { exact: true })).toBeVisible()

  await page.getByLabel('Tema').selectOption('dark')
  await expect(page.getByLabel('Tema')).toHaveValue('dark')
})
