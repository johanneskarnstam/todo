import { test, expect } from '@playwright/test'

/**
 * E2E-tester för flexibla påminnelser (Fas 6 – Playwright).
 *
 * Körs med mock-auth (VITE_DEV_AUTH_BYPASS=true) och isolerat webbläsarkontext.
 */

const FUTURE_DATE = '2099-12-31'
const FUTURE_TIME = '09:00'

async function openDetailsForTask(page: import('@playwright/test').Page, taskName: string) {
  const whatsNew = page.getByRole('button', { name: 'Jag har sett detta' })
  if (await whatsNew.count()) await whatsNew.click()
  await page.getByRole('group', { name: `Uppgift: ${taskName}` }).click()
  return page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })
}

test.describe('Flexibla påminnelser', () => {
  test('visar påminnelsesektionen även utan deadline', async ({ page }) => {
    await page.goto('/')
    const details = await openDetailsForTask(page, 'Kontrollera mobilvyn')

    await expect(details.getByText('Påminnelser')).toBeVisible()
    await expect(details.getByRole('button', { name: 'Lägg till påminnelse' })).toBeVisible()
  })

  test('lägger till absolut påminnelse utan deadline och visar den i listan', async ({ page }) => {
    await page.goto('/')
    const details = await openDetailsForTask(page, 'Kontrollera mobilvyn')

    await details.getByRole('button', { name: 'Lägg till påminnelse' }).click()
    const editor = details.locator('[data-testid="reminder-editor"]')
    await expect(editor).toBeVisible()

    // Utan deadline ska relativt läge inte vara tillgängligt
    await expect(details.getByRole('tab', { name: 'Relativ till deadline' })).not.toBeVisible()

    await details.getByLabel('Påminnelsedatum').fill(FUTURE_DATE)
    await details.getByLabel('Påminnelsetid').fill(FUTURE_TIME)
    await details.getByRole('button', { name: 'Spara påminnelse' }).click()

    await expect(editor).not.toBeVisible()
    await expect(details.getByText('2099', { exact: false })).toBeVisible()
  })

  test('relativt alternativ inte valbart utan deadline', async ({ page }) => {
    await page.goto('/')
    const details = await openDetailsForTask(page, 'Kontrollera mobilvyn')

    await details.getByRole('button', { name: 'Lägg till påminnelse' }).click()

    await expect(details.getByRole('tab', { name: 'Relativ till deadline' })).not.toBeVisible()
    await expect(details.getByRole('tab', { name: 'Fast tidpunkt' })).not.toBeVisible()
  })

  test('lägger till relativ påminnelse när deadline finns', async ({ page }) => {
    await page.goto('/')
    const details = await openDetailsForTask(page, 'Kontrollera mobilvyn')

    await details.getByLabel('Uppgiftens förfallodatum').fill('2099-06-15')

    await details.getByRole('button', { name: 'Lägg till påminnelse' }).click()

    await expect(details.getByRole('tab', { name: 'Relativ till deadline' })).toBeVisible()
    await details.getByLabel('När ska du påminnas?').selectOption('60')
    await details.getByRole('button', { name: 'Spara påminnelse' }).click()

    await expect(details.getByText('1 timme före deadline')).toBeVisible()
  })

  test('lägger till två påminnelser och visar båda i TaskDetailsPanel', async ({ page }) => {
    await page.goto('/')
    const details = await openDetailsForTask(page, 'Kontrollera mobilvyn')

    for (const time of ['08:00', '10:00']) {
      await details.getByRole('button', { name: 'Lägg till påminnelse' }).click()
      await details.getByLabel('Påminnelsedatum').fill(FUTURE_DATE)
      await details.getByLabel('Påminnelsetid').fill(time)
      await details.getByRole('button', { name: 'Spara påminnelse' }).click()
    }

    const list = details.getByLabel('Aktiva påminnelser')
    await expect(list.locator('li')).toHaveCount(2)
  })

  test('tar bort en påminnelse och listan uppdateras optimistiskt', async ({ page }) => {
    await page.goto('/')
    const details = await openDetailsForTask(page, 'Kontrollera mobilvyn')

    await details.getByRole('button', { name: 'Lägg till påminnelse' }).click()
    await details.getByLabel('Påminnelsedatum').fill(FUTURE_DATE)
    await details.getByLabel('Påminnelsetid').fill(FUTURE_TIME)
    await details.getByRole('button', { name: 'Spara påminnelse' }).click()

    const list = details.getByLabel('Aktiva påminnelser')
    await expect(list.locator('li')).toHaveCount(1)

    await list.getByRole('button', { name: /Ta bort påminnelse/ }).click()
    await expect(list.locator('li')).toHaveCount(0)
    await expect(details.getByRole('button', { name: 'Lägg till påminnelse' })).toBeVisible()
  })

  test('relativ påminnelse rensas om deadline tas bort, absolut bevaras', async ({ page }) => {
    await page.goto('/')
    const details = await openDetailsForTask(page, 'Kontrollera mobilvyn')

    await details.getByLabel('Uppgiftens förfallodatum').fill('2099-06-15')

    // Relativ påminnelse
    await details.getByRole('button', { name: 'Lägg till påminnelse' }).click()
    await details.getByLabel('När ska du påminnas?').selectOption('10')
    await details.getByRole('button', { name: 'Spara påminnelse' }).click()

    // Absolut påminnelse
    await details.getByRole('button', { name: 'Lägg till påminnelse' }).click()
    await details.getByRole('tab', { name: 'Fast tidpunkt' }).click()
    await details.getByLabel('Påminnelsedatum').fill(FUTURE_DATE)
    await details.getByLabel('Påminnelsetid').fill(FUTURE_TIME)
    await details.getByRole('button', { name: 'Spara påminnelse' }).click()

    await expect(details.getByLabel('Aktiva påminnelser').locator('li')).toHaveCount(2)

    // Rensa deadline
    await details.getByRole('button', { name: 'Rensa' }).click()

    // Relativ ska ha rensats, absolut ska finnas kvar
    await expect(details.getByLabel('Aktiva påminnelser').locator('li')).toHaveCount(1)
    await expect(details.getByText('10 minuter före deadline')).not.toBeVisible()
    await expect(details.getByText('2099', { exact: false })).toBeVisible()
  })

  test('"Lägg till"-knappen döljs när 5 påminnelser finns', async ({ page }) => {
    await page.goto('/')
    const details = await openDetailsForTask(page, 'Kontrollera mobilvyn')

    for (let i = 1; i <= 5; i++) {
      await details.getByRole('button', { name: 'Lägg till påminnelse' }).click()
      const timeStr = `${String(i).padStart(2, '0')}:00`
      await details.getByLabel('Påminnelsedatum').fill(FUTURE_DATE)
      await details.getByLabel('Påminnelsetid').fill(timeStr)
      await details.getByRole('button', { name: 'Spara påminnelse' }).click()
    }

    await expect(details.getByLabel('Aktiva påminnelser').locator('li')).toHaveCount(5)
    await expect(details.getByRole('button', { name: 'Lägg till påminnelse' })).not.toBeVisible()
  })

  test('visar +N-märke i TaskRow när det finns flera påminnelser', async ({ page }) => {
    await page.goto('/')
    const details = await openDetailsForTask(page, 'Kontrollera mobilvyn')

    for (const time of ['08:00', '10:00']) {
      await details.getByRole('button', { name: 'Lägg till påminnelse' }).click()
      await details.getByLabel('Påminnelsedatum').fill(FUTURE_DATE)
      await details.getByLabel('Påminnelsetid').fill(time)
      await details.getByRole('button', { name: 'Spara påminnelse' }).click()
    }

    await details.getByRole('button', { name: 'Stäng uppgiftsdetaljer' }).click()

    // Kontrollera att påminnelsechippen innehåller +1-märket (oberoende av viewport)
    const task = page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' })
    const reminderChip = task.getByRole('img', { name: /Påminnelse/ })
    await expect(reminderChip).toBeVisible()
    await expect(reminderChip).toContainText('+1')
  })
})
