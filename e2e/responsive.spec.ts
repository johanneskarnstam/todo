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
    await expect(page.getByRole('menuitem', { name: 'Alla taggar' })).toHaveCSS('font-size', '11px')
    await expect(page.getByRole('button', { name: 'Taggar' })).not.toHaveCSS('font-size', '11px')
    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }))
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth)
  })

  test('keeps long task details within the desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 768 })
    await page.goto('/#/tasks/local-task-3')
    const releaseCloseButton = page.getByRole('button', { name: 'Jag har sett detta' })
    if (await releaseCloseButton.count()) await releaseCloseButton.click()

    const dimensions = await page.evaluate(() => {
      const shell = document.querySelector('#app > div')
      const sidebar = document.querySelector('#task-sidebar')
      const details = document.querySelector('[aria-labelledby="task-details-heading"]')
      const detailContent = details?.querySelector('.overflow-y-auto')

      return {
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        shellHeight: shell?.getBoundingClientRect().height ?? 0,
        sidebarBottom: sidebar?.getBoundingClientRect().bottom ?? 0,
        detailsBottom: details?.getBoundingClientRect().bottom ?? 0,
        detailClientHeight: detailContent?.clientHeight ?? 0,
        detailScrollHeight: detailContent?.scrollHeight ?? 0,
      }
    })

    expect(dimensions.documentHeight).toBe(dimensions.viewportHeight)
    expect(dimensions.shellHeight).toBe(dimensions.viewportHeight)
    expect(dimensions.sidebarBottom).toBe(dimensions.viewportHeight)
    expect(dimensions.detailsBottom).toBe(dimensions.viewportHeight)
    expect(dimensions.detailScrollHeight).toBeGreaterThan(dimensions.detailClientHeight)
  })
})
