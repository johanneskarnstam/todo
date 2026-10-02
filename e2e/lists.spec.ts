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
  await expect(page).toHaveURL(/\/#\/lists\/[^/]+$/)
  await expect(page.getByRole('button', { name: 'Flytta Helgprojekt' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Helgprojekt' })).toBeVisible()
  await page.getByRole('button', { name: /^Att göra/ }).click()
  await expect(page).toHaveURL(/\/#\/lists\/__default__$/)
  await expect(page.getByRole('heading', { name: 'Att göra', exact: true })).toBeVisible()
})

test('opens a list directly from its URL and restores it after reload', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/#/lists/local-projects')
  await dismissReleaseNotes(page)

  await expect(page.getByRole('heading', { name: 'Byt namn på listan Projekt' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Uppgift: Förbered nästa release' })).toBeVisible()
  await page.getByRole('button', { name: 'Fler listalternativ' }).click()
  await page.getByRole('button', { name: 'Kopiera listlänk' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Listlänk kopierad.' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(new URL(page.url()).href)

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Projekt' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Uppgift: Förbered nästa release' })).toBeVisible()
})

test('reports when the browser refuses to copy a list link', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => { throw new Error('clipboard denied') } },
    })
  })
  await page.goto('/#/lists/local-projects')
  await dismissReleaseNotes(page)

  await page.getByRole('button', { name: 'Fler listalternativ' }).click()
  await page.getByRole('button', { name: 'Kopiera listlänk' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Länken kunde inte kopieras.' })).toBeVisible()
})

test('copies a list link from the All Lists columns', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/#/all-lists')
  await dismissReleaseNotes(page)

  await page.getByRole('button', { name: 'Kopiera länk till listan Projekt' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Listlänk kopierad.' })).toBeVisible()
  const copiedUrl = await page.evaluate(() => navigator.clipboard.readText())

  await page.goto(copiedUrl)
  await expect(page).toHaveURL(/\/#\/lists\/local-projects$/)
  await expect(page.getByRole('heading', { name: 'Byt namn på listan Projekt' })).toBeVisible()
})

test('returns to a shared list after an authenticated login route', async ({ page }) => {
  await page.goto('/#/login?redirect=%2Flists%2Flocal-projects')

  await expect(page).toHaveURL(/\/#\/lists\/local-projects$/)
  await expect(page.getByRole('heading', { name: 'Projekt' })).toBeVisible()
})

test('shows a not-found state for an unknown list URL', async ({ page }) => {
  await page.goto('/#/lists/missing-list-id')
  await dismissReleaseNotes(page)

  await expect(page.getByRole('alert')).toContainText('Listan hittades inte')
  await expect(page).toHaveURL(/\/#\/lists\/missing-list-id$/)
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

test('changes the selected list theme from its settings', async ({ page }) => {
  await page.goto('/')
  await dismissReleaseNotes(page)

  await page.getByRole('button', { name: 'Ny lista' }).click()
  await page.getByPlaceholder('Listnamn').fill('Färgtest')
  await page.getByPlaceholder('Listnamn').press('Enter')

  await page.getByRole('button', { name: 'Fler listalternativ' }).click()
  await page.getByRole('button', { name: 'Listinställningar' }).click()
  await page.getByRole('button', { name: 'Använd listfärg #107c10' }).click()
  await expect(page.getByRole('status')).toContainText('Listfärgen har sparats.')
  await page.getByRole('button', { name: 'Tillbaka till listan' }).click()
  await expect(page.getByRole('heading', { name: 'Färgtest' })).toHaveCSS('color', 'rgb(16, 124, 16)')
})

test('configures list sorting and a three-step task workflow', async ({ page }) => {
  await page.goto('/')
  await dismissReleaseNotes(page)

  await page.getByRole('button', { name: 'Ny lista' }).click()
  await page.getByPlaceholder('Listnamn').fill('Arbetsflöde')
  await page.getByPlaceholder('Listnamn').press('Enter')

  await page.getByRole('button', { name: 'Fler listalternativ' }).click()
  await page.getByRole('button', { name: 'Listinställningar' }).click()
  await expect(page).toHaveURL(/\/lists\/[^/]+\/settings$/)

  await expect(page.locator('#list-sort-mode')).toContainText('Min ordning')
  await expect(page.getByLabel('Nya uppgifter överst')).toBeChecked()
  await expect(page.getByLabel('Visa slutförda uppgifter')).toBeChecked()
  await expect(page.getByLabel('Arkivera slutförda automatiskt')).not.toBeChecked()
  await expect(page.getByLabel('Bekräfta innan uppgifter tas bort')).toBeChecked()
  await expect(page.getByLabel('Visa delsteg direkt')).toHaveCount(0)
  await page.getByRole('button', { name: 'Använd listikon Stjärna' }).click()
  await expect(page.getByRole('status')).toContainText('Inställningen har sparats.')
  await page.locator('#list-sort-mode').click()
  await page.getByRole('option', { name: 'Prioritet' }).click()
  await expect(page.getByLabel('Nya uppgifter överst')).toBeDisabled()
  await expect(page.getByRole('status')).toContainText('Sorteringen har sparats.')
  await page.getByLabel('Arbetsflöde').click()
  await page.getByRole('option', { name: 'Att göra, pågående eller klart' }).click()
  await expect(page.getByRole('status')).toContainText('Arbetsflödet har sparats.')

  await page.getByRole('button', { name: 'Tillbaka till listan' }).click()
  await expect(page.getByRole('heading', { name: 'Arbetsflöde' })).toBeVisible()
  await expect(page.getByText('Sorterad efter Prioritet. Dra och släpp är avstängt.')).toBeVisible()

  const taskTitle = 'Pågående arbetsuppgift'
  await page.getByPlaceholder('Lägg till en uppgift').fill(taskTitle)
  await page.getByPlaceholder('Lägg till en uppgift').press('Enter')
  const task = page.getByRole('group', { name: `Uppgift: ${taskTitle}` })
  const statusButton = task.getByRole('checkbox', { name: 'Markera uppgift som pågående' })
  await statusButton.click()
  await expect(task.getByRole('checkbox', { name: 'Markera uppgift som klar' })).toHaveAttribute('aria-checked', 'mixed')

  await page.reload()
  await page.goto('/')
  await page.getByRole('button', { name: /^Arbetsflöde/ }).click()
  await expect(page.getByRole('group', { name: `Uppgift: ${taskTitle}` }).getByRole('checkbox', { name: 'Markera uppgift som klar' })).toHaveAttribute('aria-checked', 'mixed')
})

test('confirms converting in-progress tasks to the two-step workflow', async ({ page }) => {
  await page.goto('/')
  await dismissReleaseNotes(page)

  await page.getByRole('button', { name: 'Ny lista' }).click()
  await page.getByPlaceholder('Listnamn').fill('Statusbyte')
  await page.getByPlaceholder('Listnamn').press('Enter')
  await page.getByRole('button', { name: 'Fler listalternativ' }).click()
  await page.getByRole('button', { name: 'Listinställningar' }).click()
  await page.getByLabel('Arbetsflöde').click()
  await page.getByRole('option', { name: 'Att göra, pågående eller klart' }).click()
  await page.getByRole('button', { name: 'Tillbaka till listan' }).click()

  const taskTitle = 'Pågående inför statusbyte'
  await page.getByPlaceholder('Lägg till en uppgift').fill(taskTitle)
  await page.getByPlaceholder('Lägg till en uppgift').press('Enter')
  const task = page.getByRole('group', { name: `Uppgift: ${taskTitle}` })
  await task.getByRole('checkbox', { name: 'Markera uppgift som pågående' }).click()

  await page.getByRole('button', { name: 'Fler listalternativ' }).click()
  await page.getByRole('button', { name: 'Listinställningar' }).click()
  const workflow = page.getByLabel('Arbetsflöde')
  await workflow.click()
  await page.getByRole('option', { name: 'Att göra eller klart' }).click()

  let confirmation = page.getByRole('dialog', { name: 'Byta arbetsflöde?' })
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole('button', { name: 'Avbryt' }).click()
  await expect(workflow).toContainText('Att göra, pågående eller klart')

  await workflow.click()
  await page.getByRole('option', { name: 'Att göra eller klart' }).click()
  confirmation = page.getByRole('dialog', { name: 'Byta arbetsflöde?' })
  await confirmation.getByRole('button', { name: 'Fortsätt' }).click()
  await expect(page.getByRole('status')).toContainText('Arbetsflödet har sparats.')

  await page.getByRole('button', { name: 'Tillbaka till listan' }).click()
  await expect(task.getByRole('button', { name: 'Markera uppgift som slutförd' })).toBeVisible()
})

test('archives completed tasks and restores them from the Archived view', async ({ page }) => {
  await page.goto('/')
  await dismissReleaseNotes(page)

  await page.getByRole('button', { name: 'Fler listalternativ' }).click()
  await page.getByRole('button', { name: 'Listinställningar' }).click()
  await page.getByLabel('Arkivera slutförda automatiskt').click()
  await page.getByRole('button', { name: 'Tillbaka till listan' }).click()

  const task = page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' })
  await task.getByRole('button', { name: 'Markera uppgift som slutförd' }).click()
  await expect(task).toHaveCount(0)

  await page.getByRole('button', { name: /^Arkiverade/ }).click()
  const archivedTask = page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' })
  await expect(archivedTask).toBeVisible()
  await archivedTask.getByRole('button', { name: 'Markera uppgift som aktiv' }).click()
  await expect(archivedTask).toHaveCount(0)
})

test('renames a list and a folder', async ({ page }) => {
  await page.goto('/')
  await dismissReleaseNotes(page)

  await page.getByRole('button', { name: 'Ny lista' }).click()
  await page.getByPlaceholder('Listnamn').fill('Gammal lista')
  await page.getByPlaceholder('Listnamn').press('Enter')
  await page.getByRole('button', { name: 'Byt namn på listan Gammal lista' }).click()
  await page.getByLabel('Listnamn').fill('Ny lista')
  await page.getByLabel('Listnamn').press('Enter')
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

test('protects the default Att göra list from renaming and deletion', async ({ page }) => {
  await page.goto('/')
  await dismissReleaseNotes(page)

  const heading = page.getByRole('heading', { name: 'Att göra' })
  await expect(heading.getByRole('button')).toHaveCount(0)
  await page.getByRole('button', { name: 'Fler listalternativ' }).click()
  await expect(page.getByRole('button', { name: 'Byt namn på lista' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ta bort lista' })).toHaveCount(0)
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

test('closes a sidebar list menu outside click and deletes from the menu', async ({ page }) => {
  await page.goto('/')
  await dismissReleaseNotes(page)

  await page.getByRole('button', { name: 'Ny lista' }).click()
  await page.getByPlaceholder('Listnamn').fill('Sidomenytest')
  await page.getByPlaceholder('Listnamn').press('Enter')

  const menuTrigger = page.getByRole('button', { name: 'Flytta Sidomenytest' })
  await menuTrigger.click()
  const listMenu = page.getByRole('menu', { name: 'Hantera lista Sidomenytest' })
  await expect(listMenu).toBeVisible()

  await page.getByRole('heading', { name: 'Sidomenytest' }).click()
  await expect(listMenu).toHaveCount(0)

  await menuTrigger.click()
  await page.getByRole('menuitem', { name: 'Ta bort Sidomenytest' }).click()
  const confirmation = page.getByRole('dialog', { name: 'Ta bort lista?' })
  await confirmation.getByRole('button', { name: 'Ta bort lista' }).click()
  await expect(page.getByRole('heading', { name: 'Sidomenytest' })).toHaveCount(0)
})

test('opens settings and returns to the task list', async ({ page }) => {
  await page.goto('/')
  await dismissReleaseNotes(page)

  await expect(page.getByRole('link', { name: 'Inställningar', exact: true })).toHaveCount(0)
  const footerSettingsLink = page.getByRole('link', { name: 'Öppna inställningar' })
  await expect(footerSettingsLink).toBeVisible()
  await footerSettingsLink.click()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByRole('heading', { name: 'Inställningar' })).toBeVisible()

  await page.getByRole('link', { name: 'To Do' }).click()
  await expect(page).toHaveURL(/\/todo\/#\/$/)
  await expect(page.getByRole('heading', { name: 'Att göra', exact: true })).toBeVisible()
})

test('opens the overview of all folders and lists', async ({ page }) => {
  await page.goto('/')
  await dismissReleaseNotes(page)

  const allListsLink = page.getByRole('link', { name: 'Alla listor' })
  await expect(allListsLink).toHaveCSS('font-size', '16px')
  await allListsLink.click()
  await expect(page).toHaveURL(/\/all-lists$/)
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.getByRole('banner').getByRole('link', { name: 'Till startsidan' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Alla listor' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Listöversikt' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Utan mapp' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Att göra', exact: true })).toBeVisible()

  await page.getByRole('link', { name: 'Tillbaka till uppgifter' }).click()
  await expect(page).toHaveURL(/\/todo\/#\/$/)
  await expect(page.getByRole('heading', { name: 'Att göra', exact: true })).toBeVisible()
})

test('shows responsive list columns with horizontal scrolling on large screens', async ({ page }) => {
  await page.goto('/')
  await dismissReleaseNotes(page)

  const completedTask = page.getByRole('group', { name: 'Uppgift: Testa dra och släppa uppgifter' })
  await completedTask.getByRole('button', { name: 'Markera uppgift som slutförd' }).click()

  for (let index = 1; index <= 5; index += 1) {
    await page.getByRole('button', { name: 'Ny lista' }).click()
    await page.getByPlaceholder('Listnamn').fill(`Översiktslista ${index}`)
    await page.getByPlaceholder('Listnamn').press('Enter')
  }

  await page.getByRole('button', { name: 'Ny mapp' }).click()
  await page.getByPlaceholder('Mappnamn').fill('Översiktsmapp')
  await page.getByPlaceholder('Mappnamn').press('Enter')
  await page.getByRole('button', { name: 'Flytta Översiktslista 1' }).click()
  await page.getByRole('menuitem', { name: 'Översiktsmapp' }).click()

  await page.setViewportSize({ width: 1023, height: 800 })
  await page.goto('/#/all-lists')
  await expect(page.getByRole('button', { name: 'Att göra', exact: true })).toBeVisible()

  await page.setViewportSize({ width: 1024, height: 800 })
  const board = page.getByRole('region', { name: 'Listöversikt' })
  await expect(board).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Översiktsmapp' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Översiktslista 1', exact: true })).toBeVisible()
  await expect(page.getByText('Kontrollera mobilvyn', { exact: true })).toBeVisible()
  await expect(page.getByText('Förbered nästa release', { exact: true })).toBeVisible()
  const emptyList = page.getByRole('heading', { name: 'Översiktslista 2', exact: true }).locator('..')
  const emptyCompletedToggle = emptyList.getByRole('button', { name: 'Dölj slutförda uppgifter i Översiktslista 2' })
  await expect(emptyCompletedToggle).toBeVisible()
  await expect(emptyCompletedToggle).toContainText('Slutförda (0)')
  await expect(emptyCompletedToggle).toHaveCSS('font-size', '12px')
  await expect(emptyCompletedToggle).toHaveCSS('text-transform', 'none')
  await emptyCompletedToggle.click()
  await expect(emptyList.getByRole('button', { name: 'Visa slutförda uppgifter i Översiktslista 2' })).toBeVisible()

  const quickAdd = emptyList.getByRole('textbox', { name: 'Lägg till uppgift i Översiktslista 2' })
  await quickAdd.fill('Uppgift skapad från översikt')
  await quickAdd.press('Enter')
  await expect(emptyList.getByRole('group', { name: 'Uppgift: Uppgift skapad från översikt' })).toBeVisible()
  const anotherList = page.getByRole('heading', { name: 'Översiktslista 3', exact: true }).locator('..')
  await expect(anotherList.getByRole('group', { name: 'Uppgift: Uppgift skapad från översikt' })).toHaveCount(0)
  await quickAdd.fill('Uppgift skapad med plus')
  await emptyList.getByRole('button', { name: 'Lägg till uppgift i Översiktslista 2' }).click()
  await expect(emptyList.getByRole('group', { name: 'Uppgift: Uppgift skapad med plus' })).toBeVisible()

  const todoList = page.getByRole('heading', { name: 'Att göra', exact: true }).locator('..')
  const completedToggle = todoList.getByRole('button', { name: /slutförda uppgifter i Att göra/ })
  await expect(completedToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(completedToggle).toContainText('Slutförda (1)')

  const activeTask = page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' })
  await activeTask.getByRole('button', { name: 'Markera uppgift som slutförd' }).click()
  await expect(activeTask.getByRole('button', { name: 'Markera uppgift som aktiv' })).toBeVisible()
  await expect(completedToggle).toContainText('Slutförda (2)')

  await page.getByRole('group', { name: 'Uppgift: Förbered nästa release' }).click()
  const details = page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })
  await expect(details).toBeVisible()
  const titleInput = details.getByLabel('Uppgiftens titel')
  await titleInput.fill('Förbered kommande release')
  await titleInput.press('Enter')
  await expect(page.getByRole('group', { name: 'Uppgift: Förbered kommande release' })).toBeVisible()
  await expect(page).toHaveURL(/\/#\/tasks\/local-task-3$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/todo\/#\/all-lists$/)
  await expect(board).toBeVisible()
  await page.goForward()
  await expect(page).toHaveURL(/\/#\/tasks\/local-task-3$/)
  await expect(page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })).toBeVisible()
  await page.goBack()
  await expect(board).toBeVisible()
  await expect.poll(() => board.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)

  await page.reload()
  await expect(page.getByRole('region', { name: 'Listöversikt' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Översiktslista 5', exact: true })).toBeVisible()

  await page.setViewportSize({ width: 1023, height: 400 })
  await expect(page.getByRole('button', { name: /^Att göra/ })).toBeVisible()
  const mobileMain = page.getByRole('main')
  await mobileMain.evaluate((element) => { element.scrollTop = element.scrollHeight })
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(board).toBeHidden()
})

test('creates a list directly inside a folder', async ({ page }) => {
  await page.goto('/')
  await dismissReleaseNotes(page)

  await page.getByRole('button', { name: 'Ny mapp' }).click()
  await page.getByPlaceholder('Mappnamn').fill('Mapp Direkt')
  await page.getByPlaceholder('Mappnamn').press('Enter')

  const folderHeader = page.locator('[data-folder-header]').filter({ hasText: 'Mapp Direkt' })
  await expect(folderHeader).toBeVisible()
  const folderSection = folderHeader.locator('..')
  await folderSection.getByRole('button', { name: /Ny lista/ }).click()

  await folderSection.getByPlaceholder('Listnamn').fill('Direktlistan')
  await folderSection.getByPlaceholder('Listnamn').press('Enter')

  await expect(page.getByRole('heading', { name: 'Direktlistan' })).toBeVisible()
  await expect(folderSection.getByRole('button', { name: 'Direktlistan', exact: true })).toBeVisible()
})
