import type { ListSortMode, Task } from '@/types'
import { isTaskCompleted } from '@/utils/taskStatus'
import { getTaskPriority } from '@/utils/taskPriority'

const priorityRank = { low: 0, normal: 1, high: 2, urgent: 3 } as const

const dueDateKey = (task: Task): string => {
  if (!task.dueDate) return '9999-12-31'
  if (typeof task.dueDate === 'string') return task.dueDate.slice(0, 10)
  return task.dueDate.toDate().toISOString().slice(0, 10)
}

const compareCreatedAt = (first: Task, second: Task): number =>
  first.createdAt.toMillis() - second.createdAt.toMillis() || first.id.localeCompare(second.id)

export const sortTasksForMode = (tasks: Task[], sortMode: ListSortMode): Task[] => [...tasks].sort((first, second) => {
  if (sortMode === 'created') return compareCreatedAt(first, second)
  if (sortMode === 'createdDesc') return compareCreatedAt(second, first)
  if (sortMode === 'dueDate') {
    return dueDateKey(first).localeCompare(dueDateKey(second)) || compareCreatedAt(first, second)
  }

  if (sortMode === 'priority') {
    return priorityRank[getTaskPriority(second)] - priorityRank[getTaskPriority(first)]
      || Number(isTaskCompleted(first)) - Number(isTaskCompleted(second))
      || compareCreatedAt(first, second)
  }

  if (first.listId !== second.listId) return compareCreatedAt(first, second)

  const firstOrder = first.order ?? Number.MAX_SAFE_INTEGER
  const secondOrder = second.order ?? Number.MAX_SAFE_INTEGER
  return firstOrder - secondOrder || compareCreatedAt(first, second)
})
