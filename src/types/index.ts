import type { Timestamp } from 'firebase/firestore'

export interface Folder {
  id: string
  name: string
  order: number
}

export interface List {
  id: string
  name: string
  folderId?: string
  icon: string
  order: number
  createdAt: Timestamp
  themeColor?: string
}

export interface TaskReminder {
  offsetMinutes: 0 | 10 | 60 | 1440
}

export interface Task {
  id: string
  listId: string
  title: string
  completed: boolean
  important: boolean
  myDay: boolean
  dueDate?: string | Timestamp
  reminder?: TaskReminder | null
  note?: string
  tags?: string[]
  createdAt: Timestamp
  order?: number
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

export type SmartView = 'myDay' | 'important' | 'planned'

export type TaskView =
  | { type: 'list'; listId: string }
  | { type: 'smart'; smartView: SmartView }
  | { type: 'tag'; tag: string }
