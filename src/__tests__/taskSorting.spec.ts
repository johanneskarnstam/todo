import { describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import type { Task } from '@/types'
import { sortTasksForMode } from '@/utils/taskSorting'

const task = (id: string, overrides: Partial<Task> = {}): Task => ({
  id,
  listId: 'list-1',
  title: id,
  completed: false,
  important: false,
  myDay: false,
  createdAt: Timestamp.fromMillis(1),
  ...overrides,
})

describe('sortTasksForMode', () => {
  it('sorts manually without mutating the input', () => {
    const tasks = [task('second', { order: 2 }), task('first', { order: 1 })]

    expect(sortTasksForMode(tasks, 'manual').map((item) => item.id)).toEqual(['first', 'second'])
    expect(tasks.map((item) => item.id)).toEqual(['second', 'first'])
  })

  it('sorts missing due dates last', () => {
    const tasks = [
      task('missing'),
      task('later', { dueDate: '2026-10-02' }),
      task('sooner', { dueDate: '2026-10-01' }),
    ]

    expect(sortTasksForMode(tasks, 'dueDate').map((item) => item.id)).toEqual(['sooner', 'later', 'missing'])
  })

  it('sorts important tasks first and completed tasks after active tasks', () => {
    const tasks = [
      task('completed-important', { important: true, completed: true }),
      task('active-important', { important: true }),
      task('active-normal'),
    ]

    expect(sortTasksForMode(tasks, 'priority').map((item) => item.id)).toEqual([
      'active-important',
      'completed-important',
      'active-normal',
    ])
  })
})
