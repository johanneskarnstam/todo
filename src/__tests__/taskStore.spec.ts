import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { Timestamp } from 'firebase/firestore'
import { useTaskStore } from '@/stores/taskStore'

const firestoreMocks = vi.hoisted(() => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  deleteField: vi.fn(() => 'delete-field'),
  doc: vi.fn(),
  getDocs: vi.fn(),
  getDocsFromCache: vi.fn(),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
  updateDoc: vi.fn(),
  writeBatch: vi.fn(),
}))

vi.mock('@/firebase', () => ({
  auth: { currentUser: { uid: 'user-1' } },
  db: {},
}))

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore')
  return { ...actual, ...firestoreMocks }
})

const snapshot = (documents: Array<{ id: string; data: () => Record<string, unknown> }>) => ({
  docs: documents,
})

const taskDocument = (id: string, data: Record<string, unknown>) => ({ id, data: () => data })

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('useTaskStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    firestoreMocks.collection.mockImplementation((...path: string[]) => ({ path }))
    firestoreMocks.doc.mockImplementation((...path: string[]) => ({ path }))
    firestoreMocks.getDocs.mockResolvedValue(snapshot([]))
    firestoreMocks.getDocsFromCache.mockResolvedValue(snapshot([]))
    firestoreMocks.addDoc.mockResolvedValue({ id: 'persisted-id' })
    firestoreMocks.updateDoc.mockResolvedValue(undefined)
    firestoreMocks.deleteDoc.mockResolvedValue(undefined)
    firestoreMocks.writeBatch.mockReturnValue({
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    })
  })

  it('clears tasks, steps, and active view on logout', () => {
    const store = useTaskStore()
    store.tasks.push({
      id: 'task-1', listId: 'list-1', title: 'Task', completed: false, important: false,
      myDay: true, createdAt: Timestamp.now(),
    })
    store.allSteps.push({
      id: 'step-1', taskId: 'task-1', title: 'Step', completed: false, createdAt: Timestamp.now(),
    })
    store.setListView('list-1')
    store.activeTaskId = 'task-1'

    store.clearState()

    expect(store.tasks).toEqual([])
    expect(store.allSteps).toEqual([])
    expect(store.activeTaskId).toBeNull()
    expect(store.activeView).toBeNull()
  })

  it('filters loaded tasks by custom list, Important, and My day views', async () => {
    const createdAt = Timestamp.now()
    firestoreMocks.getDocs.mockResolvedValueOnce(
      snapshot([
        taskDocument('list-task', {
          listId: 'list-1',
          title: 'List task',
          completed: false,
          important: false,
          myDay: false,
          createdAt,
        }),
        taskDocument('important-task', {
          listId: 'list-2',
          title: 'Important task',
          completed: true,
          important: true,
          myDay: false,
          createdAt,
        }),
        taskDocument('today-task', {
          listId: 'list-2',
          title: 'Today task',
          completed: false,
          important: false,
          myDay: true,
          createdAt,
        }),
        taskDocument('planned-task', {
          listId: 'list-2',
          title: 'Planned task',
          completed: false,
          important: false,
          myDay: false,
          dueDate: '2026-10-01',
          createdAt,
        }),
      ]),
    )

    const store = useTaskStore()
    await store.fetchTasks()

    expect(store.smartViewCounts).toEqual({ myDay: 1, important: 0, planned: 1 })

    store.setListView('list-1')
    expect(store.visibleTasks.map((task) => task.id)).toEqual(['list-task'])

    store.setSmartView('important')
    expect(store.visibleTasks.map((task) => task.id)).toEqual(['important-task'])
    expect(store.completedTasks.map((task) => task.id)).toEqual(['important-task'])

    store.setSmartView('myDay')
    expect(store.visibleTasks.map((task) => task.id)).toEqual(['today-task'])

    store.setSmartView('planned')
    expect(store.visibleTasks.map((task) => task.id)).toEqual(['planned-task'])
  })

  it('counts steps for every task and keeps counts when the active task changes', async () => {
    const createdAt = Timestamp.now()
    firestoreMocks.getDocs
      .mockResolvedValueOnce(
        snapshot([
          taskDocument('task-1', {
            listId: 'list-1',
            title: 'First task',
            completed: false,
            important: false,
            myDay: false,
            createdAt,
          }),
          taskDocument('task-2', {
            listId: 'list-1',
            title: 'Second task',
            completed: false,
            important: false,
            myDay: false,
            createdAt,
          }),
        ]),
      )
      .mockResolvedValueOnce(
        snapshot([
          taskDocument('step-1', { taskId: 'task-1', title: 'One', completed: true, createdAt }),
          taskDocument('step-2', { taskId: 'task-1', title: 'Two', completed: false, createdAt }),
          taskDocument('step-3', { taskId: 'task-1', title: 'Three', completed: true, createdAt }),
        ]),
      )
      .mockResolvedValueOnce(
        snapshot([taskDocument('step-4', { taskId: 'task-2', title: 'Four', completed: false, createdAt })]),
      )

    const store = useTaskStore()
    await store.fetchTasks()

    expect(store.taskStepCounts.get('task-1')).toEqual({ completed: 2, total: 3 })
    expect(store.taskStepCounts.get('task-2')).toEqual({ completed: 0, total: 1 })

    store.activeTaskId = 'task-1'
    await Promise.resolve()

    expect(store.taskStepCounts.get('task-2')).toEqual({ completed: 0, total: 1 })
  })

  it('loads step counts from cache when task and step reads are offline', async () => {
    const createdAt = Timestamp.now()
    firestoreMocks.getDocs
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
    firestoreMocks.getDocsFromCache
      .mockResolvedValueOnce(
        snapshot([
          taskDocument('task-1', {
            listId: 'list-1',
            title: 'Cached task',
            completed: false,
            important: false,
            myDay: false,
            createdAt,
          }),
        ]),
      )
      .mockResolvedValueOnce(
        snapshot([taskDocument('step-1', { taskId: 'task-1', title: 'Cached step', completed: true, createdAt })]),
      )

    const store = useTaskStore()
    await store.fetchTasks()

    expect(store.taskStepCounts.get('task-1')).toEqual({ completed: 1, total: 1 })
  })

  it('adds a task optimistically and replaces its temporary id after persistence', async () => {
    const pending = deferred<{ id: string }>()
    firestoreMocks.addDoc.mockReturnValueOnce(pending.promise)
    const store = useTaskStore()

    const creation = store.createTask({ listId: 'list-1', title: '  Buy paint  ' })

    expect(store.tasks).toHaveLength(1)
    expect(store.tasks[0]).toMatchObject({
      id: expect.stringContaining('optimistic-'),
      listId: 'list-1',
      title: 'Buy paint',
    })

    pending.resolve({ id: 'task-1' })
    await creation

    expect(store.tasks[0].id).toBe('task-1')
    expect(firestoreMocks.addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ title: 'Buy paint', listId: 'list-1' }),
    )
  })

  it('rolls back an optimistic completion when Firestore rejects the update', async () => {
    const createdAt = Timestamp.now()
    firestoreMocks.getDocs.mockResolvedValueOnce(
      snapshot([
        taskDocument('task-1', {
          listId: 'list-1',
          title: 'Finish wall',
          completed: false,
          important: false,
          myDay: false,
          createdAt,
        }),
      ]),
    )
    const pending = deferred<void>()
    firestoreMocks.updateDoc.mockReturnValueOnce(pending.promise)
    const store = useTaskStore()
    await store.fetchTasks()

    store.toggleCompleted('task-1')
    expect(store.tasks[0].completed).toBe(true)

    pending.reject(new Error('offline write failed'))
    await Promise.resolve()
    await Promise.resolve()

    expect(store.tasks[0].completed).toBe(false)
    expect(store.error).toBe('offline write failed')
  })

  it('toggles completion, importance, and My day state optimistically', async () => {
    const createdAt = Timestamp.now()
    firestoreMocks.getDocs.mockResolvedValueOnce(
      snapshot([taskDocument('task-1', {
        listId: 'list-1',
        title: 'Finish wall',
        completed: false,
        important: false,
        myDay: false,
        createdAt,
      })]),
    )
    const store = useTaskStore()
    await store.fetchTasks()

    store.toggleCompleted('task-1')
    store.toggleImportant('task-1')
    store.toggleMyDay('task-1')

    expect(store.tasks[0]).toMatchObject({ completed: true, important: true, myDay: true })
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(expect.anything(), { completed: true })
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(expect.anything(), { important: true })
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(expect.anything(), { myDay: true })
  })

  it('rolls back an optimistic importance update when Firestore rejects', async () => {
    const createdAt = Timestamp.now()
    firestoreMocks.getDocs.mockResolvedValueOnce(
      snapshot([taskDocument('task-1', {
        listId: 'list-1',
        title: 'Important task',
        completed: false,
        important: false,
        myDay: false,
        createdAt,
      })]),
    )
    firestoreMocks.updateDoc.mockRejectedValueOnce(new Error('important update failed'))
    const store = useTaskStore()
    await store.fetchTasks()

    store.toggleImportant('task-1')
    await Promise.resolve()
    await Promise.resolve()

    expect(store.tasks[0].important).toBe(false)
    expect(store.error).toBe('important update failed')
  })

  it('adds and toggles steps optimistically for the active task', async () => {
    const store = useTaskStore()
    store.setActiveTask('task-1')
    await Promise.resolve()

    const pendingCreate = deferred<{ id: string }>()
    firestoreMocks.addDoc.mockReturnValueOnce(pendingCreate.promise)
    const creation = store.createStep({ taskId: 'task-1', title: '  Measure wall  ' })

    expect(store.activeSteps).toHaveLength(1)
    expect(store.activeSteps[0].title).toBe('Measure wall')
    expect(store.taskStepCounts.get('task-1')).toEqual({ completed: 0, total: 1 })

    pendingCreate.resolve({ id: 'step-1' })
    await creation
    expect(store.activeSteps[0].id).toBe('step-1')

    const pendingToggle = deferred<void>()
    firestoreMocks.updateDoc.mockReturnValueOnce(pendingToggle.promise)
    store.toggleStep('step-1')
    expect(store.activeSteps[0].completed).toBe(true)
    expect(store.taskStepCounts.get('task-1')).toEqual({ completed: 1, total: 1 })
    pendingToggle.resolve()
    await pendingToggle.promise
  })

  it('updates details fields and deletes tasks optimistically', async () => {
    const createdAt = Timestamp.now()
    firestoreMocks.getDocs.mockResolvedValueOnce(
      snapshot([
        taskDocument('task-1', {
          listId: 'list-1',
          title: 'Write notes',
          completed: false,
          important: false,
          myDay: false,
          createdAt,
        }),
      ]),
    )
    const store = useTaskStore()
    await store.fetchTasks()

    store.setActiveTask('task-1')
    store.toggleMyDay('task-1')
    store.setDueDate('task-1', '2026-09-30')
    store.saveNote('task-1', 'Use the blue paint.')
    await store.updateTask('task-1', { tags: ['jobb', 'hem'] })

    expect(store.activeTask).toMatchObject({
      myDay: true,
      dueDate: '2026-09-30',
      note: 'Use the blue paint.',
      tags: ['jobb', 'hem'],
    })
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(expect.anything(), { tags: ['jobb', 'hem'] })

    firestoreMocks.getDocs.mockResolvedValueOnce(
      snapshot([taskDocument('task-1', {
        listId: 'list-1',
        title: 'Write notes',
        completed: false,
        important: false,
        myDay: true,
        dueDate: '2026-09-30',
        note: 'Use the blue paint.',
        tags: ['jobb', 'hem'],
        createdAt,
      })]),
    )
    await store.fetchTasks()
    expect(store.tasks[0].tags).toEqual(['jobb', 'hem'])

    await store.deleteTask('task-1')
    expect(store.tasks).toHaveLength(0)
    expect(store.activeTaskId).toBe(null)
    expect(firestoreMocks.deleteDoc).toHaveBeenCalled()
  })

  it('deletes a subtask optimistically without changing the parent task', async () => {
    const store = useTaskStore()
    store.setActiveTask('task-1')
    await Promise.resolve()
    await store.createStep({ taskId: 'task-1', title: 'Remove this step' })

    await store.deleteStep('persisted-id')

    expect(store.activeSteps).toHaveLength(0)
    expect(store.taskStepCounts.has('task-1')).toBe(false)
    expect(firestoreMocks.deleteDoc).toHaveBeenCalledWith(expect.anything())
  })

  it('rolls back a subtask completion when Firestore rejects', async () => {
    const store = useTaskStore()
    store.activeTaskId = 'task-1'
    store.allSteps.push({
      id: 'step-1',
      taskId: 'task-1',
      title: 'Measure wall',
      completed: false,
      createdAt: Timestamp.now(),
    })
    firestoreMocks.updateDoc.mockRejectedValueOnce(new Error('step update failed'))

    store.toggleStep('step-1')
    await Promise.resolve()
    await Promise.resolve()

    expect(store.activeSteps[0].completed).toBe(false)
    expect(store.error).toBe('step update failed')
  })

  it('reorders tasks optimistically and commits batch update to Firestore', async () => {
    const store = useTaskStore()
    const createdAt = Timestamp.now()
    store.activeView = { type: 'list', listId: 'list-1' }
    store.tasks.push(
      { id: 'task-1', listId: 'list-1', title: 'Task 1', completed: false, important: false, myDay: false, order: 0, createdAt },
      { id: 'task-2', listId: 'list-1', title: 'Task 2', completed: false, important: false, myDay: false, order: 1, createdAt },
    )

    const batchUpdate = vi.fn()
    const batchCommit = vi.fn().mockResolvedValue(undefined)
    firestoreMocks.writeBatch.mockReturnValue({
      update: batchUpdate,
      commit: batchCommit,
    })

    await store.reorderTasks('list-1', ['task-2', 'task-1'])

    expect(store.activeTasks[0].id).toBe('task-2')
    expect(store.activeTasks[1].id).toBe('task-1')
    expect(batchUpdate).toHaveBeenCalledWith(expect.anything(), { order: 0 })
    expect(batchUpdate).toHaveBeenCalledWith(expect.anything(), { order: 1 })
    expect(batchCommit).toHaveBeenCalled()
  })

  it('rolls back task order if Firestore batch commit rejects', async () => {
    const store = useTaskStore()
    const createdAt = Timestamp.now()
    store.activeView = { type: 'list', listId: 'list-1' }
    store.tasks.push(
      { id: 'task-1', listId: 'list-1', title: 'Task 1', completed: false, important: false, myDay: false, order: 0, createdAt },
      { id: 'task-2', listId: 'list-1', title: 'Task 2', completed: false, important: false, myDay: false, order: 1, createdAt },
    )

    const batchCommit = vi.fn().mockRejectedValue(new Error('batch commit error'))
    firestoreMocks.writeBatch.mockReturnValue({
      update: vi.fn(),
      commit: batchCommit,
    })

    await store.reorderTasks('list-1', ['task-2', 'task-1'])

    expect(store.activeTasks[0].id).toBe('task-1')
    expect(store.activeTasks[1].id).toBe('task-2')
    expect(store.error).toBe('batch commit error')
  })
})
