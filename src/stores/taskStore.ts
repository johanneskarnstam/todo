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
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { auth, db } from '@/firebase'
import type { SmartView, Step, StepCount, Task, TaskView } from '@/types'

interface NewTaskInput {
  listId: string
  title: string
}

interface NewStepInput {
  taskId: string
  title: string
}

const sortByCreatedAt = (tasks: Task[]): Task[] =>
  [...tasks].sort((first, second) => {
    if (first.listId === second.listId && first.order !== undefined && second.order !== undefined) {
      return first.order - second.order
    }
    return first.createdAt.toMillis() - second.createdAt.toMillis()
  })

export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const allSteps = ref<Step[]>([])
  const activeTaskId = ref<string | null>(null)
  const activeView = ref<TaskView | null>(null)
  const isLoaded = ref(false)
  const error = ref<string | null>(null)

  const visibleTasks = computed(() => {
    const view = activeView.value
    if (!view) return []

    if (view.type === 'list') {
      return tasks.value.filter((task) => task.listId === view.listId)
    }

    if (view.smartView === 'important') {
      return tasks.value.filter((task) => task.important)
    }

    if (view.smartView === 'planned') {
      return tasks.value.filter((task) => Boolean(task.dueDate))
    }

    return tasks.value.filter((task) => task.myDay)
  })

  const activeTasks = computed(() => visibleTasks.value.filter((task) => !task.completed))
  const completedTasks = computed(() => visibleTasks.value.filter((task) => task.completed))
  const activeTask = computed(() => tasks.value.find((task) => task.id === activeTaskId.value) ?? null)
  const activeSteps = computed(() => allSteps.value.filter((step) => step.taskId === activeTaskId.value))
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

  const userId = () => {
    const currentUserId = auth.currentUser?.uid
    if (!currentUserId) {
      throw new Error('A signed-in user is required to access tasks.')
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
        error.value = fetchError instanceof Error ? fetchError.message : 'Unable to load steps.'
        return null
      }
    }
  }

  const replaceFetchedSteps = (taskId: string, fetchedSteps: Step[]) => {
    const optimisticSteps = allSteps.value.filter(
      (step) => step.taskId === taskId && step.id.startsWith('optimistic-'),
    )
    const otherSteps = allSteps.value.filter((step) => step.taskId !== taskId)
    allSteps.value = [...otherSteps, ...fetchedSteps, ...optimisticSteps]
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

    try {
      const snapshot = await getDocs(userCollection())
      tasks.value = sortByCreatedAt(
        snapshot.docs.map((task) => ({ id: task.id, ...task.data() }) as Task),
      )
      await fetchAllSteps(tasks.value)
      isLoaded.value = true
    } catch (fetchError) {
      try {
        const cachedSnapshot = await getDocsFromCache(userCollection())
        tasks.value = sortByCreatedAt(
          cachedSnapshot.docs.map((task) => ({ id: task.id, ...task.data() }) as Task),
        )
        await fetchAllSteps(tasks.value)
        isLoaded.value = true
        return
      } catch {
        error.value = fetchError instanceof Error ? fetchError.message : 'Unable to load tasks.'
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

    tasks.value = sortByCreatedAt([...tasks.value, optimisticTask])
    error.value = null

    try {
      const taskReference = await addDoc(userCollection(), {
        listId: optimisticTask.listId,
        title: optimisticTask.title,
        completed: optimisticTask.completed,
        important: optimisticTask.important,
        myDay: optimisticTask.myDay,
        order: optimisticTask.order,
        createdAt: serverTimestamp(),
      })
      tasks.value = tasks.value.map((task) =>
        task.id === optimisticId ? { ...optimisticTask, id: taskReference.id } : task,
      )
      return tasks.value.find((task) => task.id === taskReference.id)
    } catch (createError) {
      tasks.value = tasks.value.filter((task) => task.id !== optimisticId)
      error.value = createError instanceof Error ? createError.message : 'Unable to create task.'
    }
  }

  const updateTask = async (
    taskId: string,
    updates: Partial<Pick<Task, 'completed' | 'important' | 'myDay' | 'title' | 'dueDate' | 'note'>>,
  ) => {
    const currentTask = tasks.value.find((task) => task.id === taskId)
    if (!currentTask) return

    const previousTask = { ...currentTask }
    Object.assign(currentTask, updates)
    error.value = null

    try {
      await updateDoc(doc(userCollection(), taskId), updates)
    } catch (updateError) {
      tasks.value = tasks.value.map((task) => (task.id === taskId ? previousTask : task))
      error.value = updateError instanceof Error ? updateError.message : 'Unable to update task.'
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
    delete task.dueDate
    error.value = null

    void updateDoc(doc(userCollection(), taskId), { dueDate: deleteField() }).catch((clearError: unknown) => {
      if (previousDueDate) task.dueDate = previousDueDate
      error.value = clearError instanceof Error ? clearError.message : 'Unable to clear due date.'
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
    }

    allSteps.value = [...allSteps.value, optimisticStep]
    error.value = null

    try {
      const stepReference = await addDoc(taskStepsCollection(input.taskId), {
        taskId: optimisticStep.taskId,
        title: optimisticStep.title,
        completed: optimisticStep.completed,
        createdAt: serverTimestamp(),
      })
      allSteps.value = allSteps.value.map((step) =>
        step.id === optimisticId ? { ...optimisticStep, id: stepReference.id } : step,
      )
      return allSteps.value.find((step) => step.id === stepReference.id)
    } catch (createError) {
      allSteps.value = allSteps.value.filter((step) => step.id !== optimisticId)
      error.value = createError instanceof Error ? createError.message : 'Unable to create step.'
    }
  }

  const toggleStep = (stepId: string) => {
    const step = allSteps.value.find((item) => item.id === stepId)
    if (!step || !activeTaskId.value) return

    const previousCompleted = step.completed
    step.completed = !step.completed
    error.value = null

    void updateDoc(doc(taskStepsCollection(activeTaskId.value), stepId), {
      completed: step.completed,
    }).catch((toggleError: unknown) => {
      step.completed = previousCompleted
      error.value = toggleError instanceof Error ? toggleError.message : 'Unable to update step.'
    })
  }

  const updateStep = async (stepId: string, title: string) => {
    const step = allSteps.value.find((item) => item.id === stepId)
    if (!step || !activeTaskId.value) return

    const nextTitle = title.trim()
    if (!nextTitle || nextTitle === step.title) return

    const previousTitle = step.title
    step.title = nextTitle
    error.value = null

    try {
      await updateDoc(doc(taskStepsCollection(activeTaskId.value), stepId), { title: nextTitle })
    } catch (updateError) {
      step.title = previousTitle
      error.value = updateError instanceof Error ? updateError.message : 'Unable to update step.'
    }
  }

  const deleteStep = async (stepId: string) => {
    const stepIndex = allSteps.value.findIndex((item) => item.id === stepId)
    if (stepIndex < 0 || !activeTaskId.value) return

    const [deletedStep] = allSteps.value.splice(stepIndex, 1)
    error.value = null

    try {
      await deleteDoc(doc(taskStepsCollection(activeTaskId.value), stepId))
    } catch (deleteError) {
      allSteps.value.splice(stepIndex, 0, deletedStep)
      error.value = deleteError instanceof Error ? deleteError.message : 'Unable to delete step.'
    }
  }

  const deleteTask = async (taskId: string) => {
    const taskIndex = tasks.value.findIndex((task) => task.id === taskId)
    if (taskIndex < 0) return

    const [deletedTask] = tasks.value.splice(taskIndex, 1)
    error.value = null

    try {
      await deleteDoc(doc(userCollection(), taskId))
      allSteps.value = allSteps.value.filter((step) => step.taskId !== taskId)
      if (activeTaskId.value === taskId) setActiveTask(null)
    } catch (deleteError) {
      tasks.value = sortByCreatedAt([...tasks.value, deletedTask])
      error.value = deleteError instanceof Error ? deleteError.message : 'Unable to delete task.'
    }
  }

  const deleteTasksForLists = async (listIds: string[]) => {
    for (const task of tasks.value.filter((item) => listIds.includes(item.listId))) {
      await deleteTask(task.id)
    }
  }

  const reorderTask = async (taskId: string, direction: 'up' | 'down') => {
    const currentTask = tasks.value.find((task) => task.id === taskId)
    if (!currentTask) return

    const siblings = tasks.value
      .filter((task) => task.listId === currentTask.listId)
      .sort((first, second) => (first.order ?? Number.MAX_SAFE_INTEGER) - (second.order ?? Number.MAX_SAFE_INTEGER))
    const index = siblings.findIndex((task) => task.id === taskId)
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || swapIndex < 0 || swapIndex >= siblings.length) return

    const otherTask = siblings[swapIndex]
    const currentOrder = currentTask.order ?? index
    const otherOrder = otherTask.order ?? swapIndex
    currentTask.order = otherOrder
    otherTask.order = currentOrder
    const currentIndex = tasks.value.findIndex((task) => task.id === currentTask.id)
    const otherIndex = tasks.value.findIndex((task) => task.id === otherTask.id)
    const reorderedTasks = [...tasks.value]
    reorderedTasks[currentIndex] = otherTask
    reorderedTasks[otherIndex] = currentTask
    tasks.value = reorderedTasks

    try {
      await Promise.all([
        updateDoc(doc(userCollection(), currentTask.id), { order: currentTask.order }),
        updateDoc(doc(userCollection(), otherTask.id), { order: otherTask.order }),
      ])
    } catch (reorderError) {
      currentTask.order = currentOrder
      otherTask.order = otherOrder
      const restoredTasks = [...tasks.value]
      restoredTasks[currentIndex] = currentTask
      restoredTasks[otherIndex] = otherTask
      tasks.value = restoredTasks
      error.value = reorderError instanceof Error ? reorderError.message : 'Unable to reorder task.'
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
    activeView,
    visibleTasks,
    activeTasks,
    completedTasks,
    isLoaded,
    error,
    fetchTasks,
    setListView,
    setSmartView,
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
    reorderTask,
  }
})
