import type { Task } from '@/types'

interface CalendarRange {
  dates: string
  timeZone?: string
}

const pad = (value: number): string => String(value).padStart(2, '0')

const calendarDate = (date: Date): string =>
  `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`

const calendarDateTime = (date: Date): string =>
  `${calendarDate(date)}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`

const dateRangeFor = (dueDate: Task['dueDate']): CalendarRange | null => {
  if (!dueDate) return null

  let start: Date
  let hasTime: boolean

  if (typeof dueDate === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(dueDate)
    if (!match) return null

    const [, year, month, day, hour, minute, second] = match
    start = new Date(Number(year), Number(month) - 1, Number(day), Number(hour ?? 0), Number(minute ?? 0), Number(second ?? 0))
    if (start.getFullYear() !== Number(year) || start.getMonth() !== Number(month) - 1 || start.getDate() !== Number(day)) return null
    hasTime = hour !== undefined
  } else {
    start = dueDate.toDate()
    hasTime = start.getHours() !== 0 || start.getMinutes() !== 0 || start.getSeconds() !== 0
  }

  if (hasTime) {
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    return {
      dates: `${calendarDateTime(start)}/${calendarDateTime(end)}`,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    }
  }

  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { dates: `${calendarDate(start)}/${calendarDate(end)}` }
}

export const createGoogleCalendarUrl = (task: Pick<Task, 'title' | 'note' | 'dueDate'>): string => {
  const params = new URLSearchParams({ action: 'TEMPLATE', text: task.title })
  const note = task.note?.trim()
  if (note) params.set('details', note)

  const range = dateRangeFor(task.dueDate)
  if (range) {
    params.set('dates', range.dates)
    if (range.timeZone) params.set('ctz', range.timeZone)
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
