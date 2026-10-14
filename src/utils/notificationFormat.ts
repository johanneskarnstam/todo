export interface NotificationBodyOptions {
  listName?: string | null
  stepCount?: { completed: number; total: number } | null
  note?: string | null
}

export const formatNotificationBody = (options: NotificationBodyOptions): string => {
  const metaParts: string[] = []

  if (options.listName && options.listName.trim()) {
    metaParts.push(options.listName.trim())
  }

  if (options.stepCount && options.stepCount.total > 0) {
    metaParts.push(`(${options.stepCount.completed}/${options.stepCount.total})`)
  }

  const metaLine = metaParts.join(' ')
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
