import { expect, test } from '@playwright/test'

test.describe('task drag-and-drop reorder', () => {
  test('reorders tasks with keyboard shortcuts', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Jag har sett detta' }).click()

    const tasks = page.locator('[data-task-id]')
    await expect(tasks.first()).toContainText('Testa dra och släppa uppgifter')
    await expect(tasks.nth(1)).toContainText('Kontrollera mobilvyn')

    // Flytta andra uppgiften uppåt med Alt+ArrowUp
    await tasks.nth(1).focus()
    await page.keyboard.press('Alt+ArrowUp')

    // Nu bör ordningen vara omvänd
    await expect(tasks.first()).toContainText('Kontrollera mobilvyn')
    await expect(tasks.nth(1)).toContainText('Testa dra och släppa uppgifter')

    await tasks.first().focus()
    await page.keyboard.press('Alt+ArrowDown')
    await expect(tasks.first()).toContainText('Testa dra och släppa uppgifter')
    await expect(tasks.nth(1)).toContainText('Kontrollera mobilvyn')

    // Ordningen bevaras efter omladdning
    await page.reload()
    await expect(tasks.first()).toContainText('Testa dra och släppa uppgifter')
    await expect(tasks.nth(1)).toContainText('Kontrollera mobilvyn')
  })

  test('reorders tasks using pointer drag and drop', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Jag har sett detta' }).click()

    const tasks = page.locator('[data-task-id]')
    const firstTask = tasks.first()
    const secondTask = tasks.nth(1)

    await expect(firstTask).toContainText('Testa dra och släppa uppgifter')
    await expect(secondTask).toContainText('Kontrollera mobilvyn')

    const firstHandle = firstTask.locator('[data-drag-handle]')
    await firstTask.hover()
    await expect(firstHandle).toBeVisible()

    const handleBox = await firstHandle.boundingBox()
    const secondBox = await secondTask.boundingBox()
    expect(handleBox).not.toBeNull()
    expect(secondBox).not.toBeNull()

    if (handleBox && secondBox) {
      // Dra det första elementet förbi det andra
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height - 5, { steps: 10 })
      await page.mouse.up()
    }

    // Bekräfta att ordningen ändrades
    await expect(tasks.first()).toContainText('Kontrollera mobilvyn')
    await expect(tasks.nth(1)).toContainText('Testa dra och släppa uppgifter')
    await expect(page.locator('[aria-labelledby="task-details-heading"]')).toHaveCount(0)
  })

  test('reorders subtasks with touch input on a mobile-sized viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/#/tasks/local-task-3')
    await page.getByRole('button', { name: 'Jag har sett detta' }).click()

    const details = page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })
    await details.getByRole('button', { name: 'Förbered och importera delsteg' }).click()
    await details.getByRole('textbox', { name: 'JSON för delsteg' }).fill(JSON.stringify({
      steps: ['Första delsteget', 'Andra delsteget'],
    }))
    await details.getByRole('button', { name: 'Importera delsteg', exact: true }).click()

    const stepRows = details.locator('[data-step-id]')
    await expect(stepRows).toHaveCount(2)
    const firstHandle = stepRows.first().locator('[data-step-drag-handle]')
    await expect(firstHandle).toHaveCSS('touch-action', 'none')
    const secondRowBox = await stepRows.nth(1).boundingBox()
    expect(secondRowBox).not.toBeNull()

    if (secondRowBox) {
      await firstHandle.evaluate((element, targetY) => {
        const dispatch = (target: EventTarget, type: string, clientY: number) => {
          target.dispatchEvent(new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 7,
            pointerType: 'touch',
            clientY,
          }))
        }
        dispatch(element, 'pointerdown', element.getBoundingClientRect().top + 10)
        dispatch(window, 'pointermove', targetY)
        dispatch(window, 'pointerup', targetY)
      }, secondRowBox.y + secondRowBox.height - 2)
    }

    await expect(stepRows.first()).toContainText('Andra delsteget')
    await expect(stepRows.nth(1)).toContainText('Första delsteget')
  })

  test('edits a subtask title on desktop without starting a drag', async ({ page }) => {
    await page.goto('/#/tasks/local-task-3')
    await page.getByRole('button', { name: 'Jag har sett detta' }).click()

    const details = page.getByRole('dialog', { name: 'Uppgiftsdetaljer' })
    await details.getByRole('button', { name: 'Förbered och importera delsteg' }).click()
    await details.getByRole('textbox', { name: 'JSON för delsteg' }).fill(JSON.stringify({
      steps: ['Första delsteget', 'Andra delsteget'],
    }))
    await details.getByRole('button', { name: 'Importera delsteg', exact: true }).click()

    await details.getByRole('button', { name: 'Redigera delsteg: Första delsteget' }).click()
    const titleInput = details.getByRole('textbox', { name: 'Redigera delsteg: Första delsteget' })
    await titleInput.fill('Uppdaterat delsteg')
    await titleInput.press('Enter')

    await expect(details.getByRole('button', { name: 'Redigera delsteg: Uppdaterat delsteg' })).toBeVisible()
  })

  test('shows drag handle on hover in list view', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Jag har sett detta' }).click()

    const firstTask = page.getByRole('group', { name: /Uppgift:/ }).first()
    await firstTask.hover()
    await expect(firstTask.locator('[data-drag-handle]')).toBeVisible()
  })

  test('does not show drag handle in smart views', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Jag har sett detta' }).click()
    await page.getByRole('button', { name: 'Viktigt' }).click()

    const task = page.getByRole('group', { name: /Uppgift:/ }).first()
    await task.hover()
    await expect(task.locator('[data-drag-handle]')).toHaveCount(0)
  })
})
