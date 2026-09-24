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

test.describe('tablet layout', () => {
  test.use({ viewport: { width: 768, height: 1024 } })

  test('keeps the primary task view inside the viewport', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Jag har sett detta' }).click()

    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }))
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth)
    await expect(page.getByRole('heading', { name: 'Att göra' })).toBeVisible()
  })
})

test.describe('desktop layout', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('shows the sidebar and supports dark mode without overflow', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Jag har sett detta' }).click()

    await expect(page.getByRole('complementary', { name: 'Uppgiftsnavigering' })).toBeVisible()
    await page.getByRole('button', { name: 'Byt till mörkt läge' }).click()
    await expect(page.locator('.dark')).toBeVisible()

    await page.getByRole('button', { name: 'Taggar' }).click()
    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }))
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth)
  })
})
