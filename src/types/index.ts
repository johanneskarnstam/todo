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
  dueTimeZone?: string
  reminder?: TaskReminder | null
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
  aiSuggestionId?: string
}

export interface AiSuggestionSelection {
  suggestionId: string
  selected: boolean
  title?: string
}

export interface StepCount {
  completed: number
  total: number
}

export type AiBreakdownSuggestionStatus = 'available' | 'skipped' | 'added'

export interface AiBreakdownMetadata {
  schemaVersion: 1
  modelId: string
  sourceTitle: string
  sourceNote: string
  sourcePrompt: string
  generatedAt: Timestamp
  suggestionCount: number
  suggestionIds: string[]
}

export interface AiBreakdownSuggestion {
  id: string
  title: string
  order: number
  status: AiBreakdownSuggestionStatus
  stepId?: string
}

export interface TaskAiBreakdown {
  metadata: AiBreakdownMetadata
  suggestions: AiBreakdownSuggestion[]
}

export type SmartView = 'myDay' | 'important' | 'planned' | 'archived'

export type TaskView =
  | { type: 'list'; listId: string }
  | { type: 'smart'; smartView: SmartView }
  | { type: 'tag'; tag: string }
