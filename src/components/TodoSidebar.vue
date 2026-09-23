<script setup lang="ts">
import { ref } from 'vue'
import type { Folder, List, SmartView } from '@/types'

interface FolderSection {
  folder: Folder
  lists: List[]
}

interface Props {
  open: boolean
  activeListId: string | null
  activeSmartView: SmartView | null
  folders: FolderSection[]
  ungroupedLists: List[]
}

interface Emits {
  (event: 'close'): void
  (event: 'select-list', listId: string): void
  (event: 'select-smart-view', view: SmartView): void
  (event: 'create-list', name: string): void
  (event: 'create-folder', name: string): void
  (event: 'move-list', listId: string, folderId: string | null): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const smartViews = [
  { name: 'My day', view: 'myDay' as SmartView },
  { name: 'Important', view: 'important' as SmartView },
  { name: 'Planned' },
  { name: 'Assigned to me' },
  { name: 'Flagged email' },
  { name: 'Tasks' },
]

const collapsedFolders = ref<Record<string, boolean>>({})
const isAddingList = ref(false)
const newListName = ref('')
const isAddingFolder = ref(false)
const newFolderName = ref('')
const openMoveMenuListId = ref<string | null>(null)

const icons: Record<string, string> = {
  'My day': '☼',
  Important: '☆',
  Planned: '▣',
  'Assigned to me': '♙',
  'Flagged email': '⚑',
  Tasks: '⌂',
}

const toggleFolder = (folderId: string) => {
  collapsedFolders.value[folderId] = !collapsedFolders.value[folderId]
}

const submitNewList = () => {
  const name = newListName.value.trim()
  if (!name) return

  emit('create-list', name)
  newListName.value = ''
  isAddingList.value = false
}

const submitNewFolder = () => {
  const name = newFolderName.value.trim()
  if (!name) return

  emit('create-folder', name)
  newFolderName.value = ''
  isAddingFolder.value = false
}

const selectSmartView = (view?: SmartView) => {
  if (view) emit('select-smart-view', view)
}

const toggleMoveMenu = (listId: string) => {
  openMoveMenuListId.value = openMoveMenuListId.value === listId ? null : listId
}

const moveList = (listId: string, folderId: string | null) => {
  emit('move-list', listId, folderId)
  openMoveMenuListId.value = null
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
          :class="{ 'bg-[#eef5fc] text-slate-900 dark:bg-slate-800 dark:text-white': activeSmartView === view.view }"
          type="button"
          @click="selectSmartView(view.view)"
        >
          <span class="w-4 text-center text-lg leading-none text-slate-600 dark:text-slate-300" aria-hidden="true">{{ icons[view.name] }}</span>
          <span class="flex-1">{{ view.name }}</span>
        </button>
      </nav>

      <div class="my-4 border-t border-slate-200 dark:border-slate-700" />

      <div class="min-h-0 flex-1 overflow-y-auto">
        <div class="mb-3 border-b border-slate-200 pb-2 dark:border-slate-700">
          <form v-if="isAddingFolder" class="flex gap-2 px-2" @submit.prevent="submitNewFolder">
            <label class="sr-only" for="new-folder-name">New folder name</label>
            <input
              id="new-folder-name"
              v-model="newFolderName"
              class="min-w-0 flex-1 rounded border border-blue-400 bg-white px-2 text-sm text-slate-800 outline-none ring-2 ring-blue-100 dark:bg-slate-800 dark:text-white dark:ring-blue-900"
              type="text"
              placeholder="Folder name"
              autofocus
            />
            <button class="text-sm text-[#2564cf] dark:text-blue-400" type="submit">Add</button>
          </form>
          <button v-else class="flex h-9 w-full items-center gap-3 px-3 text-sm text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" type="button" @click="isAddingFolder = true">
            <span class="text-lg text-[#2564cf] dark:text-blue-400" aria-hidden="true">＋</span>
            <span>New folder</span>
          </button>
        </div>

        <section v-for="section in folders" :key="section.folder.id" class="mb-4">
          <button
            class="flex w-full items-center px-3 pb-2 text-left text-sm font-semibold text-slate-800 dark:text-slate-100"
            type="button"
            @click="toggleFolder(section.folder.id)"
          >
            <span class="flex-1">{{ section.folder.name }}</span>
            <span class="text-base font-normal text-slate-500" aria-hidden="true">{{ collapsedFolders[section.folder.id] ? '›' : '⌄' }}</span>
          </button>
          <div v-if="!collapsedFolders[section.folder.id]" class="border-l-2 border-slate-300 dark:border-slate-600">
            <div v-for="list in section.lists" :key="list.id" class="group/list relative">
              <button
                class="group flex h-11 w-full items-center gap-4 border-l-2 border-transparent px-4 pr-12 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                :class="{
                  'border-[#2564cf] bg-[#eef5fc] text-slate-900 dark:border-blue-400 dark:bg-slate-800 dark:text-white': activeListId === list.id,
                }"
                type="button"
                @click="emit('select-list', list.id)"
              >
                <span class="text-lg text-slate-600 dark:text-slate-300" aria-hidden="true">{{ list.icon }}</span>
                <span class="flex-1 truncate">{{ list.name }}</span>
              </button>
              <button
                class="absolute right-1 top-1 grid size-9 place-items-center rounded text-lg text-slate-500 opacity-100 transition hover:bg-slate-200 sm:opacity-0 sm:focus:opacity-100 sm:group-hover/list:opacity-100 dark:hover:bg-slate-700"
                type="button"
                :aria-label="`Move ${list.name}`"
                :aria-expanded="openMoveMenuListId === list.id"
                @click.stop="toggleMoveMenu(list.id)"
              >
                ⋯
              </button>
              <div
                v-if="openMoveMenuListId === list.id"
                class="fixed inset-x-3 bottom-3 z-50 max-h-[70vh] overflow-y-auto rounded border border-slate-200 bg-white p-2 shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-1 sm:top-10 sm:w-56 dark:border-slate-700 dark:bg-slate-800"
                role="menu"
                :aria-label="`Move ${list.name} to folder`"
              >
                <p class="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Move to</p>
                <button
                  class="flex min-h-10 w-full items-center rounded px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                  :class="{ 'font-semibold text-[#2564cf] dark:text-blue-400': !list.folderId }"
                  type="button"
                  role="menuitem"
                  @click="moveList(list.id, null)"
                >
                  Without folder
                </button>
                <button
                  v-for="folderOption in folders"
                  :key="folderOption.folder.id"
                  class="flex min-h-10 w-full items-center rounded px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                  :class="{ 'font-semibold text-[#2564cf] dark:text-blue-400': list.folderId === folderOption.folder.id }"
                  type="button"
                  role="menuitem"
                  @click="moveList(list.id, folderOption.folder.id)"
                >
                  {{ folderOption.folder.name }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section v-if="ungroupedLists.length" class="mb-4">
          <div class="border-l-2 border-slate-300 dark:border-slate-600">
            <div v-for="list in ungroupedLists" :key="list.id" class="group/list relative">
              <button
                class="group flex h-11 w-full items-center gap-4 border-l-2 border-transparent px-4 pr-12 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                :class="{ 'border-[#2564cf] bg-[#eef5fc] text-slate-900 dark:border-blue-400 dark:bg-slate-800 dark:text-white': activeListId === list.id }"
                type="button"
                @click="emit('select-list', list.id)"
              >
                <span class="text-lg text-slate-600 dark:text-slate-300" aria-hidden="true">{{ list.icon }}</span>
                <span class="flex-1 truncate">{{ list.name }}</span>
              </button>
              <button
                class="absolute right-1 top-1 grid size-9 place-items-center rounded text-lg text-slate-500 opacity-100 transition hover:bg-slate-200 sm:opacity-0 sm:focus:opacity-100 sm:group-hover/list:opacity-100 dark:hover:bg-slate-700"
                type="button"
                :aria-label="`Move ${list.name}`"
                :aria-expanded="openMoveMenuListId === list.id"
                @click.stop="toggleMoveMenu(list.id)"
              >
                ⋯
              </button>
              <div
                v-if="openMoveMenuListId === list.id"
                class="fixed inset-x-3 bottom-3 z-50 max-h-[70vh] overflow-y-auto rounded border border-slate-200 bg-white p-2 shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-1 sm:top-10 sm:w-56 dark:border-slate-700 dark:bg-slate-800"
                role="menu"
                :aria-label="`Move ${list.name} to folder`"
              >
                <p class="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Move to</p>
                <button
                  class="flex min-h-10 w-full items-center rounded px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                  type="button"
                  role="menuitem"
                  @click="moveList(list.id, null)"
                >
                  Without folder
                </button>
                <button
                  v-for="folderOption in folders"
                  :key="folderOption.folder.id"
                  class="flex min-h-10 w-full items-center rounded px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                  type="button"
                  role="menuitem"
                  @click="moveList(list.id, folderOption.folder.id)"
                >
                  {{ folderOption.folder.name }}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div class="border-t border-slate-200 pt-3 dark:border-slate-700">
        <form v-if="isAddingList" class="flex gap-2 px-2" @submit.prevent="submitNewList">
          <label class="sr-only" for="new-list-name">New list name</label>
          <input
            id="new-list-name"
            v-model="newListName"
            class="min-w-0 flex-1 rounded border border-blue-400 bg-white px-2 text-sm text-slate-800 outline-none ring-2 ring-blue-100 dark:bg-slate-800 dark:text-white dark:ring-blue-900"
            type="text"
            placeholder="List name"
            autofocus
          />
          <button class="text-sm text-[#2564cf] dark:text-blue-400" type="submit">Add</button>
        </form>
        <button v-else class="flex h-10 w-full items-center gap-4 px-3 text-sm text-[#2564cf] transition hover:bg-slate-100 dark:text-blue-400 dark:hover:bg-slate-800" type="button" @click="isAddingList = true">
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
