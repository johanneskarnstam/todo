import { expect, test } from '@playwright/test'

test('settings exposes preferences and data actions', async ({ page }) => {
  await page.goto('#/settings')

  await expect(page.getByRole('heading', { name: 'Inställningar', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Utseende' })).toBeVisible()
  await expect(page.getByLabel('Tema')).toHaveValue('light')
  await expect(page.getByText('Sortering och arbetsflöde ställs in per lista.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Exportera data' })).toBeVisible()
  await expect(page.getByText('Online', { exact: true })).toBeVisible()

  await page.getByLabel('Tema').selectOption('dark')
  await expect(page.getByLabel('Tema')).toHaveValue('dark')
})

test('imports JSON tasks into a selected list', async ({ page }) => {
  await page.goto('#/settings')
  const closeButton = page.getByRole('button', { name: 'Jag har sett detta' })
  if (await closeButton.count()) await closeButton.click()

  await expect(page.getByRole('heading', { name: 'Importera uppgifter' })).toBeVisible()
  await page.getByText('Visa exempel på JSON-format och fält').click()
  await expect(page.getByText('Förbered rapport')).toBeVisible()
  await page.getByLabel('Lista').selectOption('local-projects')
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
        tags: ['arbete', 'rapport'],
        important: true,
        myDay: true,
        completed: false,
        status: 'todo',
      },
      { title: 'En till importerad uppgift' },
    ])),
  })

  await expect(page.getByRole('status')).toContainText('2 uppgifter importerade till Projekt.')
  await page.goto('#/')
  await page.getByRole('button', { name: /^Projekt/ }).click()
  const importedTask = page.getByRole('group', { name: 'Uppgift: Importerat från fil' })
  await expect(importedTask).toBeVisible()
  await expect(importedTask.getByText('#arbete #rapport')).toBeVisible()
  await expect(importedTask.getByRole('img', { name: 'Stjärnmärkt' })).toBeVisible()
  await expect(importedTask.getByRole('img', { name: 'Påminnelse inställd' })).toBeVisible()
  await expect(importedTask.getByRole('img', { name: 'Uppgiften har ett planerat datum' })).toBeVisible()
  await importedTask.click()
  await expect(page.getByRole('textbox', { name: 'Anteckningar' })).toHaveValue('Anteckning från importen')
  await expect(page.getByLabel('Uppgiftens förfallotid')).toHaveValue('14:30')
  await expect(page.getByRole('group', { name: 'Uppgift: En till importerad uppgift' })).toBeVisible()
})
