import { expect, test } from '@playwright/test'

test('creates a task in the active list', async ({ page }) => {
  await page.goto('/')

  const title = `E2E-task-${Date.now()}`
  await page.getByPlaceholder('Lägg till en uppgift').fill(title)
  await page.getByPlaceholder('Lägg till en uppgift').press('Enter')

  await expect(page.getByRole('group', { name: `Uppgift: ${title}` })).toBeVisible()
})

test('opens task details from a task row', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' }).click()

  await expect(page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })).toBeVisible()
})
