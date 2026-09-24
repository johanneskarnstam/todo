import { expect, test, type Locator } from '@playwright/test'

const dispatchTouchPointer = async (row: Locator, type: string, values: Record<string, number | string>) => {
  await row.dispatchEvent(type, {
    pointerId: 1,
    pointerType: 'touch',
    button: 0,
    ...values,
  })
}

test('moves a task with touch pointer events on a mobile viewport', async ({ page }) => {
  await page.goto('/')

  const source = page.getByRole('group', { name: 'Uppgift: Kontrollera mobilvyn' })
  const target = page.getByRole('group', { name: 'Uppgift: Testa dra och släppa uppgifter' })
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  expect(sourceBox).not.toBeNull()
  expect(targetBox).not.toBeNull()

  const sourcePoint = {
    clientX: sourceBox!.x + sourceBox!.width / 2,
    clientY: sourceBox!.y + sourceBox!.height / 2,
  }
  const targetPoint = {
    clientX: targetBox!.x + targetBox!.width / 2,
    clientY: targetBox!.y + 8,
  }

  await dispatchTouchPointer(source, 'pointerdown', sourcePoint)
  await dispatchTouchPointer(source, 'pointermove', { clientX: sourcePoint.clientX + 20, clientY: sourcePoint.clientY + 20 })
  await dispatchTouchPointer(source, 'pointermove', targetPoint)

  await expect(target.locator('div[aria-hidden="true"]')).toHaveCount(1)
  await dispatchTouchPointer(source, 'pointerup', targetPoint)
  await expect.poll(() => page.locator('article[data-task-id]').evaluateAll((rows) =>
    rows.map((row) => row.getAttribute('data-task-id')),
  )).toEqual(['local-task-2', 'local-task-1'])
  await expect(page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })).toHaveCount(0)
})
