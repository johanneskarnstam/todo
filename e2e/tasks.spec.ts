import { expect, test } from '@playwright/test'

test('creates a task in the active list', async ({ page }) => {
  await page.goto('/')

  const title = `E2E-task-${Date.now()}`
  await page.getByPlaceholder('Lägg till en uppgift').fill(title)
  await page.getByPlaceholder('Lägg till en uppgift').press('Enter')

  await expect(page.getByRole('group', { name: `Uppgift: ${title}` })).toBeVisible()
})

test('opens task details from a task row', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' }).click()

  await expect(page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })).toBeVisible()
})

test('adds a tag and uses a quick due-date preset', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' }).click()

  const details = page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })
  await details.getByPlaceholder('Lägg till tagg').fill('arbete')
  await details.getByPlaceholder('Lägg till tagg').press('Enter')
  await expect(details.getByText('#arbete')).toBeVisible()

  await details.getByRole('button', { name: 'Imorgon' }).click()
  await expect(details.getByLabel('Uppgiftens förfallodatum')).not.toHaveValue('')
})

test('can undo deleting a task', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' }).click()
  await page.getByRole('dialog', { name: 'Uppgiftsdetaljer' }).getByRole('button', { name: 'Ta bort uppgift' }).click()

  const confirmation = page.getByRole('dialog', { name: 'Ta bort uppgiften?' })
  await confirmation.getByRole('button', { name: 'Ta bort', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Uppgift borttagen')
  await page.getByRole('alert').getByRole('button', { name: 'Ångra' }).click()

  await expect(page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' })).toBeVisible()
})
