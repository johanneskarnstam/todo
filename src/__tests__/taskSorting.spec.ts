import { describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import type { Task } from '@/types'
import { sortTasksForMode } from '@/utils/taskSorting'
import { filterTasksByPriority } from '@/utils/taskPriority'

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

  it('sorts by priority and keeps completed tasks after active tasks at the same priority', () => {
    const tasks = [
      task('completed-high', { priority: 'high', important: true, completed: true }),
      task('active-high', { priority: 'high', important: true }),
      task('active-normal'),
      task('active-low', { priority: 'low' }),
      task('active-urgent', { priority: 'urgent', important: true }),
    ]

    expect(sortTasksForMode(tasks, 'priority').map((item) => item.id)).toEqual([
      'active-urgent',
      'active-high',
      'completed-high',
      'active-normal',
      'active-low',
    ])
  })
})

describe('filterTasksByPriority', () => {
  it('returns only tasks matching one priority and preserves all tasks for all', () => {
    const tasks = [
      task('legacy-important', { important: true }),
      task('urgent', { priority: 'urgent', important: true }),
      task('low', { priority: 'low' }),
    ]

    expect(filterTasksByPriority(tasks, 'high').map((item) => item.id)).toEqual(['legacy-important'])
    expect(filterTasksByPriority(tasks, 'urgent').map((item) => item.id)).toEqual(['urgent'])
    expect(filterTasksByPriority(tasks, 'all')).toEqual(tasks)
    expect(filterTasksByPriority(tasks, 'all')).not.toBe(tasks)
  })
})
