import type { Page } from '@playwright/test'

export type E2EWriteOperation = 'create-task' | 'update-task' | 'create-list' | 'update-list'

export const failNextWrite = (page: Page, operation: E2EWriteOperation) =>
  page.addInitScript((nextOperation) => {
    localStorage.setItem('todo-e2e-fail-write', nextOperation)
  }, operation)

export const failNextTaskRead = (page: Page) =>
  page.addInitScript(() => {
    localStorage.setItem('todo-e2e-fail-task-read', 'true')
    localStorage.setItem('todo-mock-tasks', JSON.stringify([{
      id: 'cached-task-after-read-failure',
      listId: '__default__',
      title: 'Uppgift från lokal cache',
      completed: false,
      important: false,
      myDay: false,
      order: 0,
      createdAt: Date.now(),
    }]))
  })
