type E2EWriteOperation = 'create-task' | 'update-task' | 'create-list' | 'update-list'

const enabled = import.meta.env.VITE_E2E_FAILURE_INJECTION === 'true'

export const failE2EWriteIfRequested = (operation: E2EWriteOperation) => {
  if (!enabled || typeof localStorage === 'undefined') return
  if (localStorage.getItem('todo-e2e-fail-write') !== operation) return

  localStorage.removeItem('todo-e2e-fail-write')
  throw new Error(`Simulated write failure: ${operation}`)
}

export const failE2ETaskReadIfRequested = () => {
  if (!enabled || typeof localStorage === 'undefined') return
  if (localStorage.getItem('todo-e2e-fail-task-read') !== 'true') return

  localStorage.removeItem('todo-e2e-fail-task-read')
  throw new Error('Simulated task read failure')
}
