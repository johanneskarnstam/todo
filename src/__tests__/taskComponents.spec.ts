import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
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

    await wrapper.find('button[aria-label="Mark task completed"]').trigger('click')
    expect(wrapper.emitted('toggle-completed')).toHaveLength(1)
    expect(wrapper.emitted('select')).toHaveLength(1)

    await wrapper.find('button[aria-label="Mark task important"]').trigger('click')
    expect(wrapper.emitted('toggle-important')).toHaveLength(1)
    expect(wrapper.emitted('select')).toHaveLength(1)
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

    const titleInput = wrapper.find('input[aria-label="Task title"]')
    await titleInput.setValue('Paint the ceiling')
    await titleInput.trigger('blur')
    expect(wrapper.emitted('save-title')).toEqual([['Paint the ceiling']])

    const stepInput = wrapper.find('input[placeholder="Add step"]')
    await stepInput.setValue('Protect floor')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('add-step')).toEqual([['Protect floor']])

    await wrapper.find('input[type="checkbox"]').trigger('change')
    expect(wrapper.emitted('toggle-step')).toEqual([['step-1']])

    await wrapper.find('button[aria-label="Delete step Buy paint"]').trigger('click')
    expect(wrapper.emitted('delete-step')).toEqual([['step-1']])

    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()

    const myDayButton = wrapper.findAll('button').find((button) => button.text().includes('Add to My day'))
    await myDayButton?.trigger('click')
    expect(wrapper.emitted('toggle-my-day')).toHaveLength(1)

    const dateInput = wrapper.find('input[type="date"]')
    await dateInput.setValue('2026-10-01')
    expect(wrapper.emitted('set-due-date')).toEqual([['2026-10-01']])

    const noteInput = wrapper.find('textarea')
    await noteInput.setValue('Use the blue paint.')
    await noteInput.trigger('blur')
    expect(wrapper.emitted('save-note')).toEqual([['Use the blue paint.']])

    const deleteButton = wrapper.findAll('button').find((button) => button.text().includes('Delete task'))
    await deleteButton?.trigger('click')
    expect(wrapper.emitted('delete-task')).toHaveLength(1)
  })

  it('makes a subtask title editable when its text is clicked', async () => {
    const wrapper = mount(TaskDetailsPanel, { props: { task, steps } })

    const stepButton = wrapper.findAll('button').find((button) => button.text() === 'Buy paint')
    await stepButton?.trigger('click')
    const editInput = wrapper.find('input[aria-label="Edit step Buy paint"]')
    await editInput.setValue('Buy green paint')
    await editInput.trigger('keydown.enter')

    expect(wrapper.emitted('save-step-title')).toEqual([['step-1', 'Buy green paint']])
  })
})
