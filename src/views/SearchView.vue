<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TodoHeader from '@/components/TodoHeader.vue'
import { useTheme } from '@/composables/useTheme'
import { useListStore } from '@/stores/listStore'
import { useTaskStore } from '@/stores/taskStore'

const route = useRoute()
const router = useRouter()
const listStore = useListStore()
const taskStore = useTaskStore()
const { isDark, toggleTheme } = useTheme()

const query = computed(() => typeof route.query.q === 'string' ? route.query.q : '')
const normalizedQuery = computed(() => query.value.trim().toLocaleLowerCase('sv-SE'))
const taskListName = (listId: string) => listStore.lists.find((list) => list.id === listId)?.name ?? 'Okänd lista'

const matchingTasks = computed(() => {
  if (!normalizedQuery.value) return []
  return taskStore.tasks.filter((task) => {
    const searchableText = [
      task.title,
      task.note ?? '',
      ...(task.tags ?? []),
      taskListName(task.listId),
    ].join(' ').toLocaleLowerCase('sv-SE')
    return searchableText.includes(normalizedQuery.value)
  })
})

const matchingLists = computed(() => {
  if (!normalizedQuery.value) return []
  return listStore.lists.filter((list) => list.name.toLocaleLowerCase('sv-SE').includes(normalizedQuery.value))
})

const matchingTags = computed(() => {
  if (!normalizedQuery.value) return []
  return [...new Set(taskStore.tasks.flatMap((task) => task.tags ?? []))]
    .filter((tag) => tag.toLocaleLowerCase('sv-SE').includes(normalizedQuery.value))
})

const updateSearch = (value: string) => {
  void router.replace({ name: 'search', query: value ? { q: value } : {} })
}

const closeSearch = () => {
  void router.push({ name: 'home' })
}

const openTaskList = (listId: string) => {
  listStore.selectList(listId)
  taskStore.setListView(listId)
  void router.push({ name: 'home' })
}

const openTag = (tag: string) => {
  taskStore.setTagView(tag)
  void router.push({ name: 'tag', params: { tag } })
}

onMounted(async () => {
  await Promise.all([listStore.fetchLists(), taskStore.fetchTasks()])
})
</script>

<template>
  <div class="flex h-screen flex-col bg-[#faf9f8] text-slate-800 dark:bg-slate-950 dark:text-slate-100" :class="{ dark: isDark }">
    <TodoHeader
      :is-dark="isDark"
      :is-sidebar-open="false"
      :is-saving="taskStore.isSaving || listStore.isSaving"
      :search-open="true"
      :search-query="query"
      :show-menu="false"
      @toggle-theme="toggleTheme"
      @go-home="closeSearch"
      @open-search="undefined"
      @close-search="closeSearch"
      @update-search="updateSearch"
    />

    <main class="min-h-0 flex-1 overflow-y-auto bg-[#faf9f8] dark:bg-slate-950">
      <div class="mx-auto w-full max-w-4xl px-4 pb-12 pt-8 sm:px-8 lg:px-12">
        <div class="flex items-end justify-between gap-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-[#2564cf] dark:text-blue-400">Sökresultat</p>
            <h1 class="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{{ query ? `Resultat för “${query}”` : 'Sök i To Do' }}</h1>
          </div>
          <span v-if="query" class="text-sm text-slate-500 dark:text-slate-400">{{ matchingTasks.length }} uppgifter</span>
        </div>

        <p v-if="!query" class="mt-10 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">Börja skriva för att söka bland uppgifter, taggar och listor.</p>
        <p v-else-if="!matchingTasks.length && !matchingLists.length && !matchingTags.length" class="mt-10 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">Inga matchande resultat.</p>

        <section v-if="matchingTasks.length" class="mt-7" aria-labelledby="search-tasks-heading">
          <h2 id="search-tasks-heading" class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Uppgifter</h2>
          <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <button v-for="task in matchingTasks" :key="task.id" class="flex min-h-14 w-full items-center gap-3 border-b border-slate-200 px-4 py-2 text-left transition last:border-b-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" type="button" @click="openTaskList(task.listId)">
              <span class="grid size-6 shrink-0 place-items-center rounded-full border text-xs" :class="task.completed ? 'border-[#2564cf] bg-[#2564cf] text-white' : 'border-slate-400 text-transparent'">✓</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm" :class="{ 'text-slate-400 line-through dark:text-slate-500': task.completed }">{{ task.title }}</span>
                <span class="block truncate text-xs text-slate-500 dark:text-slate-400">{{ taskListName(task.listId) }}<span v-if="task.tags?.length"> · #{{ task.tags.join(' #') }}</span></span>
              </span>
            </button>
          </div>
        </section>

        <section v-if="matchingLists.length" class="mt-7" aria-labelledby="search-lists-heading">
          <h2 id="search-lists-heading" class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Listor</h2>
          <div class="flex flex-wrap gap-2">
            <button v-for="list in matchingLists" :key="list.id" class="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm transition hover:border-[#2564cf] hover:text-[#2564cf] dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-400 dark:hover:text-blue-300" type="button" @click="openTaskList(list.id)">{{ list.name }}</button>
          </div>
        </section>

        <section v-if="matchingTags.length" class="mt-7" aria-labelledby="search-tags-heading">
          <h2 id="search-tags-heading" class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Taggar</h2>
          <div class="flex flex-wrap gap-2">
            <button v-for="tag in matchingTags" :key="tag" class="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm text-sky-700 transition hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300" type="button" @click="openTag(tag)">#{{ tag }}</button>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>
