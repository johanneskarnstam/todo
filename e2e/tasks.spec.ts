import { expect, test } from '@playwright/test'

test('creates a task in the active list', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Jag har sett detta' }).click()

  const title = `E2E-task-${Date.now()}`
  await page.getByPlaceholder('Lägg till en uppgift').fill(title)
  await page.getByPlaceholder('Lägg till en uppgift').press('Enter')

  await expect(page.getByRole('group', { name: `Uppgift: ${title}` })).toBeVisible()
})

test('opens task details from a task row', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Jag har sett detta' }).click()

  await page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' }).click()

  const details = page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })
  await expect(details).toBeVisible()
  await expect(details.getByRole('heading', { name: 'Taggar' })).toBeVisible()
  await expect(details.getByRole('heading', { name: 'Delsteg' })).toBeVisible()
  await expect(details.getByRole('heading', { name: 'Planering' })).toBeVisible()
  await expect(details.getByRole('heading', { name: 'Anteckningar' })).toBeVisible()
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

test('adds a tag and uses a quick due-date preset', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Jag har sett detta' }).click()
  await page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' }).click()

  const details = page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })
  await details.getByPlaceholder('Lägg till tagg').fill('arbete')
  await details.getByPlaceholder('Lägg till tagg').press('Enter')
  await expect(details.getByText('#arbete')).toBeVisible()

  await details.getByRole('button', { name: 'Imorgon' }).click()
  await expect(details.getByLabel('Uppgiftens förfallodatum')).not.toHaveValue('')
  await details.getByLabel('Uppgiftens förfallotid').fill('14:30')
  await details.getByLabel('Påminnelse').selectOption('60')
  await expect(details.getByText('Påminnelse aktiv')).toBeVisible()

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
  await details.getByLabel('Uppgiftens förfallodatum').fill('2026-10-05')
  await details.getByLabel('Uppgiftens förfallotid').fill('14:30')
  await details.getByLabel('Påminnelse').selectOption('60')
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
  const reminderDateText = reminderDate.toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
  }).replace('.', '')
  const reminderTimeText = reminderDate.toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const reminderDateTimeText = `${reminderDateText} ${reminderTimeText}`
  const tag = metadata.getByRole('button', { name: 'Visa uppgifter med taggen #responsiv' })
  const title = task.getByText('Kontrollera mobilvyn', { exact: true })
  const titleBox = await title.boundingBox()
  const tagBox = await tag.boundingBox()

  await expect(tag).toBeVisible()
  await expect(metadata.getByRole('img', { name: 'Stjärnmärkt' })).toBeVisible()
  await expect(metadata.getByRole('img', { name: 'Tillagd i Min dag' })).toBeVisible()
  await expect(metadata.getByRole('img', { name: `Förfallodatum: ${dueDateText}` })).toBeVisible()
  await expect(metadata.getByRole('img', { name: `Påminnelse: ${reminderDateTimeText}` })).toBeVisible()
  await expect(metadata.getByText('Stjärnmärkt', { exact: true })).toBeHidden()
  await expect(metadata.getByText('Min dag', { exact: true })).toBeHidden()
  await expect(metadata.getByText(dueDateText, { exact: true })).toBeHidden()
  await expect(metadata.getByText(reminderDateTimeText, { exact: true })).toBeVisible()
  await expect(metadata.getByText(`Påminnelse ${reminderDateTimeText}`, { exact: true })).toBeHidden()
  await expect(task.getByRole('button', { name: 'Uppgiftsåtgärder' })).toBeVisible()
  expect(tagBox?.y).toBeGreaterThan(titleBox?.y ?? 0)
  expect(Math.abs((tagBox?.x ?? 0) - (titleBox?.x ?? 0))).toBeLessThan(1)

  await page.setViewportSize({ width: 1024, height: 900 })
  await expect(metadata.getByText('Stjärnmärkt', { exact: true })).toBeVisible()
  await expect(metadata.getByText('Min dag', { exact: true })).toBeVisible()
  await expect(metadata.getByText(dueDateText, { exact: true })).toBeVisible()
  await expect(metadata.getByText(reminderDateTimeText, { exact: true })).toBeVisible()
  await expect(metadata.getByText(`Påminnelse ${reminderDateTimeText}`, { exact: true })).toBeHidden()

  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(metadata.getByText('Stjärnmärkt', { exact: true })).toBeVisible()
  await expect(metadata.getByText('Min dag', { exact: true })).toBeVisible()
  await expect(metadata.getByText(dueDateText, { exact: true })).toBeVisible()
  await expect(metadata.getByText(reminderDateTimeText, { exact: true })).toBeHidden()
  await expect(metadata.getByText(`Påminnelse ${reminderDateTimeText}`, { exact: true })).toBeVisible()
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
  await expect(page.getByRole('status')).toContainText('Taggen har bytt namn till #renamed-tag.')

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
