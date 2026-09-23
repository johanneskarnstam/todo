import { onUnmounted } from 'vue'
import type { Task } from '@/types'

const reminderTimers = new Map<string, ReturnType<typeof setTimeout>>()

const reminderTime = (dueDate: Task['dueDate']): number | null => {
  if (!dueDate) return null

  const date = typeof dueDate === 'string'
    ? new Date(`${dueDate}T09:00:00`)
    : dueDate.toDate()

  return Number.isNaN(date.getTime()) ? null : date.getTime()
}

const clearTaskReminder = (taskId: string) => {
  const timer = reminderTimers.get(taskId)
  if (timer) {
    clearTimeout(timer)
    reminderTimers.delete(taskId)
  }
}

export const useReminderNotifications = () => {
  const isSupported = typeof window !== 'undefined' && 'Notification' in window

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false

    return (await Notification.requestPermission()) === 'granted'
  }

  const scheduleTaskReminder = (task: Pick<Task, 'id' | 'title' | 'dueDate'>) => {
    clearTaskReminder(task.id)
    if (!isSupported || Notification.permission !== 'granted') return

    const reminderAt = reminderTime(task.dueDate)
    if (!reminderAt || reminderAt <= Date.now()) return

    const timer = setTimeout(() => {
      reminderTimers.delete(task.id)
      if (Notification.permission === 'granted') {
        new Notification(`Due today: ${task.title}`, {
          body: 'Open Todo to review this task.',
          tag: `todo-task-${task.id}`,
        })
      }
    }, reminderAt - Date.now())

    reminderTimers.set(task.id, timer)
  }

  const cancelTaskReminder = (taskId: string) => {
    clearTaskReminder(taskId)
  }

  onUnmounted(() => {
    for (const taskId of reminderTimers.keys()) clearTaskReminder(taskId)
  })

  return { requestPermission, scheduleTaskReminder, cancelTaskReminder }
}
