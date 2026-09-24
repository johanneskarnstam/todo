import { expect, test, type Page } from '@playwright/test'

const dismissReleaseNotes = async (page: Page) => {
  const closeButton = page.getByRole('button', { name: 'Jag har sett detta' })
  if (await closeButton.count()) await closeButton.click()
}

test('creates a list and selects it', async ({ page }) => {
  await page.goto('/')
  await dismissReleaseNotes(page)

  await page.getByRole('button', { name: 'Ny lista' }).click()
  await page.getByPlaceholder('Listnamn').fill('Helgprojekt')
  await page.getByPlaceholder('Listnamn').press('Enter')

  await expect(page.getByRole('heading', { name: 'Helgprojekt' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Flytta Helgprojekt' })).toBeVisible()
})

test('creates a folder and moves a list into it', async ({ page }) => {
  await page.goto('/')
  await dismissReleaseNotes(page)

  await page.getByRole('button', { name: 'Ny lista' }).click()
  await page.getByPlaceholder('Listnamn').fill('Reselista')
  await page.getByPlaceholder('Listnamn').press('Enter')

  await page.getByRole('button', { name: 'Ny mapp' }).click()
  await page.getByPlaceholder('Mappnamn').fill('Semester')
  await page.getByPlaceholder('Mappnamn').press('Enter')

  await page.getByRole('button', { name: 'Flytta Reselista' }).click()
  await page.getByRole('menuitem', { name: 'Semester' }).click()

  await page.getByRole('button', { name: 'Semester' }).click()
  await expect(page.getByRole('button', { name: 'Reselista', exact: true })).toBeVisible()
})

test('changes the selected list theme', async ({ page }) => {
  await page.goto('/')
  await dismissReleaseNotes(page)

  await page.getByRole('button', { name: 'Ny lista' }).click()
  await page.getByPlaceholder('Listnamn').fill('Färgtest')
  await page.getByPlaceholder('Listnamn').press('Enter')

  await page.getByRole('button', { name: 'Fler listalternativ' }).click()
  await page.getByRole('button', { name: 'Använd listfärg #107c10' }).click()
  await expect(page.getByRole('heading', { name: 'Färgtest' })).toHaveCSS('color', 'rgb(16, 124, 16)')
})

test('renames a list and a folder', async ({ page }) => {
  await page.goto('/')
  await dismissReleaseNotes(page)

  await page.getByRole('button', { name: 'Ny lista' }).click()
  await page.getByPlaceholder('Listnamn').fill('Gammal lista')
  await page.getByPlaceholder('Listnamn').press('Enter')
  await page.getByRole('button', { name: 'Fler listalternativ' }).click()
  await page.getByRole('button', { name: 'Byt namn på lista' }).click()
  await page.getByLabel('Byt namn på lista').fill('Ny lista')
  await page.getByLabel('Byt namn på lista').press('Enter')
  await expect(page.getByRole('heading', { name: 'Ny lista' })).toBeVisible()

  await page.getByRole('button', { name: 'Ny mapp' }).click()
  await page.getByPlaceholder('Mappnamn').fill('Gammal mapp')
  await page.getByPlaceholder('Mappnamn').press('Enter')
  const folderHeader = page.locator('[data-folder-header]').filter({ hasText: 'Gammal mapp' })
  await folderHeader.click({ button: 'right' })
  await folderHeader.getByRole('button', { name: 'Byt namn på mapp' }).click()
  await page.getByLabel('Byt namn på mapp').fill('Ny mapp')
  await page.getByLabel('Byt namn på mapp').press('Enter')
  await expect(page.locator('[data-folder-header]').filter({ hasText: 'Ny mapp' })).toBeVisible()
})

test('deletes a selected list through its confirmation dialog', async ({ page }) => {
  await page.goto('/')
  await dismissReleaseNotes(page)

  await page.getByRole('button', { name: 'Ny lista' }).click()
  await page.getByPlaceholder('Listnamn').fill('Ta bort mig')
  await page.getByPlaceholder('Listnamn').press('Enter')
  await page.getByRole('button', { name: 'Fler listalternativ' }).click()
  await page.getByRole('button', { name: 'Ta bort lista' }).click()

  const confirmation = page.getByRole('dialog', { name: 'Ta bort lista?' })
  await confirmation.getByRole('button', { name: 'Ta bort lista' }).click()
  await expect(page.getByRole('heading', { name: 'Ta bort mig' })).toHaveCount(0)
})

test('opens settings and returns to the task list', async ({ page }) => {
  await page.goto('/')
  await dismissReleaseNotes(page)

  await page.getByRole('link', { name: 'Inställningar' }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByRole('heading', { name: 'Inställningar' })).toBeVisible()

  await page.getByRole('link', { name: 'To Do' }).click()
  await expect(page).toHaveURL(/\/todo\/#\/$/)
  await expect(page.getByRole('heading', { name: 'Att göra' })).toBeVisible()
})
