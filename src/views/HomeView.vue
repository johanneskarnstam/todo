<script setup lang="ts">
import { onMounted, ref } from 'vue'
import TodoHeader from '@/components/TodoHeader.vue'
import TodoSidebar from '@/components/TodoSidebar.vue'
import { useListStore } from '@/stores/listStore'

const isSidebarOpen = ref(false)
const isDark = ref(false)
const listStore = useListStore()

const handleSelectList = (listId: string) => {
  listStore.selectList(listId)
  isSidebarOpen.value = false
}

const handleCreateList = (name: string) => {
  void listStore.createList({ name })
}

onMounted(() => {
  void listStore.fetchLists()
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
        :folders="listStore.foldersWithLists"
        :ungrouped-lists="listStore.ungroupedLists"
        @close="isSidebarOpen = false"
        @select-list="handleSelectList"
        @create-list="handleCreateList"
      />

      <main class="min-w-0 flex-1 overflow-y-auto bg-[#faf9f8] dark:bg-slate-950">
        <div class="mx-auto w-full max-w-5xl px-4 pb-12 pt-7 sm:px-8 lg:px-12">
          <div class="flex items-center gap-4">
            <h1 class="min-w-0 flex-1 truncate text-2xl font-semibold tracking-tight text-[#2564cf] dark:text-blue-400 sm:text-3xl">
              {{ listStore.selectedList?.name ?? 'My day' }}
            </h1>
            <button class="grid size-9 place-items-center rounded text-xl text-slate-500 transition hover:bg-slate-200 dark:hover:bg-slate-800" type="button" aria-label="More list options">⋯</button>
            <button class="grid size-9 place-items-center rounded text-lg text-[#2564cf] transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800" type="button" aria-label="Change list view">▤</button>
            <button class="hidden size-9 place-items-center rounded text-lg text-[#2564cf] transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800 sm:grid" type="button" aria-label="Sort tasks">☷</button>
          </div>

          <button class="mt-7 flex h-14 w-full items-center gap-4 rounded border border-slate-200 bg-white px-5 text-left text-sm text-[#2564cf] shadow-sm transition hover:border-blue-300 hover:shadow dark:border-slate-700 dark:bg-slate-900 dark:text-blue-400 dark:hover:border-blue-500" type="button">
            <span class="text-2xl font-light leading-none" aria-hidden="true">＋</span>
            <span>Add a task</span>
          </button>
        </div>
      </main>
    </div>
  </div>
</template>
