import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

test('opens and closes the sidebar on mobile', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Jag har sett detta' }).click()

  const sidebar = page.getByRole('complementary', { name: 'Uppgiftsnavigering' })
  await expect(page.getByRole('button', { name: 'Öppna navigeringsmeny' })).toBeVisible()
  await expect(sidebar).toBeHidden()

  await page.getByRole('button', { name: 'Öppna navigeringsmeny' }).click()
  await expect(sidebar).toBeVisible()
  await expect(sidebar.getByRole('button', { name: 'Stäng navigeringsmeny' })).toBeVisible()

  await sidebar.getByRole('button', { name: 'Stäng navigeringsmeny' }).click()
  await expect(sidebar).toBeHidden()
  await expect(page.locator('[data-sidebar-overlay]')).toHaveCount(0)
})

test('opens and closes task details as a mobile panel', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Jag har sett detta' }).click()
  await page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' }).click()

  const details = page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })
  await expect(details).toBeVisible()
  await details.getByRole('button', { name: 'Stäng' }).click()
  await expect(details).toHaveCount(0)
})
