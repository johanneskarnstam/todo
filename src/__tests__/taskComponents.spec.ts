import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { Timestamp } from 'firebase/firestore'
import TaskDetailsPanel from '@/components/TaskDetailsPanel.vue'
import TaskRow from '@/components/TaskRow.vue'
import type { Step, Task } from '@/types'

const task: Task = {
  id: 'task-1',
  listId: 'list-1',
  title: 'Paint the wall',
  completed: false,
  important: false,
  myDay: false,
  createdAt: Timestamp.now(),
}

describe('TaskRow', () => {
  it('opens details from the row and keeps inline controls independent', async () => {
    const wrapper = mount(TaskRow, { props: { task } })

    await wrapper.find('article').trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(1)

    await wrapper.find('button[aria-label="Markera uppgift som slutförd"]').trigger('click')
    expect(wrapper.emitted('toggle-completed')).toHaveLength(1)
    expect(wrapper.emitted('select')).toHaveLength(1)

    await wrapper.find('button[aria-label="Uppgiftsåtgärder"]').trigger('click')
    await nextTick()
    const starButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Stjärnmarkera')
    expect(starButton).toBeTruthy()
    starButton?.click()
    expect(wrapper.emitted('toggle-important')).toHaveLength(1)
    expect(wrapper.emitted('select')).toHaveLength(1)

    await wrapper.find('button[aria-label="Uppgiftsåtgärder"]').trigger('click')
    await nextTick()
    const myDayButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Lägg till i Min dag')
    expect(myDayButton).toBeTruthy()
    myDayButton?.click()
    expect(wrapper.emitted('toggle-my-day')).toHaveLength(1)
  })

  it('shows a subtask count only when steps exist', () => {
    const withSteps = mount(TaskRow, {
      props: { task, stepCount: { completed: 2, total: 3 } },
    })
    expect(withSteps.text()).toContain('(2/3)')
    expect(withSteps.find('[aria-label="2 av 3 delsteg klara"]').exists()).toBe(true)

    const withoutSteps = mount(TaskRow, { props: { task } })
    expect(withoutSteps.text()).not.toContain('(/')
  })

  it('toggles completion with Space and opens details with Enter', async () => {
    const wrapper = mount(TaskRow, { props: { task } })
    const row = wrapper.find('article')

    await row.trigger('keydown', { key: ' ' })
    await row.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('toggle-completed')).toHaveLength(1)
    expect(wrapper.emitted('select')).toHaveLength(1)
  })

  it('offers every task action from the vertical actions menu', async () => {
    const wrapper = mount(TaskRow, { props: { task } })
    const openMenu = () => wrapper.find('button[aria-label="Uppgiftsåtgärder"]').trigger('click')

    await openMenu()
    await nextTick()
    const detailsButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Visa detaljer')
    expect(detailsButton).toBeTruthy()
    detailsButton?.click()
    expect(wrapper.emitted('select')).toHaveLength(1)

    await openMenu()
    await nextTick()
    const completeButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Markera som slutförd')
    expect(completeButton).toBeTruthy()
    completeButton?.click()
    expect(wrapper.emitted('toggle-completed')).toHaveLength(1)
  })

  it('keeps swipe and dropdown interaction exclusive to one row', async () => {
    document.querySelectorAll('[data-task-menu-id]').forEach((menu) => menu.remove())
    const secondTask = { ...task, id: 'task-2', title: 'Paint the ceiling' }
    const firstWrapper = mount(TaskRow, { props: { task }, attachTo: document.body })
    const secondWrapper = mount(TaskRow, { props: { task: secondTask }, attachTo: document.body })

    await firstWrapper.find('button[aria-label="Uppgiftsåtgärder"]').trigger('click')
    await nextTick()
    expect(document.body.querySelector('[data-task-menu-id="task-1"]')).toBeTruthy()

    const startSecondTouch = new Event('touchstart', { bubbles: true })
    Object.defineProperty(startSecondTouch, 'touches', { value: [{ clientX: 100 }] })
    secondWrapper.element.dispatchEvent(startSecondTouch)
    await nextTick()
    expect(document.body.querySelector('[data-task-menu-id="task-1"]')).toBeNull()

    await firstWrapper.find('article').trigger('touchstart', { touches: [{ clientX: 100 }] })
    await firstWrapper.find('article').trigger('touchmove', { touches: [{ clientX: 20 }] })
    await firstWrapper.find('article').trigger('touchend')
    expect(firstWrapper.find('div.relative.flex').attributes('style')).toContain('translateX(-96px)')

    await secondWrapper.find('article').trigger('touchstart', { touches: [{ clientX: 100 }] })
    expect(firstWrapper.find('div.relative.flex').attributes('style')).toContain('translateX(0px)')

    firstWrapper.unmount()
    secondWrapper.unmount()
  })
})

describe('TaskDetailsPanel', () => {
  const steps: Step[] = [
    {
      id: 'step-1',
      taskId: 'task-1',
      title: 'Buy paint',
      completed: false,
      createdAt: Timestamp.now(),
    },
  ]

  it('emits updates for title, steps, My day, due date, notes, and deletion', async () => {
    const wrapper = mount(TaskDetailsPanel, { props: { task, steps } })

    const titleInput = wrapper.find('input[aria-label="Uppgiftens titel"]')
    await titleInput.setValue('Paint the ceiling')
    await titleInput.trigger('blur')
    expect(wrapper.emitted('save-title')).toEqual([['Paint the ceiling']])

    const stepInput = wrapper.find('input[placeholder="Lägg till delsteg"]')
    await stepInput.setValue('Protect floor')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('add-step')).toEqual([['Protect floor']])

    await wrapper.find('input[type="checkbox"]').trigger('change')
    expect(wrapper.emitted('toggle-step')).toEqual([['step-1']])

    await wrapper.find('button[aria-label="Ta bort delsteg: Buy paint"]').trigger('click')
    expect(wrapper.emitted('delete-step')).toEqual([['step-1']])

    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()

    const myDayButton = wrapper.findAll('button').find((button) => button.text().includes('Lägg till i Min dag'))
    await myDayButton?.trigger('click')
    expect(wrapper.emitted('toggle-my-day')).toHaveLength(1)

    const dateInput = wrapper.find('input[type="date"]')
    await dateInput.setValue('2026-10-01')
    expect(wrapper.emitted('set-due-date')).toEqual([['2026-10-01']])

    const noteInput = wrapper.find('textarea')
    await noteInput.setValue('Use the blue paint.')
    await noteInput.trigger('blur')
    expect(wrapper.emitted('save-note')).toEqual([['Use the blue paint.']])

    const deleteButton = wrapper.findAll('button').find((button) => button.text().includes('Ta bort uppgift'))
    await deleteButton?.trigger('click')
    expect(wrapper.emitted('delete-task')).toHaveLength(1)
  })

  it('makes a subtask title editable when its text is clicked', async () => {
    const wrapper = mount(TaskDetailsPanel, { props: { task, steps } })

    const stepButton = wrapper.findAll('button').find((button) => button.text() === 'Buy paint')
    await stepButton?.trigger('click')
    const editInput = wrapper.find('input[aria-label="Redigera delsteg: Buy paint"]')
    await editInput.setValue('Buy green paint')
    await editInput.trigger('keydown.enter')

    expect(wrapper.emitted('save-step-title')).toEqual([['step-1', 'Buy green paint']])
  })
})
