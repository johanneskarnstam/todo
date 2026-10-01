import { expect, test } from '@playwright/test'

test('settings exposes preferences and data actions', async ({ page }) => {
  await page.goto('#/settings')
  const releaseCloseButton = page.getByRole('button', { name: 'Jag har sett detta' })
  if (await releaseCloseButton.count()) await releaseCloseButton.click()

  await expect(page.getByRole('heading', { name: 'Inställningar', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Utseende' })).toBeVisible()
  await expect(page.getByLabel('Tema')).toHaveValue('light')
  await expect(page.getByText('Sortering och arbetsflöde ställs in per lista.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Exportera data' })).toBeVisible()
  await expect(page.getByText('Online', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Förändringshistorik' }).click()
  const historyDialog = page.getByRole('dialog', { name: 'Förändringar över tid' })
  await expect(historyDialog).toBeVisible()
  await expect(historyDialog).toContainText('Enhetliga ikoner och sidomeny')
  await expect(historyDialog).toContainText('v0.23.1')
  await historyDialog.getByRole('button', { name: 'Stäng ändringshistoriken' }).click()
  await expect(historyDialog).toHaveCount(0)

  await page.getByRole('button', { name: 'Appens funktioner' }).click()
  const featuresDialog = page.getByRole('dialog', { name: 'Appens funktioner' })
  await expect(featuresDialog).toBeVisible()
  await expect(featuresDialog).toContainText('Listor och planering')
  await expect(featuresDialog).toContainText('Google Kalender')
  await expect(featuresDialog).toContainText('Importera uppgifter från JSON')
  await featuresDialog.getByRole('button', { name: 'Stäng funktionsöversikten' }).click()
  await expect(featuresDialog).toHaveCount(0)

  await page.getByLabel('Tema').selectOption('dark')
  await expect(page.getByLabel('Tema')).toHaveValue('dark')
})

test('forces the latest app version from settings', async ({ page }) => {
  await page.goto('#/settings')
  const releaseCloseButton = page.getByRole('button', { name: 'Jag har sett detta' })
  if (await releaseCloseButton.count()) await releaseCloseButton.click()

  const updateButton = page.getByRole('button', { name: 'Rensa cache och uppdatera appen' })

  await expect(updateButton).toBeVisible()
  await updateButton.click()
  await expect(page.getByRole('heading', { name: 'Inställningar', exact: true })).toBeVisible()
})

test('confirms before clearing local data', async ({ page }) => {
  await page.goto('#/settings')
  const releaseCloseButton = page.getByRole('button', { name: 'Jag har sett detta' })
  if (await releaseCloseButton.count()) await releaseCloseButton.click()

  await page.getByRole('button', { name: 'Rensa lokala data' }).click()
  const confirmation = page.getByRole('dialog', { name: 'Rensa lokala data?' })
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole('button', { name: 'Avbryt' }).click()
  await expect(page.getByRole('status')).toHaveCount(0)

  await page.getByRole('button', { name: 'Rensa lokala data' }).click()
  await page.getByRole('dialog', { name: 'Rensa lokala data?' }).getByRole('button', { name: 'Rensa data' }).click()
  await expect(page.getByRole('status')).toContainText('Lokala data har rensats.')
})

test('imports JSON tasks into a selected list', async ({ page }) => {
  await page.goto('#/settings')
  const closeButton = page.getByRole('button', { name: 'Jag har sett detta' })
  if (await closeButton.count()) await closeButton.click()

  await expect(page.getByRole('heading', { name: 'Importera uppgifter' })).toBeVisible()
  await page.getByText('Visa exempel på JSON-format och fält').click()
  await expect(page.getByText('Förbered rapport')).toBeVisible()
  await page.getByLabel('Importera till').selectOption('local-projects')
  await page.getByLabel('JSON-fil').setInputFiles({
    name: 'uppgifter.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify([
      {
        title: 'Importerat från fil',
        note: 'Anteckning från importen',
        dueDate: '2026-10-01T14:30',
        dueTimeZone: 'Europe/Stockholm',
        reminder: { offsetMinutes: 60 },
        tags: ['Arbete Projekt', 'rapport'],
        important: true,
        myDay: true,
        completed: false,
        status: 'todo',
      },
      { title: 'En till importerad uppgift' },
    ])),
  })
  await expect(page.getByLabel('Klistra in JSON')).toHaveValue(/Importerat från fil/)
  await page.getByRole('button', { name: 'Importera uppgifter' }).click()

  await expect(page.getByRole('status')).toContainText('2 uppgifter importerade till Projekt.')
  await page.goto('#/')
  await page.getByRole('button', { name: /^Projekt/ }).click()
  const importedTask = page.getByRole('group', { name: 'Uppgift: Importerat från fil' })
  await expect(importedTask).toBeVisible()
  await expect(importedTask.getByRole('button', { name: 'Visa uppgifter med taggen #arbete-projekt' })).toBeVisible()
  await expect(importedTask.getByRole('button', { name: 'Visa uppgifter med taggen #rapport' })).toBeVisible()
  await expect(importedTask.getByRole('img', { name: 'Stjärnmärkt' })).toBeVisible()
  await expect(importedTask.getByRole('img', { name: /^Påminnelse:/ })).toBeVisible()
  await expect(importedTask.getByRole('img', { name: /^Förfallodatum:/ })).toBeVisible()
  await importedTask.click()
  await expect(page.getByRole('textbox', { name: 'Anteckningar' })).toHaveValue('Anteckning från importen')
  await expect(page.getByLabel('Uppgiftens förfallotid')).toHaveValue('14:30')
  await expect(page.getByRole('group', { name: 'Uppgift: En till importerad uppgift' })).toBeVisible()
})

test('pastes JSON into a newly created list', async ({ page }) => {
  await page.goto('#/settings')
  const closeButton = page.getByRole('button', { name: 'Jag har sett detta' })
  if (await closeButton.count()) await closeButton.click()

  await page.getByLabel('Importera till').selectOption('__create_new_import_list__')
  await page.getByLabel('Namn på ny lista').fill('Import från text')
  await page.getByLabel('Klistra in JSON').fill(JSON.stringify([
    {
      title: 'Klistrad uppgift',
      note: 'Texten följer med',
      dueDate: '2026-10-02T09:15',
    },
  ]))
  await page.getByRole('button', { name: 'Importera uppgifter' }).click()

  await expect(page.getByRole('status')).toContainText('1 uppgift importerad till Import från text.')
  await page.goto('#/')
  await page.getByRole('button', { name: /^Import från text/ }).click()
  const importedTask = page.getByRole('group', { name: 'Uppgift: Klistrad uppgift' })
  await expect(importedTask).toBeVisible()
  await importedTask.click()
  await expect(page.getByRole('textbox', { name: 'Anteckningar' })).toHaveValue('Texten följer med')
  await expect(page.getByLabel('Uppgiftens förfallotid')).toHaveValue('09:15')
})

test('restores a full backup with list settings and subtasks', async ({ page }) => {
  await page.goto('#/settings')
  const closeButton = page.getByRole('button', { name: 'Jag har sett detta' })
  if (await closeButton.count()) await closeButton.click()

  await page.getByLabel('Importtyp').selectOption('backup')
  await page.getByLabel('Klistra in JSON').fill(JSON.stringify({
    formatVersion: 2,
    folders: [],
    lists: [{ id: 'backup-list', name: 'Återställd lista', icon: 'star', viewMode: 'compact', showCompletedTasks: false }],
    tasks: [{ id: 'backup-task', listId: 'backup-list', title: 'Återställd uppgift', completed: false, status: 'todo' }],
    steps: [{ taskId: 'backup-task', title: 'Återställt delsteg', completed: true }],
  }))
  await page.getByRole('button', { name: 'Importera uppgifter' }).click()

  await expect(page.getByRole('status')).toContainText('1 uppgift importerad till säkerhetskopian.')
  await page.goto('#/')
  await page.getByRole('button', { name: /^Återställd lista/ }).click()
  const restoredTask = page.getByRole('group', { name: 'Uppgift: Återställd uppgift' })
  await expect(restoredTask).toBeVisible()
  await restoredTask.click()
  await expect(page.getByText('Återställt delsteg', { exact: true })).toBeVisible()
})
