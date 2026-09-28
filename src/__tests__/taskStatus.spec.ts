import { describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import type { Task } from '@/types'
import { getTaskStatus, isTaskCompleted, isTaskStatusAllowed } from '@/utils/taskStatus'

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  listId: 'list-1',
  title: 'Task',
  completed: false,
  important: false,
  myDay: false,
  createdAt: Timestamp.fromMillis(1),
  ...overrides,
})

describe('task status helpers', () => {
  it('falls back to completed for legacy tasks', () => {
    expect(getTaskStatus(task())).toBe('todo')
    expect(getTaskStatus(task({ completed: true }))).toBe('completed')
  })

  it('only treats completed as completed', () => {
    expect(isTaskCompleted(task({ status: 'todo' }))).toBe(false)
    expect(isTaskCompleted(task({ status: 'inProgress' }))).toBe(false)
    expect(isTaskCompleted(task({ status: 'completed' }))).toBe(true)
  })

  it('allows in progress only in three-step mode', () => {
    expect(isTaskStatusAllowed('inProgress', 'binary')).toBe(false)
    expect(isTaskStatusAllowed('inProgress', 'threeStep')).toBe(true)
    expect(isTaskStatusAllowed('completed', 'binary')).toBe(true)
  })
})
