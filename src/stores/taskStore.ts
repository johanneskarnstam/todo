import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { auth, db } from '@/firebase'
import type { SmartView, Task, TaskView } from '@/types'

interface NewTaskInput {
  listId: string
  title: string
}

const sortByCreatedAt = (tasks: Task[]): Task[] =>
  [...tasks].sort((first, second) => first.createdAt.toMillis() - second.createdAt.toMillis())

export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
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

  const userCollection = () => {
    const userId = auth.currentUser?.uid
    if (!userId) {
      throw new Error('A signed-in user is required to access tasks.')
    }

    return collection(db, 'users', userId, 'tasks')
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

  const updateTask = async (taskId: string, updates: Partial<Pick<Task, 'completed' | 'important' | 'myDay' | 'title'>>) => {
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

  const deleteTask = async (taskId: string) => {
    const taskIndex = tasks.value.findIndex((task) => task.id === taskId)
    if (taskIndex < 0) return

    const [deletedTask] = tasks.value.splice(taskIndex, 1)
    error.value = null

    try {
      await deleteDoc(doc(userCollection(), taskId))
    } catch (deleteError) {
      tasks.value = sortByCreatedAt([...tasks.value, deletedTask])
      error.value = deleteError instanceof Error ? deleteError.message : 'Unable to delete task.'
    }
  }

  return {
    tasks,
    activeView,
    visibleTasks,
    activeTasks,
    completedTasks,
    isLoaded,
    error,
    fetchTasks,
    setListView,
    setSmartView,
    createTask,
    toggleCompleted,
    toggleImportant,
    deleteTask,
  }
})
