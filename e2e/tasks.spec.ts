import { expect, test, type Page } from '@playwright/test'

const dismissReleaseNotes = async (page: Page) => {
  const closeButton = page.getByRole('button', { name: 'Jag har sett detta' })
  if (await closeButton.count()) await closeButton.click()
}

test('creates a task in the active list', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Jag har sett detta' }).click()

  const title = `E2E-task-${Date.now()}`
  await page.getByPlaceholder('Lägg till en uppgift').fill(title)
  await page.getByPlaceholder('Lägg till en uppgift').press('Enter')

  await expect(page.getByRole('group', { name: `Uppgift: ${title}` })).toBeVisible()
})

test('truncates long task titles with an ellipsis on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const releaseCloseButton = page.getByRole('button', { name: 'Jag har sett detta' })
  if (await releaseCloseButton.count()) await releaseCloseButton.click()

  const title = 'En ovanligt lång uppgiftstitel som fortsätter utanför skärmens bredd'
  await page.getByPlaceholder('Lägg till en uppgift').fill(title)
  await page.getByPlaceholder('Lägg till en uppgift').press('Enter')

  const titleText = page.getByRole('group', { name: `Uppgift: ${title}` }).locator('[data-task-title]')
  await expect(titleText).toBeVisible()
  await expect(titleText).toHaveText(title)
  const textLayout = await titleText.evaluate((element) => ({
    clientWidth: element.clientWidth,
    overflow: getComputedStyle(element).overflow,
    scrollWidth: element.scrollWidth,
    textOverflow: getComputedStyle(element).textOverflow,
    whiteSpace: getComputedStyle(element).whiteSpace,
  }))

  expect(textLayout.scrollWidth).toBeGreaterThan(textLayout.clientWidth)
  expect(textLayout.overflow).toBe('hidden')
  expect(textLayout.textOverflow).toBe('ellipsis')
  expect(textLayout.whiteSpace).toBe('nowrap')
})

test('opens task details from a task row', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Jag har sett detta' }).click()

  await page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' }).click()

  const details = page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })
  await expect(details).toBeVisible()
  await expect(page).toHaveURL(/\/#\/tasks\/local-task-2$/)
  await expect(details.getByLabel('Uppgiftens titel')).not.toBeFocused()
  await expect(details.getByRole('heading', { name: 'Taggar' })).toBeVisible()
  await expect(details.getByRole('heading', { name: 'Delsteg' })).toBeVisible()
  await expect(details.getByRole('heading', { name: 'Planering' })).toBeVisible()
  await expect(details.getByRole('heading', { name: 'Anteckningar' })).toBeVisible()

  const planningLabels = [
    details.getByRole('button', { name: /Min dag/ }).locator('span').first(),
    details.getByText('Förfallodatum', { exact: true }),
    details.getByText('Förfallotid', { exact: true }),
    details.getByText('Påminnelser', { exact: true }),
  ]
  const planningFontSizes = await Promise.all(planningLabels.map((label) => label.evaluate((element) => getComputedStyle(element).fontSize)))
  expect(new Set(planningFontSizes).size).toBe(1)
  const typeScale = await Promise.all([
    details.getByRole('heading', { name: 'Planering' }),
    details.getByRole('button', { name: 'Idag' }),
    details.getByText('Små bokstäver används; mellanslag blir bindestreck.', { exact: true }),
    details.getByLabel('Uppgiftens titel'),
  ].map((element) => element.evaluate((node) => getComputedStyle(node).fontSize)))
  expect(typeScale).toEqual(['12px', '14px', '12px', '18px'])
  const pickerAppearances = await Promise.all([
    details.getByLabel('Uppgiftens förfallodatum'),
    details.getByLabel('Uppgiftens förfallotid'),
  ].map((input) => input.evaluate((element) => getComputedStyle(element).appearance)))
  expect(pickerAppearances).toEqual(['auto', 'auto'])

  const hasHiddenIndicatorRule = await page.evaluate(() => {
    return Array.from(document.styleSheets).some((sheet) => {
      try {
        return Array.from(sheet.cssRules).some((rule) =>
          rule.cssText.includes('planning-picker::-webkit-calendar-picker-indicator') &&
          rule.cssText.includes('display: none'),
        )
      } catch {
        return false
      }
    })
  })
  expect(hasHiddenIndicatorRule).toBe(true)

  const datePickerTriggered = await details.getByLabel('Uppgiftens förfallodatum').evaluate((element) => {
    let triggered = false
    const orig = (element as HTMLInputElement).showPicker
    ;(element as HTMLInputElement).showPicker = () => { triggered = true }
    element.click()
    ;(element as HTMLInputElement).showPicker = orig
    return triggered
  })
  expect(datePickerTriggered).toBe(true)

  await details.getByRole('textbox', { name: 'Anteckningar' }).fill('Kom ihåg måtten.')
  await details.getByRole('button', { name: 'Stäng uppgiftsdetaljer' }).click()

  await expect(page).toHaveURL(/\/#\/lists\/__default__$/)
  await expect(page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' }).getByRole('img', { name: 'Anteckning finns' })).toBeVisible()
})

test('links tasks across lists in both directions and saves multiple external URLs', async ({ page }) => {
  await page.goto('/#/tasks/local-task-2')
  await dismissReleaseNotes(page)

  const details = page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })
  const linkedTasks = details.getByRole('region', { name: 'Länkade uppgifter' })
  await expect(linkedTasks).toContainText('Inga länkade uppgifter.')
  await details.getByRole('button', { name: 'Länka uppgift' }).click()

  const linkDialog = page.getByRole('dialog', { name: 'Länka uppgift' })
  await linkDialog.getByRole('searchbox', { name: 'Sök uppgift' }).fill('Förbered nästa release')
  await linkDialog.getByRole('button', { name: /Länka Förbered nästa release/ }).click()
  await expect(linkedTasks).toContainText('Förbered nästa release')

  await linkedTasks.getByRole('button', { name: 'Öppna länkad uppgift: Förbered nästa release' }).click()
  await expect(page).toHaveURL(/\/#\/tasks\/local-task-3$/)
  const reverseLink = page.getByRole('region', { name: 'Länkade uppgifter' })
  await expect(reverseLink).toContainText('Kontrollera mobilvyn')
  await reverseLink.getByRole('button', { name: 'Ta bort länk till: Kontrollera mobilvyn' }).click()
  await page.goBack()
  await expect(page).toHaveURL(/\/#\/tasks\/local-task-2$/)
  await expect(page.getByRole('region', { name: 'Länkade uppgifter' })).toContainText('Inga länkade uppgifter.')

  const urlInput = page.getByRole('textbox', { name: 'URL' })
  const firstUrl = 'https://www.tv4play.se/program/dea76dc5c339432e5796/robinson'
  const externalLinks = details.getByRole('region', { name: 'Extern länk' })
  await urlInput.fill(firstUrl)
  await externalLinks.getByRole('button', { name: 'Lägg till' }).click()
  await expect(externalLinks.getByRole('link', { name: `Öppna extern länk: ${firstUrl}` })).toContainText('https://www.tv4play.se/prog...')
  await urlInput.fill('https://example.com/project')
  await externalLinks.getByRole('button', { name: 'Lägg till' }).click()
  await expect(externalLinks.getByRole('link', { name: 'Öppna extern länk: https://example.com/project' })).toBeVisible()
  await page.reload()
  await dismissReleaseNotes(page)
  await expect(page.getByRole('link', { name: `Öppna extern länk: ${firstUrl}` })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Öppna extern länk: https://example.com/project' })).toBeVisible()
  await page.getByRole('button', { name: `Ta bort extern länk: ${new URL(firstUrl).href}` }).click()
  await expect(page.getByRole('link', { name: `Öppna extern länk: ${firstUrl}` })).toHaveCount(0)
})

test('expands task details on desktop and keeps the control out of mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/#/tasks/local-task-3')
  await dismissReleaseNotes(page)

  const details = page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })
  const expandButton = details.getByRole('button', { name: 'Expandera uppgiftsdetaljer' })
  await expect(expandButton).toBeVisible()
  await expandButton.click()
  await expect(details.getByRole('button', { name: 'Minimera uppgiftsdetaljer' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/\/#\/tasks\/local-task-3\?details=expanded$/)
  await page.reload()
  await dismissReleaseNotes(page)
  await expect(page).toHaveURL(/\/#\/tasks\/local-task-3\?details=expanded$/)
  await expect(details.getByRole('button', { name: 'Minimera uppgiftsdetaljer' })).toHaveAttribute('aria-pressed', 'true')
  const sidebar = page.getByRole('complementary', { name: 'Uppgiftsnavigering' })
  await expect(sidebar.getByRole('button', { name: 'Expandera navigeringsmeny' })).toBeVisible()

  const laptopBounds = await details.evaluate((element) => {
    const { left, right, width } = element.getBoundingClientRect()
    return { left, right, width }
  })
  expect(laptopBounds.width).toBeGreaterThan(600)
  expect(laptopBounds.width).toBeLessThan(700)
  expect(Math.abs(laptopBounds.right - 1280)).toBeLessThan(2)
  expect(await page.getByRole('dialog', { name: 'Uppgiftsdetaljer' }).getAttribute('aria-modal')).toBe('false')

  const mainBounds = await page.getByRole('main').evaluate((element) => {
    const { left, right, width } = element.getBoundingClientRect()
    return { left, right, width }
  })
  expect(mainBounds.width).toBeGreaterThan(250)
  expect(Math.abs(mainBounds.right - laptopBounds.left)).toBeLessThan(2)

  await sidebar.getByRole('button', { name: 'Expandera navigeringsmeny' }).click()
  await expect(sidebar.getByRole('button', { name: 'Fäll ihop navigeringsmeny' })).toBeVisible()
  await expect(details.getByRole('button', { name: 'Expandera uppgiftsdetaljer' })).toHaveAttribute('aria-pressed', 'false')
  const collapsedPanelWidth = await details.evaluate((element) => element.getBoundingClientRect().width)
  expect(collapsedPanelWidth).toBeLessThan(400)

  await details.getByRole('button', { name: 'Expandera uppgiftsdetaljer' }).click()
  await expect(sidebar.getByRole('button', { name: 'Expandera navigeringsmeny' })).toBeVisible()
  await page.setViewportSize({ width: 1920, height: 1080 })
  await sidebar.getByRole('button', { name: 'Expandera navigeringsmeny' }).click()
  await expect(sidebar.getByRole('button', { name: 'Fäll ihop navigeringsmeny' })).toBeVisible()
  await expect(details.getByRole('button', { name: 'Minimera uppgiftsdetaljer' })).toHaveAttribute('aria-pressed', 'true')
  const largeScreenBounds = await details.evaluate((element) => {
    const { right, width } = element.getBoundingClientRect()
    return { right, width }
  })
  expect(largeScreenBounds.width).toBeGreaterThan(600)
  expect(largeScreenBounds.width).toBeLessThan(670)
  expect(Math.abs(largeScreenBounds.right - 1920)).toBeLessThan(2)

  await details.getByRole('button', { name: 'Minimera uppgiftsdetaljer' }).click()
  await expect(page).toHaveURL(/\/#\/tasks\/local-task-3$/)
  await expect(details.getByRole('button', { name: 'Expandera uppgiftsdetaljer' })).toHaveAttribute('aria-pressed', 'false')
  await expect(sidebar.getByRole('button', { name: 'Fäll ihop navigeringsmeny' })).toBeVisible()
  await sidebar.getByRole('button', { name: 'Fäll ihop navigeringsmeny' }).click()
  const panelWidth = await details.evaluate((element) => element.getBoundingClientRect().width)
  expect(panelWidth).toBeLessThan(400)

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(details.getByRole('button', { name: 'Expandera uppgiftsdetaljer' })).toBeHidden()
  const mobileWidth = await details.evaluate((element) => element.getBoundingClientRect().width)
  expect(mobileWidth).toBe(390)
})

test('prepares and imports subtasks from the task details panel', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/#/tasks/local-task-3')
  await dismissReleaseNotes(page)

  const details = page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })
  await details.getByRole('textbox', { name: 'Anteckningar' }).fill('Testa bygget innan publicering.')
  const stepToolsToggle = details.getByRole('button', { name: 'Förbered och importera delsteg' })
  await expect(stepToolsToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(details.getByRole('textbox', { name: 'Uppgiftskontext' })).toHaveCount(0)
  await stepToolsToggle.click()

  const expectedContext = {
    title: 'Förbered nästa release',
    note: 'Testa bygget innan publicering.',
    expectedResponseFormat: { steps: ['Delsteg 1', 'Delsteg 2'] },
  }
  const expectedInstructions = [
    'Skapa konkreta delsteg för uppgiften nedan. Använd anteckningen som stöd och formulera varje steg som en tydlig åtgärd. Låt mig kunna kopiera ut resultaten direkt. Skriv endast JSON, inga förklaringar eller kommentarer.',
    'Förväntat svarsformat är JSON. Returnera endast giltig JSON enligt noden expectedResponseFormat. Inget annat får returneras.',
  ].join('\n')
  const expectedCopiedContext = `${expectedInstructions}\n\n${JSON.stringify(expectedContext, null, 2)}`
  const contextInput = details.getByRole('textbox', { name: 'Uppgiftskontext' })
  await expect(contextInput).toHaveValue(expectedCopiedContext)
  await details.getByRole('button', { name: 'Kopiera kontext' }).click()
  await expect(details.getByRole('status')).toContainText('Uppgiftskontext kopierad.')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expectedCopiedContext)

  const jsonInput = details.getByRole('textbox', { name: 'JSON för delsteg' })
  await jsonInput.fill(JSON.stringify({
    steps: ['Samla ändringar', 'Skriv versionsanteckningar'],
  }))
  await details.getByRole('button', { name: 'Importera delsteg', exact: true }).click()
  await expect(details.getByRole('status')).toContainText('2 delsteg importerade.')
  const importedSteps = details.locator('[data-step-id]')
  await expect(importedSteps).toHaveCount(2)
  await expect(importedSteps.nth(0).getByRole('button', { name: 'Redigera delsteg: Samla ändringar' })).toBeVisible()
  await expect(importedSteps.nth(1).getByRole('button', { name: 'Redigera delsteg: Skriv versionsanteckningar' })).toBeVisible()

  await jsonInput.fill('{')
  await details.getByRole('button', { name: 'Importera delsteg', exact: true }).click()
  await expect(details.getByRole('alert')).toContainText('Fältet innehåller inte giltig JSON.')
})

test('opens a task directly from its URL and restores its details after reload', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/#/tasks/local-task-3')
  await dismissReleaseNotes(page)

  const details = page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })
  await expect(page).toHaveURL(/\/#\/tasks\/local-task-3$/)
  await expect(details.getByRole('textbox', { name: 'Uppgiftens titel' })).toHaveValue('Förbered nästa release')
  await expect(page.getByRole('heading', { name: 'Projekt' })).toBeVisible()
  await details.getByRole('button', { name: 'Kopiera uppgiftslänk' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Uppgiftslänk kopierad.' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(new URL(page.url()).href)

  await page.reload()
  await expect(page.getByRole('dialog', { name: 'Uppgiftsdetaljer' }).getByRole('textbox', { name: 'Uppgiftens titel' })).toHaveValue('Förbered nästa release')
})

test('switches to a different task route when another row is selected', async ({ page }) => {
  await page.goto('/#/lists/__default__')
  await dismissReleaseNotes(page)
  await page.getByPlaceholder('Lägg till en uppgift').fill('En annan routbar uppgift')
  await page.getByPlaceholder('Lägg till en uppgift').press('Enter')

  await page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' }).click()
  await expect(page).toHaveURL(/\/#\/tasks\/local-task-2$/)
  await page.getByRole('group', { name: 'Uppgift: En annan routbar uppgift' }).click()

  await expect(page).toHaveURL(/\/#\/tasks\/[^/]+$/)
  await expect(page.getByRole('dialog', { name: 'Uppgiftsdetaljer' }).getByRole('textbox', { name: 'Uppgiftens titel' })).toHaveValue('En annan routbar uppgift')
})

test('redirects a legacy notification link to the canonical task URL', async ({ page }) => {
  await page.goto('/#/?task=local-task-3')
  await dismissReleaseNotes(page)

  await expect(page).toHaveURL(/\/#\/tasks\/local-task-3$/)
  await expect(page.getByRole('dialog', { name: 'Uppgiftsdetaljer' }).getByRole('textbox', { name: 'Uppgiftens titel' })).toHaveValue('Förbered nästa release')
})

test('keeps the task URL when moving a task to another list', async ({ page }) => {
  await page.goto('/')
  await dismissReleaseNotes(page)
  await page.getByRole('button', { name: 'Ny lista' }).click()
  await page.getByPlaceholder('Listnamn').fill('Uppgiftsflyttmål')
  await page.getByPlaceholder('Listnamn').press('Enter')

  await page.goto('/#/tasks/local-task-3')
  await dismissReleaseNotes(page)
  const task = page.getByRole('group', { name: 'Uppgift: Förbered nästa release' })
  await task.getByRole('button', { name: 'Uppgiftsåtgärder' }).click()
  await page.getByRole('button', { name: 'Flytta till lista' }).click()
  await page.getByRole('menuitem', { name: 'Uppgiftsflyttmål' }).click()

  await expect(page).toHaveURL(/\/#\/tasks\/local-task-3$/)
  await expect(page.getByRole('heading', { name: 'Uppgiftsflyttmål' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Uppgiftsdetaljer' }).getByRole('textbox', { name: 'Uppgiftens titel' })).toHaveValue('Förbered nästa release')
})

test('keeps a task link usable after its parent list is deleted', async ({ page }) => {
  await page.goto('/')
  await dismissReleaseNotes(page)
  await page.getByRole('button', { name: 'Ny lista' }).click()
  await page.getByPlaceholder('Listnamn').fill('Föräldralista')
  await page.getByPlaceholder('Listnamn').press('Enter')
  await page.getByPlaceholder('Lägg till en uppgift').fill('Fristående task')
  await page.getByPlaceholder('Lägg till en uppgift').press('Enter')

  await page.getByRole('group', { name: 'Uppgift: Fristående task' }).click()
  await expect(page).toHaveURL(/\/#\/tasks\/[^/]+$/)
  const taskUrl = page.url()
  await page.getByRole('dialog', { name: 'Uppgiftsdetaljer' }).getByRole('button', { name: 'Stäng uppgiftsdetaljer' }).click()
  await page.getByRole('button', { name: 'Fler listalternativ' }).click()
  await page.getByRole('button', { name: 'Ta bort lista' }).click()
  const confirmation = page.getByRole('dialog', { name: 'Ta bort lista?' })
  await expect(confirmation.getByLabel('Ta bort uppgifter i listan')).not.toBeChecked()
  await confirmation.getByRole('button', { name: 'Ta bort lista' }).click()

  await page.goto(taskUrl)
  const details = page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })
  await expect(details.getByRole('textbox', { name: 'Uppgiftens titel' })).toHaveValue('Fristående task')
  await details.getByRole('button', { name: 'Stäng uppgiftsdetaljer' }).click()
  await expect(page).toHaveURL(/\/#\/$/)
})

test('shows a not-found state for an unknown task URL', async ({ page }) => {
  await page.goto('/#/tasks/missing-task-id')
  await dismissReleaseNotes(page)

  await expect(page.getByRole('alert')).toContainText('Uppgiften hittades inte')
  await expect(page).toHaveURL(/\/#\/tasks\/missing-task-id$/)
})

test('asks to complete the parent task when all subtasks are checked', async ({ page }) => {
  await page.goto('/')
  const releaseCloseButton = page.getByRole('button', { name: 'Jag har sett detta' })
  if (await releaseCloseButton.count()) await releaseCloseButton.click()

  const title = `Deluppgiftstest-${Date.now()}`
  const task = page.getByPlaceholder('Lägg till en uppgift')
  await task.fill(title)
  await task.press('Enter')

  const taskRow = page.getByRole('group', { name: `Uppgift: ${title}` })
  await taskRow.click()
  const details = page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })
  const stepInput = details.getByPlaceholder('Lägg till delsteg')
  await stepInput.fill('Första deluppgiften')
  await stepInput.press('Enter')
  await stepInput.fill('Sista deluppgiften')
  await stepInput.press('Enter')

  await details.getByRole('checkbox', { name: 'Markera delsteg som klart: Första deluppgiften' }).click()
  await expect(details.getByRole('dialog', { name: 'Hela uppgiften klar?' })).toHaveCount(0)

  await details.getByRole('checkbox', { name: 'Markera delsteg som klart: Sista deluppgiften' }).click()
  const confirmation = details.getByRole('dialog', { name: 'Hela uppgiften klar?' })
  await expect(confirmation).toContainText('Alla deluppgifter är klara. Vill du markera huvuduppgiften som slutförd?')
  await confirmation.getByRole('button', { name: 'Markera huvuduppgiften' }).click()

  await expect(taskRow.getByRole('button', { name: 'Markera uppgift som aktiv' })).toBeVisible()
})

test('marks a task complete and restores it to active', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Jag har sett detta' }).click()

  const task = page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' })
  await task.getByRole('button', { name: 'Markera uppgift som slutförd' }).click()
  await expect(task.getByRole('button', { name: 'Markera uppgift som aktiv' })).toBeVisible()

  await task.getByRole('button', { name: 'Markera uppgift som aktiv' }).click()
  await expect(task.getByRole('button', { name: 'Markera uppgift som slutförd' })).toBeVisible()
})

test('marks a task important and finds it in Viktigt', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Jag har sett detta' }).click()

  const task = page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' })
  await task.getByRole('button', { name: 'Uppgiftsåtgärder' }).click()
  await page.getByRole('button', { name: 'Stjärnmarkera', exact: true }).click()
  await page.getByRole('button', { name: 'Viktigt' }).click()

  await expect(page).toHaveURL(/\/important$/)
  await expect(page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' })).toBeVisible()
})

test('sets an urgent priority and finds the task in Viktigt', async ({ page }) => {
  await page.goto('/')
  await dismissReleaseNotes(page)

  const task = page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' })
  await task.getByRole('button', { name: 'Uppgiftsåtgärder' }).click()
  await page.getByLabel('Prioritet för Kontrollera mobilvyn').selectOption('urgent')

  await expect(task.getByRole('img', { name: 'Brådskande prioritet' })).toBeVisible()
  await page.getByRole('button', { name: 'Viktigt' }).click()
  await expect(page).toHaveURL(/\/important$/)
  await expect(task).toBeVisible()
})

test('filters and sorts the active list from the toolbar menu', async ({ page }) => {
  await page.goto('/#/lists/__default__')
  await dismissReleaseNotes(page)

  const importantTask = page.getByRole('group', { name: 'Uppgift: Testa dra och släppa uppgifter' })
  const normalTask = page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' })
  await expect(importantTask).toBeVisible()
  await expect(normalTask).toBeVisible()

  await page.getByRole('button', { name: 'Filtrera och sortera uppgifter' }).click()
  await page.getByLabel('Filtrera uppgifter efter prioritet').selectOption('high')

  await expect(importantTask).toBeVisible()
  await expect(normalTask).toHaveCount(0)

  await page.getByLabel('Sortera uppgifter efter').selectOption('priority')
  await expect(page.getByRole('note')).toContainText('Sorterad efter Prioritet')
})

test('persists sort preference for smart views', async ({ page }) => {
  await page.goto('/#/important')
  await dismissReleaseNotes(page)

  await page.getByRole('button', { name: 'Filtrera och sortera uppgifter' }).click()
  await page.getByLabel('Sortera uppgifter efter').selectOption('dueDate')

  await page.reload()
  await page.getByRole('button', { name: 'Filtrera och sortera uppgifter' }).click()
  await expect(page.getByLabel('Sortera uppgifter efter')).toHaveValue('dueDate')
})

test('sets a task priority from the details panel', async ({ page }) => {
  await page.goto('/')
  await dismissReleaseNotes(page)

  const task = page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' })
  await task.click()
  const details = page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })
  await details.getByLabel('Uppgiftens prioritet').selectOption('low')

  await expect(task.getByRole('img', { name: 'Låg prioritet' })).toBeVisible()
})

test('adds a task to Min dag and finds it in the smart view', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Jag har sett detta' }).click()

  const task = page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' })
  await task.getByRole('button', { name: 'Uppgiftsåtgärder' }).click()
  await page.getByRole('button', { name: 'Lägg till i Min dag', exact: true }).click()
  await page.getByRole('button', { name: 'Min dag' }).click()

  await expect(page).toHaveURL(/\/my-day$/)
  await expect(page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' })).toBeVisible()
})

test('celebrates completing every task in a list', async ({ page }) => {
  await page.goto('/')
  const releaseCloseButton = page.getByRole('button', { name: 'Jag har sett detta' })
  if (await releaseCloseButton.count()) await releaseCloseButton.click()

  await page.getByRole('group', { name: 'Uppgift: Testa dra och släppa uppgifter' }).getByRole('button', { name: 'Markera uppgift som slutförd' }).click()
  await page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' }).getByRole('button', { name: 'Markera uppgift som slutförd' }).click()

  await expect(page.getByRole('status').filter({ hasText: /Snyggt! Listan är klar\.|Boom! Allt är klart\.|Du satte den!/ })).toBeVisible()
})

test('adds a tag and uses a quick due-date preset', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Jag har sett detta' }).click()

  const sourceTitle = `Taggförslagskälla-${Date.now()}`
  await page.getByPlaceholder('Lägg till en uppgift').fill(sourceTitle)
  await page.getByPlaceholder('Lägg till en uppgift').press('Enter')
  const sourceTask = page.getByRole('group', { name: `Uppgift: ${sourceTitle}` })
  await expect(sourceTask).toBeVisible()
  await sourceTask.click()

  const sourceDetails = page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })
  await sourceDetails.getByPlaceholder('Lägg till tagg').fill('lägenhet')
  await sourceDetails.getByPlaceholder('Lägg till tagg').press('Enter')
  await sourceDetails.getByPlaceholder('Lägg till tagg').fill('läget')
  await sourceDetails.getByPlaceholder('Lägg till tagg').press('Enter')
  await sourceDetails.getByRole('button', { name: 'Stäng uppgiftsdetaljer' }).click()

  await page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' }).click()

  const details = page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })
  const tagInput = details.getByPlaceholder('Lägg till tagg')
  await tagInput.fill('läg')
  await expect(details.getByRole('button', { name: 'Lägg till befintlig tagg #lägenhet' })).toBeVisible()
  await expect(details.getByRole('button', { name: 'Lägg till befintlig tagg #läget' })).toBeVisible()
  await details.getByRole('button', { name: 'Lägg till befintlig tagg #lägenhet' }).click()
  await expect(details.getByText('#lägenhet')).toBeVisible()

  await details.getByPlaceholder('Lägg till tagg').fill('arbete')
  await details.getByPlaceholder('Lägg till tagg').press('Enter')
  await expect(details.getByText('#arbete')).toBeVisible()

  await details.getByRole('button', { name: 'Imorgon' }).click()
  await expect(details.getByLabel('Uppgiftens förfallodatum')).not.toHaveValue('')
  const dueTimeInput = details.getByLabel('Uppgiftens förfallotid')
  const timePickerTriggered = await dueTimeInput.evaluate((element) => {
    let triggered = false
    const orig = (element as HTMLInputElement).showPicker
    ;(element as HTMLInputElement).showPicker = () => { triggered = true }
    element.click()
    ;(element as HTMLInputElement).showPicker = orig
    return triggered
  })
  expect(timePickerTriggered).toBe(true)
  await dueTimeInput.fill('14:30')
  await details.getByRole('button', { name: 'Lägg till påminnelse' }).click()
  await details.getByRole('tab', { name: 'Fast tidpunkt' }).click()
  const reminderEditor = details.locator('[data-testid="reminder-editor"]')
  await expect(reminderEditor).toBeVisible()
  await details.getByLabel('Påminnelsedatum').fill('2026-12-01')
  await details.getByLabel('Påminnelsetid').fill('09:00')
  await details.getByRole('button', { name: 'Spara påminnelse' }).click()
  await expect(details.getByLabel('Aktiva påminnelser').getByRole('listitem')).toContainText('2026-12-01')

  await details.getByRole('button', { name: 'Stäng uppgiftsdetaljer' }).click()
  await page.getByRole('button', { name: 'Taggar' }).click()
  await page.getByRole('menuitem', { name: '#arbete' }).click()

  await expect(page).toHaveURL(/\/tag\/arbete$/)
  await expect(page.getByRole('heading', { name: '#arbete' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: '#arbete' })).toBeVisible()
  await page.getByRole('button', { name: 'Taggar' }).click()
  await expect(page.getByRole('menuitem', { name: '#arbete' })).toBeVisible()
})

test('shows task metadata as icons on mobile and labels on wide screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const releaseCloseButton = page.getByRole('button', { name: 'Jag har sett detta' })
  if (await releaseCloseButton.count()) await releaseCloseButton.click()

  const task = page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' })
  await task.click()
  const details = page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })
  await details.getByPlaceholder('Lägg till tagg').fill('responsiv')
  await details.getByPlaceholder('Lägg till tagg').press('Enter')
  await details.getByPlaceholder('Lägg till tagg').fill('en-mycket-lang-tag-for-att-testa-skrollning')
  await details.getByPlaceholder('Lägg till tagg').press('Enter')
  await details.getByLabel('Uppgiftens förfallodatum').fill('2026-10-05')
  await details.getByLabel('Uppgiftens förfallotid').fill('14:30')
  await details.getByRole('button', { name: 'Lägg till påminnelse' }).click()
  // Use relative mode (deadline finns)
  await details.getByRole('tab', { name: 'Relativ till deadline' }).click()
  await details.getByLabel('När ska du påminnas?').selectOption('60')
  await details.getByRole('button', { name: 'Spara påminnelse' }).click()
  await details.getByRole('button', { name: 'Stäng uppgiftsdetaljer' }).click()

  await task.getByRole('button', { name: 'Uppgiftsåtgärder' }).click()
  await page.getByRole('button', { name: 'Stjärnmarkera', exact: true }).click()
  await task.getByRole('button', { name: 'Uppgiftsåtgärder' }).click()
  await page.getByRole('button', { name: 'Lägg till i Min dag', exact: true }).click()

  const metadata = task.getByRole('group', { name: 'Taggar och uppgiftsmarkeringar' })
  const dueDateText = new Date('2026-10-05T00:00:00').toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const reminderDate = new Date('2026-10-05T13:30:00')
  // TaskRow visar datum+tid när påminnelsedagen inte är idag
  const reminderDateStr = reminderDate.toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
  }).replace('.', '')
  const reminderTimeStr = reminderDate.toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const reminderChipText = `${reminderDateStr} ${reminderTimeStr}`  // ex. "5 okt 13:30"
  const tag = metadata.getByRole('button', { name: 'Visa uppgifter med taggen #responsiv' })
  const title = task.getByText('Kontrollera mobilvyn', { exact: true })
  const titleBox = await title.boundingBox()
  const tagBox = await tag.boundingBox()
  const statusMetadata = metadata.locator('[data-task-metadata-group="status"]')
  const planningMetadata = metadata.locator('[data-task-metadata-group="planning"]')
  const statusBox = await statusMetadata.boundingBox()
  const planningBox = await planningMetadata.boundingBox()
  const metadataDimensions = await metadata.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  const rowBox = await task.boundingBox()
  const checkboxBox = await task.getByRole('button', { name: 'Markera uppgift som slutförd' }).boundingBox()
  const dragHandleBox = await task.locator('[data-drag-handle]').boundingBox()

  await expect(tag).toBeVisible()
  await expect(metadata.getByRole('img', { name: 'Stjärnmärkt' })).toBeVisible()
  await expect(metadata.getByRole('img', { name: 'Tillagd i Min dag' })).toBeVisible()
  await expect(metadata.getByRole('img', { name: `Förfallodatum: ${dueDateText}` })).toBeVisible()
  await expect(metadata.getByRole('img', { name: `Påminnelse: ${reminderChipText}` })).toBeVisible()
  await expect(metadata.getByText('Stjärnmärkt', { exact: true })).toBeHidden()
  await expect(metadata.getByText('Min dag', { exact: true })).toBeHidden()
  await expect(metadata.getByText(dueDateText, { exact: true })).toBeHidden()
  await expect(metadata.getByText(reminderChipText, { exact: true })).toBeVisible()
  await expect(metadata.getByText(`Påminnelse ${reminderChipText}`, { exact: true })).toBeHidden()
  await expect(task.getByRole('button', { name: 'Uppgiftsåtgärder' })).toBeVisible()
  expect(tagBox?.y).toBeGreaterThan(titleBox?.y ?? 0)
  expect(Math.abs((tagBox?.x ?? 0) - (titleBox?.x ?? 0))).toBeLessThan(1)
  expect(Math.abs((planningBox?.y ?? 0) - (statusBox?.y ?? 0))).toBeLessThan(1)
  expect(metadataDimensions.scrollWidth).toBeGreaterThan(metadataDimensions.clientWidth)
  expect(Math.abs((checkboxBox?.y ?? 0) + (checkboxBox?.height ?? 0) / 2 - ((rowBox?.y ?? 0) + (rowBox?.height ?? 0) / 2))).toBeLessThan(1)
  expect(Math.abs((dragHandleBox?.y ?? 0) + (dragHandleBox?.height ?? 0) / 2 - ((rowBox?.y ?? 0) + (rowBox?.height ?? 0) / 2))).toBeLessThan(1)
  expect(Math.abs((planningBox?.y ?? 0) - (statusBox?.y ?? 0))).toBeLessThan(1)

  await page.setViewportSize({ width: 1024, height: 900 })
  await expect(metadata.getByText('Stjärnmärkt', { exact: true })).toBeVisible()
  await expect(metadata.getByText('Min dag', { exact: true })).toBeVisible()
  await expect(metadata.getByText(dueDateText, { exact: true })).toBeVisible()
  await expect(metadata.getByText(reminderChipText, { exact: true })).toBeVisible()
  await expect(metadata.getByText(`Påminnelse ${reminderChipText}`, { exact: true })).toBeHidden()

  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(metadata.getByText('Stjärnmärkt', { exact: true })).toBeVisible()
  await expect(metadata.getByText('Min dag', { exact: true })).toBeVisible()
  await expect(metadata.getByText(dueDateText, { exact: true })).toBeVisible()
  await expect(metadata.getByText(reminderChipText, { exact: true })).toBeHidden()
  await expect(metadata.getByText(`Påminnelse ${reminderChipText}`, { exact: true })).toBeVisible()
})

test('renames a tag globally and shows each result list', async ({ page }) => {
  await page.goto('/')
  const whatsNewButton = page.getByRole('button', { name: 'Jag har sett detta' })
  if (await whatsNewButton.count()) await whatsNewButton.click()
  await page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' }).click()
  const firstDetails = page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })
  await firstDetails.getByPlaceholder('Lägg till tagg').fill('shared-tag')
  await firstDetails.getByPlaceholder('Lägg till tagg').press('Enter')
  await firstDetails.getByRole('button', { name: 'Stäng uppgiftsdetaljer' }).click()
  await page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' }).getByRole('button', { name: 'Visa uppgifter med taggen #shared-tag' }).click()
  await expect(page).toHaveURL(/\/tag\/shared-tag$/)

  await page.goto('#/')
  await page.getByRole('button', { name: 'Öppna navigeringsmeny' }).click()
  await page.getByRole('button', { name: /^Projekt/ }).click()
  await page.getByRole('group', { name: 'Uppgift: Förbered nästa release' }).click()
  const secondDetails = page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })
  await secondDetails.getByPlaceholder('Lägg till tagg').fill('shared-tag')
  await secondDetails.getByPlaceholder('Lägg till tagg').press('Enter')

  await page.goto('#/settings')
  await page.getByRole('button', { name: 'Redigera taggen #shared-tag' }).click()
  await page.getByLabel('Namn på taggen #shared-tag').fill('renamed-tag')
  await page.getByRole('button', { name: 'Spara taggnamn #shared-tag' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Taggen har bytt namn' })).toContainText('Taggen har bytt namn till #renamed-tag.')

  await page.goto('#/tag/renamed-tag')
  const firstTask = page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' })
  const secondTask = page.getByRole('group', { name: 'Uppgift: Förbered nästa release' })
  await expect(firstTask).toContainText('Att göra')
  await expect(secondTask).toContainText('Projekt')
  await expect(firstTask).toContainText('#renamed-tag')
  await expect(secondTask).toContainText('#renamed-tag')
})

test('can undo deleting a task', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Jag har sett detta' }).click()
  await page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' }).click()
  await page.getByRole('dialog', { name: 'Uppgiftsdetaljer' }).getByRole('button', { name: 'Ta bort uppgift' }).click()

  const confirmation = page.getByRole('dialog', { name: 'Ta bort uppgiften?' })
  await confirmation.getByRole('button', { name: 'Ta bort', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Uppgift borttagen')
  await page.getByRole('alert').getByRole('button', { name: 'Ångra' }).click()

  await expect(page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' })).toBeVisible()
})
