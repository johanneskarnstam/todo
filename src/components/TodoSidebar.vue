<script setup lang="ts">
interface ListItem {
  name: string
  count?: number
}

interface Folder {
  name: string
  lists: ListItem[]
}

interface Props {
  open: boolean
  activeList: string
}

interface Emits {
  (event: 'close'): void
  (event: 'select-list', name: string): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const smartViews: ListItem[] = [
  { name: 'My day' },
  { name: 'Important' },
  { name: 'Planned', count: 22 },
  { name: 'Assigned to me' },
  { name: 'Flagged email', count: 35 },
  { name: 'Tasks', count: 1 },
]

const folders: Folder[] = [
  {
    name: 'Packing lists',
    lists: [
      { name: 'Pack for the mountains', count: 1 },
      { name: 'Pack for Nice' },
    ],
  },
  {
    name: 'Build the cabin',
    lists: [{ name: 'Buy materials' }, { name: 'Build walls' }],
  },
]

const icons: Record<string, string> = {
  'My day': '☼',
  Important: '☆',
  Planned: '▣',
  'Assigned to me': '♙',
  'Flagged email': '⚑',
  Tasks: '⌂',
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
    aria-hidden="true"
    @click="emit('close')"
  />

  <aside
    class="fixed inset-y-0 left-0 z-40 flex w-[292px] -translate-x-full flex-col border-r border-slate-200 bg-white pt-14 shadow-xl transition-transform duration-200 dark:border-slate-700 dark:bg-slate-900 lg:static lg:z-auto lg:translate-x-0 lg:pt-0 lg:shadow-none"
    :class="{ 'translate-x-0': open }"
    aria-label="Task navigation"
  >
    <div class="flex h-full flex-col px-3 py-5">
      <button
        class="mb-5 flex h-9 w-10 items-center justify-center rounded text-xl text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        type="button"
        aria-label="Close navigation menu"
        @click="emit('close')"
      >
        ☰
      </button>

      <nav class="space-y-1" aria-label="Smart views">
        <button
          v-for="view in smartViews"
          :key="view.name"
          class="flex h-11 w-full items-center gap-4 rounded px-3 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          type="button"
        >
          <span class="w-4 text-center text-lg leading-none text-slate-600 dark:text-slate-300" aria-hidden="true">{{ icons[view.name] }}</span>
          <span class="flex-1">{{ view.name }}</span>
          <span v-if="view.count" class="text-xs text-slate-500 dark:text-slate-400">{{ view.count }}</span>
        </button>
      </nav>

      <div class="my-4 border-t border-slate-200 dark:border-slate-700" />

      <div class="min-h-0 flex-1 overflow-y-auto">
        <section v-for="folder in folders" :key="folder.name" class="mb-4">
          <button
            class="flex w-full items-center px-3 pb-2 text-left text-sm font-semibold text-slate-800 dark:text-slate-100"
            type="button"
          >
            <span class="flex-1">{{ folder.name }}</span>
            <span class="text-base font-normal text-slate-500" aria-hidden="true">⌄</span>
          </button>
          <div class="border-l-2 border-slate-300 dark:border-slate-600">
            <button
              v-for="list in folder.lists"
              :key="list.name"
              class="group flex h-11 w-full items-center gap-4 border-l-2 border-transparent px-4 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              :class="{
                'border-[#2564cf] bg-[#eef5fc] text-slate-900 dark:border-blue-400 dark:bg-slate-800 dark:text-white': activeList === list.name,
              }"
              type="button"
              @click="emit('select-list', list.name)"
            >
              <span class="text-lg text-slate-600 dark:text-slate-300" aria-hidden="true">☷</span>
              <span class="flex-1 truncate">{{ list.name }}</span>
              <span v-if="list.count" class="text-xs text-slate-500 dark:text-slate-400">{{ list.count }}</span>
            </button>
          </div>
        </section>
      </div>

      <div class="border-t border-slate-200 pt-3 dark:border-slate-700">
        <button class="flex h-10 w-full items-center gap-4 px-3 text-sm text-[#2564cf] transition hover:bg-slate-100 dark:text-blue-400 dark:hover:bg-slate-800" type="button">
          <span class="text-xl leading-none" aria-hidden="true">＋</span>
          <span class="flex-1 text-left">New list</span>
          <span aria-hidden="true">▣</span>
        </button>
        <div class="mt-2 flex items-center justify-around px-2 text-lg text-slate-600 dark:text-slate-300" aria-label="Quick links">
          <button type="button" aria-label="Mail">▱</button>
          <button type="button" aria-label="Calendar">▣</button>
          <button type="button" aria-label="People">♧</button>
          <button type="button" aria-label="Completed tasks">◆</button>
        </div>
      </div>
    </div>
  </aside>
</template>
