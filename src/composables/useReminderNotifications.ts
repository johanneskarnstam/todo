import { onUnmounted } from 'vue'
import type { Task } from '@/types'
import { usePreferences } from '@/composables/usePreferences'

const reminderTimers = new Map<string, ReturnType<typeof setTimeout>>()
const maxTimeout = 2_147_000_000

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
  const { preferences } = usePreferences()
  const isSupported = typeof window !== 'undefined' && 'Notification' in window

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false

    return (await Notification.requestPermission()) === 'granted'
  }

  const scheduleTaskReminder = (task: Pick<Task, 'id' | 'title' | 'dueDate' | 'reminder'>) => {
    clearTaskReminder(task.id)
    if (!preferences.value.notifications || !isSupported || Notification.permission !== 'granted' || !task.reminder) return

    const dueAt = reminderTime(task.dueDate)
    const reminderAt = dueAt ? dueAt - task.reminder.offsetMinutes * 60_000 : null
    if (!reminderAt || reminderAt <= Date.now()) return

    const schedule = () => {
      const remaining = reminderAt - Date.now()
      if (remaining <= 0) {
        reminderTimers.delete(task.id)
        if (Notification.permission === 'granted') {
          new Notification(`Påminnelse: ${task.title}`, {
            body: 'Det är dags att se över uppgiften.',
            tag: `todo-task-${task.id}`,
          })
        }
        return
      }

      const timer = setTimeout(schedule, Math.min(remaining, maxTimeout))
      reminderTimers.set(task.id, timer)
    }

    schedule()
  }

  const cancelTaskReminder = (taskId: string) => {
    clearTaskReminder(taskId)
  }

  onUnmounted(() => {
    for (const taskId of reminderTimers.keys()) clearTaskReminder(taskId)
  })

  return { requestPermission, scheduleTaskReminder, cancelTaskReminder }
}
