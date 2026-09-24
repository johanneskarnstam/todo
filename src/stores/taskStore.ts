import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  addDoc,
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDocs,
  getDocsFromCache,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { auth, db } from '@/firebase'
import { isMockAuthEnabled, MOCK_USER_ID } from '@/devMode'
import { useToastStore } from '@/stores/toastStore'
import type { SmartView, Step, StepCount, Task, TaskReminder, TaskView } from '@/types'

interface NewTaskInput {
  listId: string
  title: string
}

interface NewStepInput {
  taskId: string
  title: string
}

const sortTasks = (tasks: Task[]): Task[] =>
  [...tasks].sort((first, second) => {
    if (first.listId === second.listId) {
      const firstOrder = first.order ?? Number.MAX_SAFE_INTEGER
      const secondOrder = second.order ?? Number.MAX_SAFE_INTEGER
      if (firstOrder !== secondOrder) return firstOrder - secondOrder
    }
    return first.createdAt.toMillis() - second.createdAt.toMillis()
  })

const sortSteps = (steps: Step[]): Step[] =>
  [...steps].sort((first, second) => {
    const firstOrder = first.order ?? Number.MAX_SAFE_INTEGER
    const secondOrder = second.order ?? Number.MAX_SAFE_INTEGER
    if (firstOrder !== secondOrder) return firstOrder - secondOrder
    return first.createdAt.toMillis() - second.createdAt.toMillis()
  })

const mockTasksStorageKey = 'todo-mock-tasks'

const readMockTasks = (): Task[] | null => {
  if (typeof localStorage === 'undefined') return null

  try {
    const storedTasks = localStorage.getItem(mockTasksStorageKey)
    if (!storedTasks) return null

    return JSON.parse(storedTasks).map((task: Task & { createdAt: number }) => ({
      ...task,
      createdAt: Timestamp.fromMillis(task.createdAt),
    })) as Task[]
  } catch {
    return null
  }
}

const persistMockTasks = (tasksToPersist: Task[]) => {
  if (typeof localStorage === 'undefined') return

  localStorage.setItem(mockTasksStorageKey, JSON.stringify(tasksToPersist.map((task) => ({
    ...task,
    createdAt: task.createdAt.toMillis(),
  }))))
}

export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const allSteps = ref<Step[]>([])
  const activeTaskId = ref<string | null>(null)
  const activeView = ref<TaskView | null>(null)
  const isLoaded = ref(false)
  const error = ref<string | null>(null)
  const pendingWriteCount = ref(0)
  const isSaving = computed(() => pendingWriteCount.value > 0)
  const toastStore = useToastStore()

  const reportWriteError = (writeError: unknown, fallback: string) => {
    const message = writeError instanceof Error ? writeError.message : fallback
    error.value = message
    toastStore.show(message)
  }

  const trackWrite = async <T>(write: () => Promise<T>): Promise<T> => {
    if (isMockAuthEnabled) return undefined as T
    pendingWriteCount.value += 1
    try {
      return await write()
    } finally {
      pendingWriteCount.value -= 1
    }
  }

  const visibleTasks = computed(() => {
    const view = activeView.value
    if (!view) return []

    if (view.type === 'list') {
      return tasks.value.filter((task) => task.listId === view.listId)
    }

    if (view.type === 'tag') {
      return tasks.value.filter((task) => task.tags?.includes(view.tag))
    }

    if (view.smartView === 'important') {
      return tasks.value.filter((task) => task.important)
    }

    if (view.smartView === 'planned') {
      return tasks.value.filter((task) => Boolean(task.dueDate))
    }

    return tasks.value.filter((task) => task.myDay)
  })

  const activeTasks = computed(() => sortTasks(visibleTasks.value.filter((task) => !task.completed)))
  const completedTasks = computed(() => sortTasks(visibleTasks.value.filter((task) => task.completed)))
  const activeTask = computed(() => tasks.value.find((task) => task.id === activeTaskId.value) ?? null)
  const activeSteps = computed(() => sortSteps(allSteps.value.filter((step) => step.taskId === activeTaskId.value)))
  const taskStepCounts = computed(() => {
    const counts = new Map<string, StepCount>()

    for (const step of allSteps.value) {
      const count = counts.get(step.taskId) ?? { completed: 0, total: 0 }
      count.total += 1
      if (step.completed) count.completed += 1
      counts.set(step.taskId, count)
    }

    return counts
  })
  const smartViewCounts = computed<Record<SmartView, number>>(() => ({
    myDay: tasks.value.filter((task) => task.myDay && !task.completed).length,
    important: tasks.value.filter((task) => task.important && !task.completed).length,
    planned: tasks.value.filter((task) => Boolean(task.dueDate) && !task.completed).length,
  }))
  const listTaskCounts = computed<Record<string, number>>(() => tasks.value.reduce<Record<string, number>>((counts, task) => {
    if (!task.completed) counts[task.listId] = (counts[task.listId] ?? 0) + 1
    return counts
  }, {}))

  const clearState = () => {
    tasks.value = []
    allSteps.value = []
    activeTaskId.value = null
    activeView.value = null
    isLoaded.value = false
    error.value = null
  }

  const userId = () => {
    const currentUserId = isMockAuthEnabled ? MOCK_USER_ID : auth.currentUser?.uid
    if (!currentUserId) {
      throw new Error('En inloggad användare krävs för att komma åt uppgifter.')
    }

    return currentUserId
  }

  const userCollection = () => {
    return collection(db, 'users', userId(), 'tasks')
  }

  const taskStepsCollection = (taskId: string) =>
    collection(db, 'users', userId(), 'tasks', taskId, 'steps')

  const fetchStepsForTask = async (taskId: string): Promise<Step[] | null> => {
    try {
      const snapshot = await getDocs(taskStepsCollection(taskId))
      return snapshot.docs.map((step) => ({ id: step.id, ...step.data() }) as Step)
    } catch (fetchError) {
      try {
        const cachedSnapshot = await getDocsFromCache(taskStepsCollection(taskId))
        return cachedSnapshot.docs.map((step) => ({ id: step.id, ...step.data() }) as Step)
      } catch {
        error.value = fetchError instanceof Error ? fetchError.message : 'Delstegen kunde inte läsas in.'
        return null
      }
    }
  }

  const replaceFetchedSteps = (taskId: string, fetchedSteps: Step[]) => {
    const optimisticSteps = allSteps.value.filter(
      (step) => step.taskId === taskId && step.id.startsWith('optimistic-'),
    )
    const otherSteps = allSteps.value.filter((step) => step.taskId !== taskId)
    allSteps.value = [...otherSteps, ...sortSteps(fetchedSteps), ...optimisticSteps]
  }

  const fetchSteps = async (taskId: string) => {
    const fetchedSteps = await fetchStepsForTask(taskId)
    if (fetchedSteps) replaceFetchedSteps(taskId, fetchedSteps)
  }

  const fetchAllSteps = async (tasksToLoad: Task[]) => {
    const taskIds = new Set(tasksToLoad.map((task) => task.id))
    allSteps.value = allSteps.value.filter((step) => taskIds.has(step.taskId))

    const fetchedSteps = await Promise.all(
      tasksToLoad.map(async (task) => ({ taskId: task.id, steps: await fetchStepsForTask(task.id) })),
    )

    for (const result of fetchedSteps) {
      if (result.steps) replaceFetchedSteps(result.taskId, result.steps)
    }
  }

  const setActiveTask = (taskId: string | null) => {
    activeTaskId.value = taskId
    if (taskId) void fetchSteps(taskId)
  }

  const fetchTasks = async () => {
    error.value = null

    if (isMockAuthEnabled) {
      const createdAt = Timestamp.now()
      const initialTasks = [
        { id: 'local-task-1', listId: '__default__', title: 'Testa dra och släppa uppgifter', completed: false, important: true, myDay: true, order: 0, createdAt },
        { id: 'local-task-2', listId: '__default__', title: 'Kontrollera mobilvyn', completed: false, important: false, myDay: false, order: 1, createdAt },
        { id: 'local-task-3', listId: 'local-projects', title: 'Förbered nästa release', completed: false, important: false, myDay: false, order: 0, createdAt },
      ] satisfies Task[]
      tasks.value = sortTasks(readMockTasks() ?? initialTasks)
      if (!readMockTasks()) persistMockTasks(tasks.value)
      isLoaded.value = true
      return
    }

    try {
      const snapshot = await getDocs(userCollection())
      tasks.value = sortTasks(
        snapshot.docs.map((task) => ({ id: task.id, ...task.data() }) as Task),
      )
      isLoaded.value = true
      await fetchAllSteps(tasks.value)
    } catch (fetchError) {
      try {
        const cachedSnapshot = await getDocsFromCache(userCollection())
        tasks.value = sortTasks(
          cachedSnapshot.docs.map((task) => ({ id: task.id, ...task.data() }) as Task),
        )
        isLoaded.value = true
        await fetchAllSteps(tasks.value)
        return
      } catch {
        error.value = fetchError instanceof Error ? fetchError.message : 'Uppgifterna kunde inte läsas in.'
      }
    }
  }

  const setView = (view: TaskView) => {
    activeView.value = view
    if (!isLoaded.value) {
      void fetchTasks()
    }
  }

  const setListView = (listId: string) => {
    setView({ type: 'list', listId })
  }

  const setSmartView = (smartView: SmartView) => {
    setView({ type: 'smart', smartView })
  }

  const setTagView = (tag: string) => {
    setView({ type: 'tag', tag })
  }

  const createTask = async (input: NewTaskInput) => {
    const title = input.title.trim()
    if (!title) return

    const optimisticId = `optimistic-${crypto.randomUUID()}`
    const optimisticTask: Task = {
      id: optimisticId,
      listId: input.listId,
      title,
      completed: false,
      important: false,
      myDay: false,
      createdAt: Timestamp.now(),
      order: tasks.value.filter((task) => task.listId === input.listId).length,
    }

    tasks.value = sortTasks([...tasks.value, optimisticTask])
    error.value = null

    if (isMockAuthEnabled) {
      persistMockTasks(tasks.value)
      return optimisticTask
    }

    try {
      const taskReference = await trackWrite(() => addDoc(userCollection(), {
        listId: optimisticTask.listId,
        title: optimisticTask.title,
        completed: optimisticTask.completed,
        important: optimisticTask.important,
        myDay: optimisticTask.myDay,
        order: optimisticTask.order,
        createdAt: serverTimestamp(),
      }))
      tasks.value = tasks.value.map((task) =>
        task.id === optimisticId ? { ...optimisticTask, id: taskReference.id } : task,
      )
      return tasks.value.find((task) => task.id === taskReference.id)
    } catch (createError) {
      tasks.value = tasks.value.filter((task) => task.id !== optimisticId)
      reportWriteError(createError, 'Uppgiften kunde inte skapas.')
    }
  }

  const updateTask = async (
    taskId: string,
    updates: Partial<Pick<Task, 'completed' | 'important' | 'myDay' | 'title' | 'dueDate' | 'note' | 'tags'>> & { reminder?: TaskReminder | null },
  ) => {
    const currentTask = tasks.value.find((task) => task.id === taskId)
    if (!currentTask) return

    const previousTask = { ...currentTask }
    Object.assign(currentTask, updates)
    error.value = null
    if (isMockAuthEnabled) persistMockTasks(tasks.value)

    try {
      await trackWrite(() => updateDoc(doc(userCollection(), taskId), updates))
    } catch (updateError) {
      tasks.value = tasks.value.map((task) => (task.id === taskId ? previousTask : task))
      reportWriteError(updateError, 'Uppgiften kunde inte uppdateras.')
    }
  }

  const toggleCompleted = (taskId: string) => {
    const task = tasks.value.find((item) => item.id === taskId)
    if (task) void updateTask(taskId, { completed: !task.completed })
  }

  const toggleImportant = (taskId: string) => {
    const task = tasks.value.find((item) => item.id === taskId)
    if (task) void updateTask(taskId, { important: !task.important })
  }

  const toggleMyDay = (taskId: string) => {
    const task = tasks.value.find((item) => item.id === taskId)
    if (task) void updateTask(taskId, { myDay: !task.myDay })
  }

  const setDueDate = (taskId: string, dueDate: string) => {
    if (dueDate) {
      void updateTask(taskId, { dueDate })
      return
    }

    const task = tasks.value.find((item) => item.id === taskId)
    if (!task) return

    const previousDueDate = task.dueDate
    const previousReminder = task.reminder
    delete task.dueDate
    task.reminder = null
    error.value = null

    void trackWrite(() => updateDoc(doc(userCollection(), taskId), { dueDate: deleteField(), reminder: null })).catch((clearError: unknown) => {
      if (previousDueDate) task.dueDate = previousDueDate
      task.reminder = previousReminder
      reportWriteError(clearError, 'Förfallodatumet kunde inte tas bort.')
    })
  }

  const saveNote = (taskId: string, note: string) => {
    void updateTask(taskId, { note })
  }

  const createStep = async (input: NewStepInput) => {
    const title = input.title.trim()
    if (!title) return

    const optimisticId = `optimistic-${crypto.randomUUID()}`
    const optimisticStep: Step = {
      id: optimisticId,
      taskId: input.taskId,
      title,
      completed: false,
      createdAt: Timestamp.now(),
      order: allSteps.value.filter((step) => step.taskId === input.taskId).length,
    }

    allSteps.value = [...allSteps.value, optimisticStep]
    error.value = null

    if (isMockAuthEnabled) return optimisticStep

    try {
      const stepReference = await trackWrite(() => addDoc(taskStepsCollection(input.taskId), {
        taskId: optimisticStep.taskId,
        title: optimisticStep.title,
        completed: optimisticStep.completed,
        createdAt: serverTimestamp(),
        order: optimisticStep.order,
      }))
      allSteps.value = allSteps.value.map((step) =>
        step.id === optimisticId ? { ...optimisticStep, id: stepReference.id } : step,
      )
      return allSteps.value.find((step) => step.id === stepReference.id)
    } catch (createError) {
      allSteps.value = allSteps.value.filter((step) => step.id !== optimisticId)
      reportWriteError(createError, 'Delsteget kunde inte skapas.')
    }
  }

  const toggleStep = (stepId: string) => {
    const step = allSteps.value.find((item) => item.id === stepId)
    const taskId = activeTaskId.value
    if (!step || !taskId) return

    const previousCompleted = step.completed
    step.completed = !step.completed
    error.value = null

    void trackWrite(() => updateDoc(doc(taskStepsCollection(taskId), stepId), {
      completed: step.completed,
    })).catch((toggleError: unknown) => {
      step.completed = previousCompleted
      reportWriteError(toggleError, 'Delsteget kunde inte uppdateras.')
    })
  }

  const updateStep = async (stepId: string, title: string) => {
    const step = allSteps.value.find((item) => item.id === stepId)
    const taskId = activeTaskId.value
    if (!step || !taskId) return

    const nextTitle = title.trim()
    if (!nextTitle || nextTitle === step.title) return

    const previousTitle = step.title
    step.title = nextTitle
    error.value = null

    try {
      await trackWrite(() => updateDoc(doc(taskStepsCollection(taskId), stepId), { title: nextTitle }))
    } catch (updateError) {
      step.title = previousTitle
      reportWriteError(updateError, 'Delsteget kunde inte uppdateras.')
    }
  }

  const deleteStep = async (stepId: string) => {
    const stepIndex = allSteps.value.findIndex((item) => item.id === stepId)
    const taskId = activeTaskId.value
    if (stepIndex < 0 || !taskId) return

    const [deletedStep] = allSteps.value.splice(stepIndex, 1)
    error.value = null

    try {
      await trackWrite(() => deleteDoc(doc(taskStepsCollection(taskId), stepId)))
      toastStore.showAction('Delsteg borttaget', 'Ångra', () => {
        allSteps.value.splice(Math.min(stepIndex, allSteps.value.length), 0, deletedStep)
        if (!isMockAuthEnabled) {
          void trackWrite(() => setDoc(doc(taskStepsCollection(taskId), deletedStep.id), {
            taskId: deletedStep.taskId,
            title: deletedStep.title,
            completed: deletedStep.completed,
            ...(deletedStep.order !== undefined ? { order: deletedStep.order } : {}),
            createdAt: deletedStep.createdAt,
          }))
        }
      })
    } catch (deleteError) {
      allSteps.value.splice(stepIndex, 0, deletedStep)
      reportWriteError(deleteError, 'Delsteget kunde inte tas bort.')
    }
  }

  const restoreTask = async (task: Task, index: number) => {
    if (tasks.value.some((item) => item.id === task.id)) return
    tasks.value.splice(Math.min(index, tasks.value.length), 0, task)
    tasks.value = sortTasks(tasks.value)

    try {
      if (!isMockAuthEnabled) {
        await trackWrite(() => setDoc(doc(userCollection(), task.id), {
          listId: task.listId,
          title: task.title,
          completed: task.completed,
          important: task.important,
          myDay: task.myDay,
          ...(task.dueDate ? { dueDate: task.dueDate } : {}),
          ...(task.note ? { note: task.note } : {}),
          ...(task.tags?.length ? { tags: task.tags } : {}),
          order: task.order,
          createdAt: task.createdAt,
        }))
      }
    } catch (restoreError) {
      tasks.value = tasks.value.filter((item) => item.id !== task.id)
      reportWriteError(restoreError, 'Uppgiften kunde inte återställas.')
    }
  }

  const deleteTask = async (taskId: string) => {
    const taskIndex = tasks.value.findIndex((task) => task.id === taskId)
    if (taskIndex < 0) return

    const [deletedTask] = tasks.value.splice(taskIndex, 1)
    error.value = null

    try {
      await trackWrite(() => deleteDoc(doc(userCollection(), taskId)))
      allSteps.value = allSteps.value.filter((step) => step.taskId !== taskId)
      if (activeTaskId.value === taskId) setActiveTask(null)
      toastStore.showAction('Uppgift borttagen', 'Ångra', () => void restoreTask(deletedTask, taskIndex))
    } catch (deleteError) {
      tasks.value = sortTasks([...tasks.value, deletedTask])
      reportWriteError(deleteError, 'Uppgiften kunde inte tas bort.')
    }
  }

  const deleteTasksForLists = async (listIds: string[]) => {
    for (const task of tasks.value.filter((item) => listIds.includes(item.listId))) {
      await deleteTask(task.id)
    }
  }

  return {
    tasks,
    steps: allSteps,
    allSteps,
    activeTaskId,
    activeTask,
    activeSteps,
    taskStepCounts,
    smartViewCounts,
    listTaskCounts,
    activeView,
    visibleTasks,
    activeTasks,
    completedTasks,
    isLoaded,
    isSaving,
    error,
    clearState,
    fetchTasks,
    setListView,
    setSmartView,
    setTagView,
    setActiveTask,
    createTask,
    createStep,
    updateTask,
    toggleCompleted,
    toggleImportant,
    toggleMyDay,
    setDueDate,
    saveNote,
    toggleStep,
    updateStep,
    deleteStep,
    deleteTask,
    deleteTasksForLists,
  }
})
