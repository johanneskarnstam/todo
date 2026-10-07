import type { Timestamp } from 'firebase/firestore'

export interface Folder {
  id: string
  name: string
  order: number
}

export type ListSortMode = 'manual' | 'created' | 'createdDesc' | 'dueDate' | 'priority'
export type ListViewMode = 'detailed' | 'compact'
export type TaskStatus = 'todo' | 'inProgress' | 'completed'
export type TaskStatusMode = 'binary' | 'threeStep'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TaskPriorityFilterValue = 'all' | TaskPriority

export interface List {
  id: string
  name: string
  folderId?: string
  icon: string
  order: number
  createdAt: Timestamp
  themeColor?: string
  sortMode?: ListSortMode
  newTasksFirst?: boolean
  showCompletedTasks?: boolean
  archiveCompletedTasks?: boolean
  confirmDeletes?: boolean
  showStepsByDefault?: boolean
  viewMode?: ListViewMode
  taskStatusMode?: TaskStatusMode
}

export type ReminderMode = 'relative' | 'absolute'

export type ReminderOffset = 0 | 10 | 60 | 120 | 1440

export interface RelativeReminder {
  mode: 'relative'
  offsetMinutes: ReminderOffset | number
}

export interface AbsoluteReminder {
  mode: 'absolute'
  at: string
  timeZone: string
}

export type TaskReminder = RelativeReminder | AbsoluteReminder

export interface LegacyTaskReminder {
  mode?: 'relative'
  offsetMinutes: ReminderOffset | number
}

export interface Task {
  id: string
  listId: string
  title: string
  completed: boolean
  important: boolean
  priority?: TaskPriority
  myDay: boolean
  dueDate?: string | Timestamp
  dueTimeZone?: string
  reminder?: LegacyTaskReminder | null
  reminders?: TaskReminder[]
  note?: string
  tags?: string[]
  createdAt: Timestamp
  order?: number
  archived?: boolean
  status?: TaskStatus
}

export interface Step {
  id: string
  taskId: string
  title: string
  completed: boolean
  createdAt: Timestamp
  order?: number
}

export interface StepCount {
  completed: number
  total: number
}

export type SmartView = 'myDay' | 'important' | 'planned' | 'archived'

export type TaskView =
  | { type: 'list'; listId: string }
  | { type: 'smart'; smartView: SmartView }
  | { type: 'tag'; tag: string }
