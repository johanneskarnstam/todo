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
}

export interface Task {
  id: string
  listId: string
  title: string
  completed: boolean
  important: boolean
  myDay: boolean
  createdAt: Timestamp
}
