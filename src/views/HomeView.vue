<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TodoHeader from '@/components/TodoHeader.vue'
import TodoSidebar from '@/components/TodoSidebar.vue'
import TaskRow from '@/components/TaskRow.vue'
import TaskDetailsPanel from '@/components/TaskDetailsPanel.vue'
import { useListStore } from '@/stores/listStore'
import { useTaskStore } from '@/stores/taskStore'
import type { SmartView } from '@/types'
import { useI18n } from '@/i18n'

const isSidebarOpen = ref(typeof window === 'undefined' ? true : window.innerWidth >= 1024)
const isDark = ref(false)
const taskTitle = ref('')
const pendingDeleteTaskId = ref<string | null>(null)
const pendingDeleteListId = ref<string | null>(null)
const deleteListTasks = ref(false)
const isListOptionsOpen = ref(false)
const listRenameTitle = ref('')
const listStore = useListStore()
const taskStore = useTaskStore()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

interface PlannedGroup {
  key: 'overdue' | 'today' | 'tomorrow' | 'later'
  tasks: typeof taskStore.visibleTasks
}

const routeSmartView = computed(() => route.meta.smartView as SmartView | undefined)
const isPlannedView = computed(() => routeSmartView.value === 'planned')

const currentTitle = computed(() => {
  const view = taskStore.activeView
  if (view?.type === 'smart') {
    if (view.smartView === 'important') return t('important')
    if (view.smartView === 'planned') return t('planned')
    return t('myDay')
  }

  return listStore.selectedList?.name ?? t('myDay')
})

const canAddTask = computed(() => taskStore.activeView?.type === 'list')
const activeList = computed(() => taskStore.activeView?.type === 'list' ? listStore.selectedList : null)
const activeListColor = computed(() => activeList.value?.themeColor ?? '#2564cf')
const themeColors = ['#2564cf', '#107c10', '#d83b01', '#8764b8', '#038387', '#ca5010']

const taskListName = (listId: string) => listStore.lists.find((list) => list.id === listId)?.name ?? null

const dueDateKey = (task: (typeof taskStore.tasks)[number]) => {
  if (!task.dueDate) return ''
  if (typeof task.dueDate === 'string') return task.dueDate
  const date = task.dueDate.toDate()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const plannedGroups = computed<PlannedGroup[]>(() => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const formatDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const todayKey = formatDate(today)
  const tomorrowKey = formatDate(tomorrow)
  const groups: Record<PlannedGroup['key'], PlannedGroup['tasks']> = {
    overdue: [],
    today: [],
    tomorrow: [],
    later: [],
  }

  for (const task of taskStore.visibleTasks) {
    const key = dueDateKey(task)
    const group = key < todayKey ? 'overdue' : key === todayKey ? 'today' : key === tomorrowKey ? 'tomorrow' : 'later'
    groups[group].push(task)
  }

  return (Object.keys(groups) as PlannedGroup['key'][])
    .map((key) => ({ key, tasks: groups[key].sort((first, second) => dueDateKey(first).localeCompare(dueDateKey(second))) }))
    .filter((group) => group.tasks.length > 0)
})

const handleSelectList = (listId: string) => {
  listStore.selectList(listId)
  taskStore.setListView(listId)
  void router.push('/')
  isSidebarOpen.value = false
}

const startRenameList = () => {
  listRenameTitle.value = activeList.value?.name ?? ''
  isListOptionsOpen.value = false
}

const saveListRename = () => {
  const listId = activeList.value?.id
  const name = listRenameTitle.value.trim()
  if (!listId || !name) return

  void listStore.updateList(listId, { name })
  listRenameTitle.value = ''
}

const selectListTheme = (color: string) => {
  const listId = activeList.value?.id
  if (!listId) return
  listStore.updateListTheme(listId, color)
}

const requestDeleteList = () => {
  if (!activeList.value) return
  pendingDeleteListId.value = activeList.value.id
  deleteListTasks.value = false
  isListOptionsOpen.value = false
}

const confirmDeleteList = async () => {
  const listId = pendingDeleteListId.value
  if (!listId) return

  pendingDeleteListId.value = null
  const deleted = await listStore.deleteList(listId)
  if (deleted && deleteListTasks.value) await taskStore.deleteTasksForLists([listId])
  if (listStore.selectedListId) taskStore.setListView(listStore.selectedListId)
}

const handleCreateList = (name: string) => {
  void listStore.createList({ name }).then((createdList) => {
    if (createdList) taskStore.setListView(createdList.id)
  })
}

const handleCreateFolder = (name: string) => {
  void listStore.createFolder({ name })
}

const handleMoveList = (listId: string, folderId: string | null) => {
  void listStore.moveList(listId, folderId)
}

const handleRenameFolder = (folderId: string, name: string) => {
  void listStore.updateFolder(folderId, { name })
}

const handleDeleteFolder = async (folderId: string, deleteLists: boolean) => {
  const deletedListIds = await listStore.deleteFolder(folderId, deleteLists)
  if (deletedListIds?.length) await taskStore.deleteTasksForLists(deletedListIds)
  if (listStore.selectedListId) taskStore.setListView(listStore.selectedListId)
}

const handleSelectSmartView = (view: SmartView) => {
  taskStore.setSmartView(view)
  void router.push({ name: view === 'myDay' ? 'my-day' : view })
  isSidebarOpen.value = false
}

const handleAddTask = () => {
  const listId = taskStore.activeView?.type === 'list' ? taskStore.activeView.listId : null
  if (!listId || !taskTitle.value.trim()) return

  void taskStore.createTask({ listId, title: taskTitle.value })
  taskTitle.value = ''
}

const handleDeleteActiveTask = () => {
  const taskId = taskStore.activeTaskId
  if (!taskId) return

  pendingDeleteTaskId.value = taskId
}

const requestDeleteTask = (taskId: string) => {
  pendingDeleteTaskId.value = taskId
}

const cancelDeleteTask = () => {
  pendingDeleteTaskId.value = null
}

const confirmDeleteTask = () => {
  const taskId = pendingDeleteTaskId.value
  if (!taskId) return

  pendingDeleteTaskId.value = null
  if (taskStore.activeTaskId === taskId) taskStore.setActiveTask(null)
  void taskStore.deleteTask(taskId)
}

const handleSaveStepTitle = (stepId: string, title: string) => {
  void taskStore.updateStep(stepId, title)
}

onMounted(async () => {
  await listStore.fetchLists()
  if (routeSmartView.value) {
    taskStore.setSmartView(routeSmartView.value)
  } else if (listStore.selectedListId) {
    taskStore.setListView(listStore.selectedListId)
  }
})

watch(routeSmartView, (view) => {
  if (view) taskStore.setSmartView(view)
})

const toggleTheme = () => {
  isDark.value = !isDark.value
}
</script>

<template>
  <div class="flex h-screen flex-col bg-[#faf9f8] text-slate-800 dark:bg-slate-950 dark:text-slate-100" :class="{ dark: isDark }">
    <TodoHeader
      :is-dark="isDark"
      :is-sidebar-open="isSidebarOpen"
      @toggle-menu="isSidebarOpen = !isSidebarOpen"
      @toggle-theme="toggleTheme"
    />

    <div class="flex min-h-0 flex-1">
      <TodoSidebar
        :open="isSidebarOpen"
        :active-list-id="listStore.selectedListId"
        :active-smart-view="taskStore.activeView?.type === 'smart' ? taskStore.activeView.smartView : null"
        :folders="listStore.foldersWithLists"
        :ungrouped-lists="listStore.ungroupedLists"
        :smart-view-counts="taskStore.smartViewCounts"
        @close="isSidebarOpen = false"
        @select-list="handleSelectList"
        @select-smart-view="handleSelectSmartView"
        @create-list="handleCreateList"
        @create-folder="handleCreateFolder"
        @move-list="handleMoveList"
        @rename-folder="handleRenameFolder"
        @delete-folder="handleDeleteFolder"
        @reorder-list="listStore.reorderList"
      />

      <main class="min-w-0 flex-1 overflow-y-auto bg-[#faf9f8] dark:bg-slate-950">
        <div class="mx-auto w-full max-w-5xl px-4 pb-12 pt-7 sm:px-8 lg:px-12">
          <div class="flex items-center gap-4">
            <h1 class="min-w-0 flex-1 truncate text-2xl font-semibold tracking-tight sm:text-3xl" :style="{ color: activeListColor }">
              {{ currentTitle }}
            </h1>
            <div v-if="activeList" class="relative">
              <button class="grid size-9 place-items-center rounded text-xl text-slate-500 transition hover:bg-slate-200 dark:hover:bg-slate-800" type="button" aria-label="More list options" :aria-expanded="isListOptionsOpen" @click="isListOptionsOpen = !isListOptionsOpen">⋯</button>
              <div v-if="isListOptionsOpen" class="absolute right-0 top-10 z-20 w-64 rounded border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                <button class="flex min-h-9 w-full items-center rounded px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" type="button" @click="startRenameList">Rename list</button>
                <div class="mt-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                  <p class="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">List color</p>
                  <div class="flex gap-2 px-3 py-2">
                    <button v-for="color in themeColors" :key="color" class="size-6 rounded-full border-2 border-white ring-1 ring-slate-300" :style="{ backgroundColor: color }" type="button" :aria-label="`Use list color ${color}`" @click="selectListTheme(color)" />
                  </div>
                </div>
                <button class="mt-2 flex min-h-9 w-full items-center rounded px-3 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950" type="button" @click="requestDeleteList">Delete list</button>
              </div>
            </div>
            <div v-else class="size-9" aria-hidden="true" />
            <button class="grid size-9 place-items-center rounded text-lg text-[#2564cf] transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800" type="button" aria-label="Change list view">▤</button>
            <button class="hidden size-9 place-items-center rounded text-lg text-[#2564cf] transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800 sm:grid" type="button" aria-label="Sort tasks">☷</button>
          </div>

          <form v-if="listRenameTitle" class="mt-3 flex gap-2" @submit.prevent="saveListRename">
            <label class="sr-only" for="rename-list-title">Rename list</label>
            <input id="rename-list-title" v-model="listRenameTitle" class="min-w-0 flex-1 rounded border border-blue-400 bg-white px-3 py-2 text-sm outline-none dark:bg-slate-900" type="text" autofocus />
            <button class="rounded bg-[#2564cf] px-3 text-sm text-white" type="submit">Save</button>
          </form>

          <p v-if="listStore.error" class="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200" role="alert">
            {{ listStore.error }}
          </p>

          <form v-if="canAddTask" class="mt-7 flex h-14 w-full items-center gap-4 rounded border border-slate-200 bg-white px-5 text-left text-sm text-[#2564cf] shadow-sm transition focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-400 dark:focus-within:ring-blue-900" @submit.prevent="handleAddTask">
            <span class="text-2xl font-light leading-none" aria-hidden="true">＋</span>
            <label class="sr-only" for="new-task-title">Add a task</label>
            <input id="new-task-title" v-model="taskTitle" class="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-[#2564cf] dark:text-slate-100 dark:placeholder:text-blue-400" type="text" :placeholder="t('addTask')" />
          </form>

          <template v-if="isPlannedView">
            <section v-for="group in plannedGroups" :key="group.key" class="mt-6" :aria-labelledby="`${group.key}-tasks-heading`">
              <h2 :id="`${group.key}-tasks-heading`" class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t(group.key) }}</h2>
              <div class="overflow-hidden rounded border border-slate-200 shadow-sm dark:border-slate-700">
                <TaskRow
                  v-for="task in group.tasks"
                  :key="task.id"
                  :task="task"
                  :step-count="taskStore.taskStepCounts.get(task.id) ?? null"
                  :list-name="taskListName(task.listId)"
                  :can-move-up="false"
                  :can-move-down="false"
                  @select="taskStore.setActiveTask(task.id)"
                  @toggle-completed="taskStore.toggleCompleted(task.id)"
                  @toggle-important="taskStore.toggleImportant(task.id)"
                  @toggle-my-day="taskStore.toggleMyDay(task.id)"
                  @delete="requestDeleteTask(task.id)"
                />
              </div>
            </section>
          </template>

          <section v-else-if="taskStore.activeTasks.length" class="mt-6" aria-labelledby="active-tasks-heading">
            <h2 id="active-tasks-heading" class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('tasks') }}</h2>
            <div class="overflow-hidden rounded border border-slate-200 shadow-sm dark:border-slate-700">
              <TaskRow
                v-for="task in taskStore.activeTasks"
                :key="task.id"
                :task="task"
                :step-count="taskStore.taskStepCounts.get(task.id) ?? null"
                :list-name="taskStore.activeView?.type === 'smart' && taskStore.activeView.smartView === 'important' ? taskListName(task.listId) : null"
                :can-move-up="taskStore.activeView?.type === 'list' && taskStore.activeTasks.indexOf(task) > 0"
                :can-move-down="taskStore.activeView?.type === 'list' && taskStore.activeTasks.indexOf(task) < taskStore.activeTasks.length - 1"
                @select="taskStore.setActiveTask(task.id)"
                @toggle-completed="taskStore.toggleCompleted(task.id)"
                @toggle-important="taskStore.toggleImportant(task.id)"
                @toggle-my-day="taskStore.toggleMyDay(task.id)"
                @move-up="taskStore.reorderTask(task.id, 'up')"
                @move-down="taskStore.reorderTask(task.id, 'down')"
                @delete="requestDeleteTask(task.id)"
              />
            </div>
          </section>

          <section v-if="!isPlannedView && taskStore.completedTasks.length" class="mt-7" aria-labelledby="completed-tasks-heading">
            <h2 id="completed-tasks-heading" class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Completed</h2>
            <div class="overflow-hidden rounded border border-slate-200 shadow-sm dark:border-slate-700">
              <TaskRow
                v-for="task in taskStore.completedTasks"
                :key="task.id"
                :task="task"
                :step-count="taskStore.taskStepCounts.get(task.id) ?? null"
                :list-name="taskStore.activeView?.type === 'smart' && taskStore.activeView.smartView === 'important' ? taskListName(task.listId) : null"
                :can-move-up="taskStore.activeView?.type === 'list' && taskStore.completedTasks.indexOf(task) > 0"
                :can-move-down="taskStore.activeView?.type === 'list' && taskStore.completedTasks.indexOf(task) < taskStore.completedTasks.length - 1"
                @select="taskStore.setActiveTask(task.id)"
                @toggle-completed="taskStore.toggleCompleted(task.id)"
                @toggle-important="taskStore.toggleImportant(task.id)"
                @toggle-my-day="taskStore.toggleMyDay(task.id)"
                @move-up="taskStore.reorderTask(task.id, 'up')"
                @move-down="taskStore.reorderTask(task.id, 'down')"
                @delete="requestDeleteTask(task.id)"
              />
            </div>
          </section>

          <p v-if="!taskStore.visibleTasks.length" class="mt-16 text-center text-sm text-slate-500 dark:text-slate-400">No tasks yet</p>
        </div>
      </main>

      <TaskDetailsPanel
        v-if="taskStore.activeTask"
        :task="taskStore.activeTask"
        :steps="taskStore.activeSteps"
        @close="taskStore.setActiveTask(null)"
        @save-title="taskStore.updateTask(taskStore.activeTaskId!, { title: $event })"
        @add-step="taskStore.createStep({ taskId: taskStore.activeTaskId!, title: $event })"
        @save-step-title="handleSaveStepTitle"
        @toggle-step="taskStore.toggleStep($event)"
        @delete-step="taskStore.deleteStep($event)"
        @toggle-my-day="taskStore.toggleMyDay(taskStore.activeTaskId!)"
        @set-due-date="taskStore.setDueDate(taskStore.activeTaskId!, $event)"
        @save-note="taskStore.saveNote(taskStore.activeTaskId!, $event)"
        @delete-task="handleDeleteActiveTask"
      />

      <div v-if="pendingDeleteTaskId" class="fixed inset-0 z-[60] grid place-items-center bg-slate-950/40 px-4" role="presentation" @click.self="cancelDeleteTask">
        <section class="w-full max-w-md rounded border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900" role="dialog" aria-modal="true" aria-labelledby="delete-task-title">
          <h2 id="delete-task-title" class="text-lg font-semibold text-slate-800 dark:text-slate-100">{{ t('confirmDeleteTask') }}</h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">{{ t('deleteTaskDescription') }}</p>
          <div class="mt-6 flex justify-end gap-3">
            <button class="min-h-10 rounded px-4 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800" type="button" @click="cancelDeleteTask">{{ t('cancel') }}</button>
            <button class="min-h-10 rounded bg-red-600 px-4 text-sm text-white hover:bg-red-700" type="button" @click="confirmDeleteTask">{{ t('confirm') }}</button>
          </div>
        </section>
      </div>

      <div v-if="pendingDeleteListId" class="fixed inset-0 z-[60] grid place-items-center bg-slate-950/40 px-4" role="presentation" @click.self="pendingDeleteListId = null">
        <section class="w-full max-w-md rounded border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900" role="dialog" aria-modal="true" aria-labelledby="delete-list-title">
          <h2 id="delete-list-title" class="text-lg font-semibold text-slate-800 dark:text-slate-100">Delete list?</h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Choose whether tasks should also be deleted or kept without a list.</p>
          <label class="mt-4 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input v-model="deleteListTasks" type="checkbox" />
            Delete contained tasks
          </label>
          <div class="mt-6 flex justify-end gap-3">
            <button class="min-h-10 rounded px-4 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800" type="button" @click="pendingDeleteListId = null">Cancel</button>
            <button class="min-h-10 rounded bg-red-600 px-4 text-sm text-white hover:bg-red-700" type="button" @click="confirmDeleteList">Delete list</button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
