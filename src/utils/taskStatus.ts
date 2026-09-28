import type { Task, TaskStatus, TaskStatusMode } from '@/types'

export const getTaskStatus = (task: Task): TaskStatus => task.status ?? (task.completed ? 'completed' : 'todo')

export const isTaskCompleted = (task: Task): boolean => getTaskStatus(task) === 'completed'

export const isTaskStatusAllowed = (status: TaskStatus, mode: TaskStatusMode): boolean =>
  mode === 'threeStep' || status !== 'inProgress'

export const taskStatusToCompleted = (status: TaskStatus): boolean => status === 'completed'
