import type { Task, TaskPriority, TaskPriorityFilterValue } from '@/types'

export type TaskPriorityCounts = Record<TaskPriority, number>

export const taskPriorityLabel = (priority: TaskPriority): string => ({
  low: 'Låg',
  normal: 'Normal',
  high: 'Hög',
  urgent: 'Brådskande',
})[priority]

export const isTaskPriority = (value: unknown): value is TaskPriority =>
  value === 'low' || value === 'normal' || value === 'high' || value === 'urgent'

export const getTaskPriority = (task: Pick<Task, 'priority' | 'important'>): TaskPriority => {
  if (isTaskPriority(task.priority)) return task.priority
  return task.important ? 'high' : 'normal'
}

export const isImportantPriority = (priority: TaskPriority): boolean =>
  priority === 'high' || priority === 'urgent'

export const filterTasksByPriority = <T extends Pick<Task, 'priority' | 'important'>>(
  tasks: readonly T[],
  filter: TaskPriorityFilterValue,
): T[] => filter === 'all' ? [...tasks] : tasks.filter((task) => getTaskPriority(task) === filter)

export const countTaskPriorities = (tasks: readonly Pick<Task, 'priority' | 'important'>[]): TaskPriorityCounts => {
  const counts: TaskPriorityCounts = { low: 0, normal: 0, high: 0, urgent: 0 }
  for (const task of tasks) counts[getTaskPriority(task)] += 1
  return counts
}

export const normalizeTaskPriority = <T extends Task>(task: T): T & { priority: TaskPriority } => {
  const priority = getTaskPriority(task)
  return { ...task, priority, important: isImportantPriority(priority) }
}
