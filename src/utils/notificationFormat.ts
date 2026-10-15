import type { TaskPriority } from '@/types'
import { taskPriorityLabel } from '@/utils/taskPriority'

export interface NotificationBodyOptions {
  listName?: string | null
  stepCount?: { completed: number; total: number } | null
  note?: string | null
  priority?: TaskPriority | null
}

export const formatNotificationBody = (options: NotificationBodyOptions): string => {
  const metaParts: string[] = []

  if (options.listName && options.listName.trim()) {
    metaParts.push(options.listName.trim())
  }

  if (options.stepCount && options.stepCount.total > 0) {
    metaParts.push(`Deluppgifter ${options.stepCount.completed}/${options.stepCount.total} klara`)
  }

  if (options.priority && options.priority !== 'normal') {
    metaParts.push(`Prioritet: ${taskPriorityLabel(options.priority)}`)
  }

  const metaLine = metaParts.join(' · ')
  const trimmedNote = options.note?.trim()

  if (metaLine && trimmedNote) {
    return `${metaLine}\n${trimmedNote}`
  }
  if (metaLine) {
    return metaLine
  }
  if (trimmedNote) {
    return trimmedNote
  }
  return ''
}
