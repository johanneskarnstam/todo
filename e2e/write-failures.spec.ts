import { expect, test, type Page } from '@playwright/test'
import { failNextTaskRead, failNextWrite } from './helpers/failureInjection'

const dismissReleaseNotes = async (page: Page) => {
  const closeButton = page.getByRole('button', { name: 'Jag har sett detta' })
  if (await closeButton.count()) await closeButton.click()
}

const dismissFailureToast = async (page: Page, operation: string) => {
  await page.locator('[aria-live="polite"]').getByRole('alert')
    .filter({ hasText: `Simulated write failure: ${operation}` })
    .getByRole('button', { name: 'Stäng meddelande' })
    .click()
}

const navigateToProjectList = async (page: Page) => {
  const sidebarToggle = page.getByRole('button', { name: 'Öppna navigeringsmeny' })
  if (await sidebarToggle.isVisible()) await sidebarToggle.click()

  await page.getByRole('button', { name: /^Projekt/ }).click()
  await expect(page).toHaveURL(/\/#\/lists\/local-projects$/)
  await expect(page.getByRole('heading', { name: 'Projekt', exact: true })).toBeVisible()
}

test('rolls back a failed task create and continues navigation after recovery', async ({ page }) => {
  await failNextWrite(page, 'create-task')
  await page.goto('/')
  await dismissReleaseNotes(page)

  const failedTitle = 'Uppgift som inte ska sparas'
  const taskInput = page.getByPlaceholder('Lägg till en uppgift')
  await taskInput.fill(failedTitle)
  await taskInput.press('Enter')

  await expect(page.locator('[aria-live="polite"]').getByRole('alert')
    .filter({ hasText: 'Simulated write failure: create-task' })).toBeVisible()
  await expect(page.getByRole('group', { name: `Uppgift: ${failedTitle}` })).toHaveCount(0)

  await dismissFailureToast(page, 'create-task')
  const recoveredTitle = 'Uppgift skapad efter återhämtning'
  await taskInput.fill(recoveredTitle)
  await taskInput.press('Enter')
  await expect(page.getByRole('group', { name: `Uppgift: ${recoveredTitle}` })).toBeVisible()

  await navigateToProjectList(page)
})

test('rolls back a failed task update and allows a later update', async ({ page }) => {
  await failNextWrite(page, 'update-task')
  await page.goto('/')
  await dismissReleaseNotes(page)

  const task = page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' })
  await task.getByRole('button', { name: 'Markera uppgift som slutförd' }).click()

  await expect(page.locator('[aria-live="polite"]').getByRole('alert')
    .filter({ hasText: 'Simulated write failure: update-task' })).toBeVisible()
  await expect(task.getByRole('button', { name: 'Markera uppgift som slutförd' })).toBeVisible()

  await dismissFailureToast(page, 'update-task')
  await task.getByRole('button', { name: 'Markera uppgift som slutförd' }).click()
  await expect(task.getByRole('button', { name: 'Markera uppgift som aktiv' })).toBeVisible()

  await navigateToProjectList(page)
})

test('loads cached tasks after a controlled task read failure', async ({ page }) => {
  await failNextTaskRead(page)
  await page.goto('/')
  await dismissReleaseNotes(page)

  await expect(page.getByRole('heading', { name: 'Att göra', exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Uppgift: Uppgift från lokal cache' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' })).toHaveCount(0)

  await navigateToProjectList(page)
})

test('rolls back a failed list create and recovers on the next write', async ({ page }) => {
  await failNextWrite(page, 'create-list')
  await page.goto('/')
  await dismissReleaseNotes(page)

  await page.getByRole('button', { name: 'Ny lista' }).click()
  const listInput = page.getByPlaceholder('Listnamn')
  await listInput.fill('Lista som inte ska sparas')
  await listInput.press('Enter')

  await expect(page.locator('[aria-live="polite"]').getByRole('alert')
    .filter({ hasText: 'Simulated write failure: create-list' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Lista som inte ska sparas' })).toHaveCount(0)
  await expect(page).toHaveURL(/\/#\/$/)
  await expect(page.getByRole('heading', { name: 'Att göra', exact: true })).toBeVisible()

  await dismissFailureToast(page, 'create-list')
  await page.getByRole('button', { name: 'Ny lista' }).click()
  await page.getByPlaceholder('Listnamn').fill('Lista efter återhämtning')
  await page.getByPlaceholder('Listnamn').press('Enter')
  await expect(page.getByRole('heading', { name: 'Lista efter återhämtning', exact: true })).toBeVisible()

  await navigateToProjectList(page)
})

test('rolls back a failed list update and continues after recovery', async ({ page }) => {
  await failNextWrite(page, 'update-list')
  await page.goto('/')
  await dismissReleaseNotes(page)

  await page.getByRole('button', { name: 'Ny lista' }).click()
  await page.getByPlaceholder('Listnamn').fill('Lista före fel')
  await page.getByPlaceholder('Listnamn').press('Enter')
  await expect(page.getByRole('heading', { name: 'Lista före fel', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Fler listalternativ' }).click()
  await page.getByRole('button', { name: 'Byt namn på lista' }).click()
  await page.getByLabel('Listnamn').fill('Misslyckat namnbyte')
  await page.getByLabel('Listnamn').press('Enter')

  await expect(page.locator('[aria-live="polite"]').getByRole('alert')
    .filter({ hasText: 'Simulated write failure: update-list' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Lista före fel', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Misslyckat namnbyte', exact: true })).toHaveCount(0)

  await dismissFailureToast(page, 'update-list')
  await page.getByRole('button', { name: 'Fler listalternativ' }).click()
  await page.getByRole('button', { name: 'Byt namn på lista' }).click()
  await page.getByLabel('Listnamn').fill('Lyckat namnbyte')
  await page.getByLabel('Listnamn').press('Enter')
  await expect(page.getByRole('heading', { name: 'Lyckat namnbyte', exact: true })).toBeVisible()

  await navigateToProjectList(page)
})
