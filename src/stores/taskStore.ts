import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  addDoc,
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { auth, db } from '@/firebase'
import type { SmartView, Step, Task, TaskView } from '@/types'

interface NewTaskInput {
  listId: string
  title: string
}

interface NewStepInput {
  taskId: string
  title: string
}

const sortByCreatedAt = (tasks: Task[]): Task[] =>
  [...tasks].sort((first, second) => first.createdAt.toMillis() - second.createdAt.toMillis())

export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const steps = ref<Step[]>([])
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

    return tasks.value.filter((task) => task.myDay)
  })

  const activeTasks = computed(() => visibleTasks.value.filter((task) => !task.completed))
  const completedTasks = computed(() => visibleTasks.value.filter((task) => task.completed))
  const activeTask = computed(() => tasks.value.find((task) => task.id === activeTaskId.value) ?? null)
  const activeSteps = computed(() => steps.value.filter((step) => step.taskId === activeTaskId.value))

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

  const fetchSteps = async (taskId: string) => {
    try {
      const snapshot = await getDocs(taskStepsCollection(taskId))
      if (activeTaskId.value !== taskId) return
      steps.value = snapshot.docs.map((step) => ({ id: step.id, ...step.data() }) as Step)
    } catch (fetchError) {
      error.value = fetchError instanceof Error ? fetchError.message : 'Unable to load steps.'
    }
  }

  const setActiveTask = (taskId: string | null) => {
    activeTaskId.value = taskId
    steps.value = []
    if (taskId) void fetchSteps(taskId)
  }

  const fetchTasks = async () => {
    error.value = null

    try {
      const snapshot = await getDocs(userCollection())
      tasks.value = sortByCreatedAt(
        snapshot.docs.map((task) => ({ id: task.id, ...task.data() }) as Task),
      )
      isLoaded.value = true
    } catch (fetchError) {
      error.value = fetchError instanceof Error ? fetchError.message : 'Unable to load tasks.'
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

    steps.value = [...steps.value, optimisticStep]
    error.value = null

    try {
      const stepReference = await addDoc(taskStepsCollection(input.taskId), {
        taskId: optimisticStep.taskId,
        title: optimisticStep.title,
        completed: optimisticStep.completed,
        createdAt: serverTimestamp(),
      })
      steps.value = steps.value.map((step) =>
        step.id === optimisticId ? { ...optimisticStep, id: stepReference.id } : step,
      )
      return steps.value.find((step) => step.id === stepReference.id)
    } catch (createError) {
      steps.value = steps.value.filter((step) => step.id !== optimisticId)
      error.value = createError instanceof Error ? createError.message : 'Unable to create step.'
    }
  }

  const toggleStep = (stepId: string) => {
    const step = steps.value.find((item) => item.id === stepId)
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
    const step = steps.value.find((item) => item.id === stepId)
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
    const stepIndex = steps.value.findIndex((item) => item.id === stepId)
    if (stepIndex < 0 || !activeTaskId.value) return

    const [deletedStep] = steps.value.splice(stepIndex, 1)
    error.value = null

    try {
      await deleteDoc(doc(taskStepsCollection(activeTaskId.value), stepId))
    } catch (deleteError) {
      steps.value.splice(stepIndex, 0, deletedStep)
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
      if (activeTaskId.value === taskId) setActiveTask(null)
    } catch (deleteError) {
      tasks.value = sortByCreatedAt([...tasks.value, deletedTask])
      error.value = deleteError instanceof Error ? deleteError.message : 'Unable to delete task.'
    }
  }

  return {
    tasks,
    steps,
    activeTaskId,
    activeTask,
    activeSteps,
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
  }
})
