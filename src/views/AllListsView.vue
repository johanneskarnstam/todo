<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ArrowLeft, ChevronRight, FolderOpen, ListTodo } from '@lucide/vue'
import { useRouter } from 'vue-router'
import { useListStore } from '@/stores/listStore'
import { useTaskStore } from '@/stores/taskStore'
import { useTheme } from '@/composables/useTheme'

const router = useRouter()
const listStore = useListStore()
const taskStore = useTaskStore()
const { isDark } = useTheme()

const ungroupedLists = computed(() => listStore.ungroupedLists)

const openList = (listId: string) => {
  listStore.selectList(listId)
  taskStore.setListView(listId)
  void router.push({ name: 'home' })
}

onMounted(() => void listStore.fetchLists())
</script>

<template>
  <main class="min-h-screen bg-[#faf9f8] px-3 py-4 text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:px-6 sm:py-8" :class="{ dark: isDark }">
    <div class="mx-auto max-w-3xl">
      <header class="mb-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <RouterLink class="grid size-9 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" to="/" aria-label="Tillbaka till uppgifter">
          <ArrowLeft :size="19" :stroke-width="1.8" aria-hidden="true" />
        </RouterLink>
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Organisering</p>
          <h1 class="truncate text-xl font-semibold tracking-tight">Alla mappar och listor</h1>
        </div>
      </header>

      <div v-if="!listStore.isLoaded" class="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        Läser in mappar och listor...
      </div>

      <div v-else class="space-y-4">
        <section v-for="section in listStore.foldersWithLists" :key="section.folder.id" class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900" :aria-labelledby="`folder-${section.folder.id}`">
          <div class="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <FolderOpen :size="19" :stroke-width="1.8" class="shrink-0 text-[#2564cf] dark:text-blue-400" aria-hidden="true" />
            <h2 :id="`folder-${section.folder.id}`" class="min-w-0 flex-1 truncate text-sm font-semibold">{{ section.folder.name }}</h2>
            <span class="text-xs text-slate-500 dark:text-slate-400">{{ section.lists.length }} {{ section.lists.length === 1 ? 'lista' : 'listor' }}</span>
          </div>
          <div v-if="section.lists.length" class="divide-y divide-slate-100 dark:divide-slate-800">
            <button v-for="list in section.lists" :key="list.id" class="flex min-h-14 w-full items-center gap-3 px-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/70" type="button" @click="openList(list.id)">
              <ListTodo :size="19" :stroke-width="1.8" class="shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
              <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ list.name }}</span>
              <span v-if="taskStore.listTaskCounts[list.id]" class="text-xs text-slate-500 dark:text-slate-400">{{ taskStore.listTaskCounts[list.id] }}</span>
              <ChevronRight :size="18" :stroke-width="1.8" class="shrink-0 text-slate-400" aria-hidden="true" />
            </button>
          </div>
          <p v-else class="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">Inga listor i mappen ännu.</p>
        </section>

        <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="ungrouped-heading">
          <div class="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <FolderOpen :size="19" :stroke-width="1.8" class="shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
            <h2 id="ungrouped-heading" class="min-w-0 flex-1 text-sm font-semibold">Utan mapp</h2>
            <span class="text-xs text-slate-500 dark:text-slate-400">{{ ungroupedLists.length }} {{ ungroupedLists.length === 1 ? 'lista' : 'listor' }}</span>
          </div>
          <div v-if="ungroupedLists.length" class="divide-y divide-slate-100 dark:divide-slate-800">
            <button v-for="list in ungroupedLists" :key="list.id" class="flex min-h-14 w-full items-center gap-3 px-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/70" type="button" @click="openList(list.id)">
              <ListTodo :size="19" :stroke-width="1.8" class="shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
              <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ list.name }}</span>
              <span v-if="taskStore.listTaskCounts[list.id]" class="text-xs text-slate-500 dark:text-slate-400">{{ taskStore.listTaskCounts[list.id] }}</span>
              <ChevronRight :size="18" :stroke-width="1.8" class="shrink-0 text-slate-400" aria-hidden="true" />
            </button>
          </div>
        </section>

        <p v-if="!listStore.foldersWithLists.length && !ungroupedLists.length" class="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">Inga mappar eller listor ännu.</p>
      </div>
    </div>
  </main>
</template>
