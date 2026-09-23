<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import TodoHeader from '@/components/TodoHeader.vue'
import TodoSidebar from '@/components/TodoSidebar.vue'
import TaskRow from '@/components/TaskRow.vue'
import TaskDetailsPanel from '@/components/TaskDetailsPanel.vue'
import { useListStore } from '@/stores/listStore'
import { useTaskStore } from '@/stores/taskStore'
import type { SmartView } from '@/types'

const isSidebarOpen = ref(false)
const isDark = ref(false)
const taskTitle = ref('')
const listStore = useListStore()
const taskStore = useTaskStore()

const currentTitle = computed(() => {
  const view = taskStore.activeView
  if (view?.type === 'smart') {
    return view.smartView === 'important' ? 'Important' : 'My day'
  }

  return listStore.selectedList?.name ?? 'My day'
})

const canAddTask = computed(() => taskStore.activeView?.type === 'list')

const handleSelectList = (listId: string) => {
  listStore.selectList(listId)
  taskStore.setListView(listId)
  isSidebarOpen.value = false
}

const handleCreateList = (name: string) => {
  void listStore.createList({ name }).then((createdList) => {
    if (createdList) taskStore.setListView(createdList.id)
  })
}

const handleSelectSmartView = (view: SmartView) => {
  taskStore.setSmartView(view)
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

  taskStore.setActiveTask(null)
  void taskStore.deleteTask(taskId)
}

onMounted(async () => {
  await listStore.fetchLists()
  if (listStore.selectedListId) taskStore.setListView(listStore.selectedListId)
})

const toggleTheme = () => {
  isDark.value = !isDark.value
}
</script>

<template>
  <div class="flex h-screen flex-col bg-[#faf9f8] text-slate-800 dark:bg-slate-950 dark:text-slate-100" :class="{ dark: isDark }">
    <TodoHeader
      :is-dark="isDark"
      @toggle-menu="isSidebarOpen = true"
      @toggle-theme="toggleTheme"
    />

    <div class="flex min-h-0 flex-1">
      <TodoSidebar
        :open="isSidebarOpen"
        :active-list-id="listStore.selectedListId"
        :active-smart-view="taskStore.activeView?.type === 'smart' ? taskStore.activeView.smartView : null"
        :folders="listStore.foldersWithLists"
        :ungrouped-lists="listStore.ungroupedLists"
        @close="isSidebarOpen = false"
        @select-list="handleSelectList"
        @select-smart-view="handleSelectSmartView"
        @create-list="handleCreateList"
      />

      <main class="min-w-0 flex-1 overflow-y-auto bg-[#faf9f8] dark:bg-slate-950">
        <div class="mx-auto w-full max-w-5xl px-4 pb-12 pt-7 sm:px-8 lg:px-12">
          <div class="flex items-center gap-4">
            <h1 class="min-w-0 flex-1 truncate text-2xl font-semibold tracking-tight text-[#2564cf] dark:text-blue-400 sm:text-3xl">
              {{ currentTitle }}
            </h1>
            <button class="grid size-9 place-items-center rounded text-xl text-slate-500 transition hover:bg-slate-200 dark:hover:bg-slate-800" type="button" aria-label="More list options">⋯</button>
            <button class="grid size-9 place-items-center rounded text-lg text-[#2564cf] transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800" type="button" aria-label="Change list view">▤</button>
            <button class="hidden size-9 place-items-center rounded text-lg text-[#2564cf] transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800 sm:grid" type="button" aria-label="Sort tasks">☷</button>
          </div>

          <form v-if="canAddTask" class="mt-7 flex h-14 w-full items-center gap-4 rounded border border-slate-200 bg-white px-5 text-left text-sm text-[#2564cf] shadow-sm transition focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-400 dark:focus-within:ring-blue-900" @submit.prevent="handleAddTask">
            <span class="text-2xl font-light leading-none" aria-hidden="true">＋</span>
            <label class="sr-only" for="new-task-title">Add a task</label>
            <input id="new-task-title" v-model="taskTitle" class="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-[#2564cf] dark:text-slate-100 dark:placeholder:text-blue-400" type="text" placeholder="Add a task" />
          </form>

          <section v-if="taskStore.activeTasks.length" class="mt-6" aria-labelledby="active-tasks-heading">
            <h2 id="active-tasks-heading" class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Active</h2>
            <div class="overflow-hidden rounded border border-slate-200 shadow-sm dark:border-slate-700">
              <TaskRow
                v-for="task in taskStore.activeTasks"
                :key="task.id"
                :task="task"
                @select="taskStore.setActiveTask(task.id)"
                @toggle-completed="taskStore.toggleCompleted(task.id)"
                @toggle-important="taskStore.toggleImportant(task.id)"
                @delete="taskStore.deleteTask(task.id)"
              />
            </div>
          </section>

          <section v-if="taskStore.completedTasks.length" class="mt-7" aria-labelledby="completed-tasks-heading">
            <h2 id="completed-tasks-heading" class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Completed</h2>
            <div class="overflow-hidden rounded border border-slate-200 shadow-sm dark:border-slate-700">
              <TaskRow
                v-for="task in taskStore.completedTasks"
                :key="task.id"
                :task="task"
                @select="taskStore.setActiveTask(task.id)"
                @toggle-completed="taskStore.toggleCompleted(task.id)"
                @toggle-important="taskStore.toggleImportant(task.id)"
                @delete="taskStore.deleteTask(task.id)"
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
        @toggle-step="taskStore.toggleStep($event)"
        @toggle-my-day="taskStore.toggleMyDay(taskStore.activeTaskId!)"
        @set-due-date="taskStore.setDueDate(taskStore.activeTaskId!, $event)"
        @save-note="taskStore.saveNote(taskStore.activeTaskId!, $event)"
        @delete-task="handleDeleteActiveTask"
      />
    </div>
  </div>
</template>
