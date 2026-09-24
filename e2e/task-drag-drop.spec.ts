import { expect, test, type Page } from '@playwright/test'

const taskOrder = async (page: Page) => {
  return page.locator('article[data-task-id]').evaluateAll((rows) =>
    rows.map((row) => row.getAttribute('data-task-id')),
  )
}

test('moves a task before another task with pointer drag', async ({ page }) => {
  await page.goto('/')

  const source = page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' })
  const target = page.getByRole('group', { name: 'Uppgift: Testa dra och släppa uppgifter' })
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  expect(sourceBox).not.toBeNull()
  expect(targetBox).not.toBeNull()

  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2 + 20, sourceBox!.y + sourceBox!.height / 2 + 20)
  await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + 8, { steps: 5 })

  await expect(target.locator('div[aria-hidden="true"]')).toHaveCount(1)
  await page.mouse.up()

  await expect.poll(() => taskOrder(page)).toEqual(['local-task-2', 'local-task-1'])
  await expect(page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })).toHaveCount(0)
})
