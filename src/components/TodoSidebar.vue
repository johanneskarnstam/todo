<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Folder, List, SmartView } from '@/types'
import { useAuthStore } from '@/stores/authStore'
import { DEFAULT_LIST_ID } from '@/stores/listStore'

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
  smartViewCounts: Record<SmartView, number>
}

interface Emits {
  (event: 'close'): void
  (event: 'select-list', listId: string): void
  (event: 'select-smart-view', view: SmartView): void
  (event: 'create-list', name: string): void
  (event: 'create-folder', name: string): void
  (event: 'move-list', listId: string, folderId: string | null): void
  (event: 'rename-folder', folderId: string, name: string): void
  (event: 'delete-folder', folderId: string, deleteLists: boolean): void
  (event: 'reorder-list', listId: string, direction: 'up' | 'down'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()
const authStore = useAuthStore()
const router = useRouter()
const iconUrl = `${import.meta.env.BASE_URL}img/icons/todo-icon.svg`

const smartViews = [
  { key: 'myDay' as const, view: 'myDay' as SmartView },
  { key: 'important' as const, view: 'important' as SmartView },
  { key: 'planned' as const, view: 'planned' as SmartView },
  { key: 'tasks' as const },
]

const readCollapsedFolders = (): Record<string, boolean> => {
  if (typeof localStorage === 'undefined') return {}

  try {
    const storedValue = localStorage.getItem('todo-collapsed-folders')
    return storedValue ? JSON.parse(storedValue) as Record<string, boolean> : {}
  } catch {
    return {}
  }
}

const collapsedFolders = ref<Record<string, boolean>>(readCollapsedFolders())
const isAddingList = ref(false)
const newListName = ref('')
const isAddingFolder = ref(false)
const newFolderName = ref('')
const openMoveMenuListId = ref<string | null>(null)
const openFolderMenuId = ref<string | null>(null)
const editingFolderId = ref<string | null>(null)
const editingFolderName = ref('')

watch(collapsedFolders, (value) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('todo-collapsed-folders', JSON.stringify(value))
}, { deep: true })

const icons: Record<string, string> = {
  myDay: '☼',
  important: '☆',
  planned: '▣',
  tasks: '⌂',
}

const smartViewLabel = (key: string) => ({
  myDay: 'Min dag',
  important: 'Viktigt',
  planned: 'Planerat',
  tasks: 'Uppgifter',
}[key] ?? key)

const toggleFolder = (folderId: string) => {
  collapsedFolders.value[folderId] = !collapsedFolders.value[folderId]
}

const startRenamingFolder = (folder: Folder) => {
  editingFolderId.value = folder.id
  editingFolderName.value = folder.name
  openFolderMenuId.value = null
}

const submitRenameFolder = () => {
  const folderId = editingFolderId.value
  const name = editingFolderName.value.trim()
  if (!folderId || !name) return

  emit('rename-folder', folderId, name)
  editingFolderId.value = null
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

const handleLogout = async () => {
  await authStore.logout()
  await router.push('/login')
}
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-300 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-300 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="open"
      class="fixed inset-0 z-[70] bg-slate-950/30 lg:hidden"
      aria-hidden="true"
      @click="emit('close')"
    />
  </Transition>

  <aside
    class="fixed inset-y-0 left-0 z-[80] flex w-[292px] -translate-x-full flex-col rounded-r-xl border-r border-slate-200 bg-white shadow-xl transition-[width,transform] duration-300 ease-out dark:border-slate-700 dark:bg-slate-900 lg:static lg:z-auto lg:rounded-r-2xl lg:shadow-none"
    :class="open ? 'translate-x-0 lg:w-[292px]' : '-translate-x-full lg:w-0 lg:overflow-hidden lg:border-transparent lg:px-0'"
    aria-label="Uppgiftsnavigering"
  >
    <div class="flex h-full flex-col px-3 py-5">
      <div class="mb-5 flex h-10 items-center justify-between lg:hidden">
        <div class="flex items-center gap-2 px-1">
          <img class="size-8 rounded-lg shadow-sm" :src="iconUrl" alt="" aria-hidden="true" />
          <span class="text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-100">To Do</span>
        </div>
        <button
          class="grid size-9 place-items-center rounded-lg text-xl text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          type="button"
          aria-label="Stäng navigeringsmeny"
          @click="emit('close')"
        >
          ☰
        </button>
      </div>

      <nav class="space-y-1" aria-label="Smarta vyer">
        <button
          v-for="view in smartViews"
          :key="view.key"
          class="flex h-11 w-full items-center gap-4 rounded-lg px-3 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          :class="{ 'bg-[#eef5fc] text-slate-900 dark:bg-slate-800 dark:text-white': activeSmartView === view.view }"
          type="button"
          @click="selectSmartView(view.view)"
        >
          <span class="w-4 text-center text-lg leading-none text-slate-600 dark:text-slate-300" aria-hidden="true">{{ icons[view.key] }}</span>
          <span class="flex-1">{{ smartViewLabel(view.key) }}</span>
          <span v-if="view.view" class="min-w-5 text-right text-xs text-slate-500 dark:text-slate-400">{{ smartViewCounts[view.view] }}</span>
        </button>
      </nav>

      <div class="my-4 border-t border-slate-200 dark:border-slate-700" />

      <div class="min-h-0 flex-1 overflow-y-auto">
        <div class="mb-3 border-b border-slate-200 pb-2 dark:border-slate-700">
          <form v-if="isAddingFolder" class="flex gap-2 px-2" @submit.prevent="submitNewFolder">
            <label class="sr-only" for="new-folder-name">Nytt mappnamn</label>
            <input
              id="new-folder-name"
              v-model="newFolderName"
              class="min-w-0 flex-1 rounded-lg border border-blue-400 bg-white px-2 text-sm text-slate-800 outline-none ring-2 ring-blue-100 dark:bg-slate-800 dark:text-white dark:ring-blue-900"
              type="text"
              placeholder="Mappnamn"
              autofocus
            />
            <button class="text-sm text-[#2564cf] dark:text-blue-400" type="submit">Lägg till</button>
          </form>
          <button v-else class="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" type="button" @click="isAddingFolder = true">
            <span class="text-lg text-[#2564cf] dark:text-blue-400" aria-hidden="true">＋</span>
            <span>Ny mapp</span>
          </button>
        </div>

        <section v-for="section in folders" :key="section.folder.id" class="mb-4">
          <div v-if="editingFolderId === section.folder.id" class="mb-2 flex gap-2 px-2">
            <label class="sr-only" :for="`rename-folder-${section.folder.id}`">Byt namn på mapp</label>
            <input :id="`rename-folder-${section.folder.id}`" v-model="editingFolderName" class="min-w-0 flex-1 rounded border border-blue-400 px-2 text-sm outline-none" type="text" autofocus @keydown.enter="submitRenameFolder" />
            <button class="text-sm text-[#2564cf]" type="button" @click="submitRenameFolder">Spara</button>
          </div>
          <div v-else class="relative flex items-center px-3 pb-2">
            <button class="flex min-w-0 flex-1 items-center text-left text-sm font-semibold text-slate-800 dark:text-slate-100" type="button" @click="toggleFolder(section.folder.id)">
              <span class="flex-1 truncate">{{ section.folder.name }}</span>
              <span class="text-base font-normal text-slate-500" aria-hidden="true">{{ collapsedFolders[section.folder.id] ? '›' : '⌄' }}</span>
            </button>
            <button class="grid size-7 place-items-center rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" type="button" :aria-label="`Alternativ för ${section.folder.name}`" @click.stop="openFolderMenuId = openFolderMenuId === section.folder.id ? null : section.folder.id">⋯</button>
            <div v-if="openFolderMenuId === section.folder.id" class="absolute right-0 top-8 z-20 w-56 rounded border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800">
              <button class="flex min-h-9 w-full items-center rounded px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" type="button" @click="startRenamingFolder(section.folder)">Byt namn på mapp</button>
              <button class="flex min-h-9 w-full items-center rounded px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" type="button" @click="emit('delete-folder', section.folder.id, false); openFolderMenuId = null">Ta bort mapp, behåll listor</button>
              <button class="flex min-h-9 w-full items-center rounded px-3 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950" type="button" @click="emit('delete-folder', section.folder.id, true); openFolderMenuId = null">Ta bort mapp och listor</button>
            </div>
          </div>
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
                v-if="list.id !== DEFAULT_LIST_ID"
                class="absolute right-1 top-1 grid size-9 place-items-center rounded text-lg text-slate-500 opacity-100 transition hover:bg-slate-200 sm:opacity-0 sm:focus:opacity-100 sm:group-hover/list:opacity-100 dark:hover:bg-slate-700"
                type="button"
                 :aria-label="`Flytta ${list.name}`"
                :aria-expanded="openMoveMenuListId === list.id"
                @click.stop="toggleMoveMenu(list.id)"
              >
                ⋯
              </button>
              <div
                v-if="openMoveMenuListId === list.id"
                class="fixed inset-x-3 bottom-3 z-50 max-h-[70vh] overflow-y-auto rounded border border-slate-200 bg-white p-2 shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-1 sm:top-10 sm:w-56 dark:border-slate-700 dark:bg-slate-800"
                role="menu"
                :aria-label="`Flytta ${list.name} till mapp`"
              >
                <p class="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Flytta till</p>
                <button
                  class="flex min-h-10 w-full items-center rounded px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                  :class="{ 'font-semibold text-[#2564cf] dark:text-blue-400': !list.folderId }"
                  type="button"
                  role="menuitem"
                  @click="moveList(list.id, null)"
                >
                  Utan mapp
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
                <div class="mt-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                  <button class="flex min-h-9 w-full items-center rounded px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" type="button" role="menuitem" @click="emit('reorder-list', list.id, 'up'); openMoveMenuListId = null">Flytta lista upp</button>
                  <button class="flex min-h-9 w-full items-center rounded px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" type="button" role="menuitem" @click="emit('reorder-list', list.id, 'down'); openMoveMenuListId = null">Flytta lista ner</button>
                </div>
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
                :aria-label="`Flytta ${list.name}`"
                :aria-expanded="openMoveMenuListId === list.id"
                @click.stop="toggleMoveMenu(list.id)"
              >
                ⋯
              </button>
              <div
                v-if="openMoveMenuListId === list.id"
                class="fixed inset-x-3 bottom-3 z-50 max-h-[70vh] overflow-y-auto rounded border border-slate-200 bg-white p-2 shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-1 sm:top-10 sm:w-56 dark:border-slate-700 dark:bg-slate-800"
                role="menu"
                 :aria-label="`Flytta ${list.name} till mapp`"
              >
                <p class="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Flytta till</p>
                <button
                  class="flex min-h-10 w-full items-center rounded px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                  type="button"
                  role="menuitem"
                  @click="moveList(list.id, null)"
                >
                  Utan mapp
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
                <div class="mt-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                  <button class="flex min-h-9 w-full items-center rounded px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" type="button" role="menuitem" @click="emit('reorder-list', list.id, 'up'); openMoveMenuListId = null">Move list up</button>
                  <button class="flex min-h-9 w-full items-center rounded px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" type="button" role="menuitem" @click="emit('reorder-list', list.id, 'down'); openMoveMenuListId = null">Move list down</button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div class="border-t border-slate-200 pt-3 dark:border-slate-700">
        <form v-if="isAddingList" class="flex gap-2 px-2" @submit.prevent="submitNewList">
            <label class="sr-only" for="new-list-name">Nytt listnamn</label>
          <input
            id="new-list-name"
            v-model="newListName"
            class="min-w-0 flex-1 rounded border border-blue-400 bg-white px-2 text-sm text-slate-800 outline-none ring-2 ring-blue-100 dark:bg-slate-800 dark:text-white dark:ring-blue-900"
            type="text"
            placeholder="Listnamn"
            autofocus
          />
          <button class="text-sm text-[#2564cf] dark:text-blue-400" type="submit">Lägg till</button>
        </form>
        <button v-else class="flex h-10 w-full items-center gap-4 px-3 text-sm text-[#2564cf] transition hover:bg-slate-100 dark:text-blue-400 dark:hover:bg-slate-800" type="button" @click="isAddingList = true">
          <span class="text-xl leading-none" aria-hidden="true">＋</span>
          <span class="flex-1 text-left">Ny lista</span>
          <span aria-hidden="true">▣</span>
        </button>
        <RouterLink
          class="mt-2 flex h-10 w-full items-center gap-4 rounded px-3 text-sm text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          to="/settings"
          @click="emit('close')"
        >
          <span class="text-lg" aria-hidden="true">⚙</span>
          <span>Inställningar</span>
        </RouterLink>
        <div class="mt-3 flex items-center gap-3 border-t border-slate-200 pt-3 dark:border-slate-700">
          <img v-if="authStore.user?.photoURL" class="size-9 rounded-full object-cover" :src="authStore.user.photoURL" alt="Profilbild" />
          <div v-else class="grid size-9 place-items-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
            {{ (authStore.user?.email?.[0] ?? 'U').toUpperCase() }}
          </div>
          <span class="min-w-0 flex-1 truncate text-xs text-slate-600 dark:text-slate-300">{{ authStore.user?.email }}</span>
          <button class="grid size-9 place-items-center rounded text-lg text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-slate-800 dark:hover:text-red-400" type="button" aria-label="Logga ut" @click="handleLogout">↩</button>
        </div>
      </div>
    </div>
  </aside>
</template>
