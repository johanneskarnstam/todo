import { expect, test } from '@playwright/test'

test('opens search and shows live matching task results', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Jag har sett detta' }).click()

  await page.getByRole('button', { name: 'Öppna sök' }).click()
  const searchInput = page.getByRole('searchbox', { name: 'Sök uppgifter, taggar eller listor' })
  await expect(searchInput).toBeVisible()

  await searchInput.fill('mobil')

  await expect(page).toHaveURL(/\/search\?q=mobil$/)
  await expect(page.getByRole('heading', { name: 'Resultat för “mobil”' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Uppgifter' })).toBeVisible()
  await expect(page.getByText('Kontrollera mobilvyn', { exact: true })).toBeVisible()
})

test('search can find a list and close back to the task view', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Jag har sett detta' }).click()
  await page.getByRole('button', { name: 'Öppna sök' }).click()

  await page.getByRole('searchbox', { name: 'Sök uppgifter, taggar eller listor' }).fill('Projekt')
  await expect(page.getByRole('heading', { name: 'Listor' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Projekt', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Stäng sök' }).click()
  await expect(page).toHaveURL(/\/todo\/#\/$/)
  await expect(page.getByRole('heading', { name: 'Att göra' })).toBeVisible()
})

test('persists the selected theme after reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Jag har sett detta' }).click()

  await page.getByRole('button', { name: 'Byt till mörkt läge' }).click()
  await expect(page.getByRole('button', { name: 'Byt till ljust läge' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: 'Byt till ljust läge' })).toBeVisible()
})
