import { expect, test } from '@playwright/test'

test('mock-auth opens the app without a login step', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/todo\/#\/$/)
  await expect(page.getByRole('heading', { name: 'Att göra' })).toBeVisible()
  await expect(page.getByText('Testa dra och släppa uppgifter')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Logga in på To Do' })).toHaveCount(0)
})

test('shows the offline banner and hides it when the connection returns', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Att göra' })).toBeVisible()

  await context.setOffline(true)
  await expect(page.getByText('Du är offline', { exact: false })).toBeVisible()
  await expect(page.getByText('Ändringar sparas lokalt och synkas när anslutningen är tillbaka.')).toBeVisible()

  await context.setOffline(false)
  await expect(page.getByText('Du är offline', { exact: false })).toHaveCount(0)
})

test('shows the latest release notes once per user and version', async ({ page }) => {
  await page.goto('/')

  const releaseDialog = page.getByRole('dialog', { name: 'Senaste förändringarna' })
  await expect(releaseDialog).toBeVisible()
  await expect(releaseDialog).toContainText('Enhetliga kort i uppgiftsdetaljer')
  await expect(releaseDialog).toContainText('v0.26.2')

  await releaseDialog.getByRole('button', { name: 'Jag har sett detta' }).click()
  await expect(releaseDialog).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('dialog', { name: 'Senaste förändringarna' })).toHaveCount(0)
})

test('shows the feature overview once for a first-time account', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('feature-overview-seeded') !== 'true') {
      localStorage.setItem('todo-feature-overview-pending:local-dev-user', 'true')
      sessionStorage.setItem('feature-overview-seeded', 'true')
    }
  })
  await page.goto('/')

  const featuresDialog = page.getByRole('dialog', { name: 'Appens funktioner' })
  await expect(featuresDialog).toBeVisible()
  await featuresDialog.getByRole('button', { name: 'Stäng funktionsöversikten' }).click()
  await expect(featuresDialog).toHaveCount(0)

  const releaseDialog = page.getByRole('dialog', { name: 'Senaste förändringarna' })
  await expect(releaseDialog).toBeVisible()
  await releaseDialog.getByRole('button', { name: 'Jag har sett detta' }).click()

  await page.reload()
  await expect(page.getByRole('dialog', { name: 'Appens funktioner' })).toHaveCount(0)
})

test('smart views are reachable from their routes', async ({ page }) => {
  await page.goto('#/important')

  await expect(page).toHaveURL(/\/todo\/#\/important$/)
  await expect(page.getByRole('heading', { name: 'Stjärnmärkt' })).toBeVisible()
  await expect(page.getByText('Testa dra och släppa uppgifter')).toBeVisible()
})

test('planned view opens the planned task view', async ({ page }) => {
  await page.goto('#/planned')

  await expect(page.getByRole('heading', { name: 'Planerat' })).toBeVisible()
})
