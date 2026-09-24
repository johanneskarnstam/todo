<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CalendarDays, ChevronDown, FolderPlus, ListPlus, ListTodo, MoreVertical, Plus, Settings, Star, Sun, Tags, X } from '@lucide/vue'
import type { Folder, List, SmartView } from '@/types'
import { DEFAULT_LIST_ID } from '@/stores/listStore'

interface FolderSection {
  folder: Folder
  lists: List[]
}

interface Props {
  open: boolean
  activeListId: string | null
  activeSmartView: SmartView | null
  availableTags: string[]
  selectedTag: string
  folders: FolderSection[]
  ungroupedLists: List[]
  smartViewCounts: Record<SmartView, number>
  listTaskCounts: Record<string, number>
}

interface Emits {
  (event: 'close'): void
  (event: 'select-list', listId: string): void
  (event: 'select-smart-view', view: SmartView): void
  (event: 'select-tag', tag: string): void
  (event: 'create-list', name: string): void
  (event: 'create-folder', name: string): void
  (event: 'move-list', listId: string, folderId: string | null): void
  (event: 'rename-folder', folderId: string, name: string): void
  (event: 'delete-folder', folderId: string, deleteLists: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const iconUrl = `${import.meta.env.BASE_URL}img/icons/todo-icon.svg`

const smartViews = [
  { key: 'myDay' as const, view: 'myDay' as SmartView, icon: Sun },
  { key: 'important' as const, view: 'important' as SmartView, icon: Star },
  { key: 'planned' as const, view: 'planned' as SmartView, icon: CalendarDays },
]

const tagTones = [
  'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-900/60',
  'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60',
  'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/60',
  'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60',
  'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/60',
  'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300 dark:hover:bg-cyan-900/60',
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
const isTagsOpen = ref(false)
let folderLongPressTimer: ReturnType<typeof setTimeout> | null = null
const suppressFolderClick = ref(false)
const ungroupedSectionId = '__ungrouped__'
const defaultList = computed(() => props.ungroupedLists.find((list) => list.id === DEFAULT_LIST_ID))
const otherUngroupedLists = computed(() => props.ungroupedLists.filter((list) => list.id !== DEFAULT_LIST_ID))

watch(collapsedFolders, (value) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('todo-collapsed-folders', JSON.stringify(value))
}, { deep: true })

const smartViewLabel = (key: string) => ({
  myDay: 'Min dag',
  important: 'Viktigt',
  planned: 'Planerat',
}[key] ?? key)

const tagTone = (tag: string) => {
  const hash = [...tag].reduce((total, character) => total + character.charCodeAt(0), 0)
  return tagTones[hash % tagTones.length]
}

const toggleFolder = (folderId: string) => {
  if (suppressFolderClick.value) {
    suppressFolderClick.value = false
    return
  }

  collapsedFolders.value[folderId] = !collapsedFolders.value[folderId]
}

const openFolderContextMenu = (folderId: string) => {
  openFolderMenuId.value = folderId
  suppressFolderClick.value = true
}

const startFolderLongPress = (folderId: string, event: PointerEvent) => {
  if (event.pointerType !== 'touch') return

  folderLongPressTimer = setTimeout(() => {
    openFolderContextMenu(folderId)
    folderLongPressTimer = null
  }, 500)
}

const cancelFolderLongPress = () => {
  if (folderLongPressTimer) {
    clearTimeout(folderLongPressTimer)
    folderLongPressTimer = null
  }
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

const selectTag = (tag: string) => {
  emit('select-tag', tag)
  isTagsOpen.value = false
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

  <Transition
    enter-active-class="transition-transform duration-300 ease-out"
    enter-from-class="-translate-x-full"
    enter-to-class="translate-x-0"
    leave-active-class="transition-transform duration-300 ease-in"
    leave-from-class="translate-x-0"
    leave-to-class="-translate-x-full"
  >
    <aside
      v-show="open"
      class="fixed inset-y-0 left-0 z-[80] flex w-[340px] flex-col rounded-r-xl border-r border-slate-200 bg-white shadow-xl transition-[width] duration-300 ease-out dark:border-slate-700 dark:bg-slate-900 lg:static lg:z-auto lg:rounded-r-2xl lg:shadow-none"
      :class="open ? 'lg:w-[340px]' : 'lg:w-0 lg:overflow-hidden lg:border-transparent lg:px-0'"
      aria-label="Uppgiftsnavigering"
    >
    <div class="flex h-full flex-col px-2 py-5">
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
          <X :size="20" :stroke-width="1.8" aria-hidden="true" />
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
          <component :is="view.icon" :size="19" :stroke-width="1.8" class="shrink-0 text-slate-600 dark:text-slate-300" aria-hidden="true" />
          <span class="flex-1">{{ smartViewLabel(view.key) }}</span>
          <span v-if="view.view" class="min-w-5 text-right text-xs text-slate-500 dark:text-slate-400">{{ smartViewCounts[view.view] }}</span>
        </button>
      </nav>

      <div class="mb-4">
        <button
          class="flex h-11 w-full items-center gap-4 rounded-lg px-3 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          type="button"
          aria-controls="sidebar-tags-menu"
          :aria-expanded="isTagsOpen"
          @click="isTagsOpen = !isTagsOpen"
        >
          <Tags :size="19" :stroke-width="1.8" class="shrink-0 text-slate-600 dark:text-slate-300" aria-hidden="true" />
          <span class="flex-1">Taggar</span>
          <ChevronDown
            :size="20"
            :stroke-width="1.75"
            class="text-slate-500 transition-transform duration-200 ease-out"
            :class="{ '-rotate-90': !isTagsOpen }"
            aria-hidden="true"
          />
        </button>
        <div v-if="isTagsOpen" id="sidebar-tags-menu" class="mt-2 flex flex-wrap gap-2 pl-1" role="menu" aria-label="Välj tagg">
          <button
            class="inline-flex min-h-8 items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            :class="{ 'font-semibold ring-2 ring-[#2564cf] ring-offset-1 dark:ring-blue-400 dark:ring-offset-slate-900': !selectedTag }"
            type="button"
            role="menuitem"
            @click="selectTag('')"
          >
            Alla taggar
          </button>
          <button
            v-for="tag in availableTags"
            :key="tag"
            class="inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-xs font-medium transition"
            :class="[tagTone(tag), { 'font-semibold ring-2 ring-[#2564cf] ring-offset-1 dark:ring-blue-400 dark:ring-offset-slate-900': selectedTag === tag }]"
            type="button"
            role="menuitem"
            @click="selectTag(tag)"
          >
            #{{ tag }}
          </button>
          <p v-if="!availableTags.length" class="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">Inga taggar ännu</p>
        </div>
      </div>

      <div class="mb-4 border-t border-slate-200 dark:border-slate-700" />

      <div class="min-h-0 flex-1 overflow-y-auto">
        <section v-if="defaultList" class="mb-5">
          <div class="relative flex min-h-11 items-center px-3">
            <button
              class="flex min-w-0 flex-1 items-center text-left text-[15px] font-semibold text-slate-800 dark:text-slate-100"
              type="button"
              :aria-expanded="!collapsedFolders[DEFAULT_LIST_ID]"
              @click="toggleFolder(DEFAULT_LIST_ID)"
            >
              <span class="flex-1 truncate">Huvudlista</span>
              <ChevronDown
                :size="20"
                :stroke-width="1.75"
                class="text-slate-500 transition-transform duration-200 ease-out"
                :class="{ '-rotate-90': collapsedFolders[DEFAULT_LIST_ID] }"
                aria-hidden="true"
              />
            </button>
          </div>
          <div v-if="!collapsedFolders[DEFAULT_LIST_ID]" class="ml-3 border-l-2 border-slate-300 dark:border-slate-600">
            <button
              class="group flex h-[52px] w-full items-center gap-4 border-l-2 border-transparent px-7 text-left text-[15px] text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              :class="{ 'border-[#2564cf] bg-[#eef5fc] font-semibold text-slate-900 dark:border-blue-400 dark:bg-slate-800 dark:text-white': activeListId === defaultList.id }"
              type="button"
              @click="emit('select-list', defaultList.id)"
            >
              <ListTodo :size="20" :stroke-width="1.8" class="shrink-0 text-slate-700 dark:text-slate-300" aria-hidden="true" />
              <span class="flex-1 truncate">{{ defaultList.name }}</span>
              <span v-if="listTaskCounts[defaultList.id]" class="min-w-5 text-right text-sm text-slate-600 dark:text-slate-300">{{ listTaskCounts[defaultList.id] }}</span>
            </button>
          </div>
        </section>

        <section v-for="section in folders" :key="section.folder.id" class="mb-5">
          <div v-if="editingFolderId === section.folder.id" class="mb-2 flex gap-2 px-2">
            <label class="sr-only" :for="`rename-folder-${section.folder.id}`">Byt namn på mapp</label>
            <input :id="`rename-folder-${section.folder.id}`" v-model="editingFolderName" class="min-w-0 flex-1 rounded border border-blue-400 px-2 text-sm outline-none" type="text" autofocus @keydown.enter="submitRenameFolder" />
            <button class="text-sm text-[#2564cf]" type="button" @click="submitRenameFolder">Spara</button>
          </div>
          <div
            v-else
            class="relative flex min-h-11 items-center px-3"
            data-folder-header
            @contextmenu.prevent="openFolderContextMenu(section.folder.id)"
            @pointerdown="startFolderLongPress(section.folder.id, $event)"
            @pointerup="cancelFolderLongPress"
            @pointercancel="cancelFolderLongPress"
            @pointerleave="cancelFolderLongPress"
          >
            <button
              class="flex min-w-0 flex-1 items-center text-left text-[15px] font-semibold text-slate-800 dark:text-slate-100"
              type="button"
              :aria-expanded="!collapsedFolders[section.folder.id]"
              @click="toggleFolder(section.folder.id)"
            >
              <span class="flex-1 truncate">{{ section.folder.name }}</span>
              <ChevronDown
                :size="20"
                :stroke-width="1.75"
                class="text-slate-500 transition-transform duration-200 ease-out"
                :class="{ '-rotate-90': collapsedFolders[section.folder.id] }"
                aria-hidden="true"
              />
            </button>
            <div v-if="openFolderMenuId === section.folder.id" class="absolute right-0 top-8 z-20 w-56 rounded border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800">
              <button class="flex min-h-9 w-full items-center rounded px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" type="button" aria-label="Byt namn på mapp" @click="startRenamingFolder(section.folder)">Byt namn på mapp</button>
              <button class="flex min-h-9 w-full items-center rounded px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" type="button" aria-label="Ta bort mapp, behåll listor" @click="emit('delete-folder', section.folder.id, false); openFolderMenuId = null">Ta bort mapp, behåll listor</button>
              <button class="flex min-h-9 w-full items-center rounded px-3 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950" type="button" aria-label="Ta bort mapp och listor" @click="emit('delete-folder', section.folder.id, true); openFolderMenuId = null">Ta bort mapp och listor</button>
            </div>
          </div>
          <div v-if="!collapsedFolders[section.folder.id]" class="ml-3 border-l-2 border-slate-300 dark:border-slate-600">
            <div
              v-for="list in section.lists"
              :key="list.id"
              class="group/list relative"
            >
              <button
                class="group flex h-[52px] w-full items-center gap-4 border-l-2 border-transparent px-7 pr-12 text-left text-[15px] text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                :class="{
                  'border-[#2564cf] bg-[#eef5fc] font-semibold text-slate-900 dark:border-blue-400 dark:bg-slate-800 dark:text-white': activeListId === list.id,
                }"
                type="button"
                @click="emit('select-list', list.id)"
              >
                <ListTodo :size="20" :stroke-width="1.8" class="shrink-0 text-slate-700 dark:text-slate-300" aria-hidden="true" />
                <span class="flex-1 truncate">{{ list.name }}</span>
                <span v-if="listTaskCounts[list.id]" class="min-w-5 text-right text-sm text-slate-600 dark:text-slate-300">{{ listTaskCounts[list.id] }}</span>
              </button>
              <button
                v-if="list.id !== DEFAULT_LIST_ID"
                class="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded text-lg tracking-widest text-slate-500 opacity-100 transition hover:bg-slate-200 sm:opacity-0 sm:focus:opacity-100 sm:group-hover/list:opacity-100 dark:hover:bg-slate-700"
                type="button"
                 :aria-label="`Flytta ${list.name}`"
                :aria-expanded="openMoveMenuListId === list.id"
                @click.stop="toggleMoveMenu(list.id)"
                >
                <MoreVertical :size="19" :stroke-width="1.8" aria-hidden="true" />
              </button>
              <div
                v-if="openMoveMenuListId === list.id"
                class="absolute right-1 top-10 z-50 max-h-[70vh] w-56 overflow-y-auto rounded border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800"
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
                </div>
              </div>
            </div>
          </div>
        </section>

        <section v-if="otherUngroupedLists.length" class="mb-5">
          <div class="relative flex min-h-11 items-center px-3">
            <button
              class="flex min-w-0 flex-1 items-center text-left text-[15px] font-semibold text-slate-800 dark:text-slate-100"
              type="button"
              :aria-expanded="!collapsedFolders[ungroupedSectionId]"
              @click="toggleFolder(ungroupedSectionId)"
            >
              <span class="flex-1 truncate">Utan mapp</span>
              <ChevronDown
                :size="20"
                :stroke-width="1.75"
                class="text-slate-500 transition-transform duration-200 ease-out"
                :class="{ '-rotate-90': collapsedFolders[ungroupedSectionId] }"
                aria-hidden="true"
              />
            </button>
          </div>
          <div v-if="!collapsedFolders[ungroupedSectionId]" class="ml-3 border-l-2 border-slate-300 dark:border-slate-600">
            <div
              v-for="list in otherUngroupedLists"
              :key="list.id"
              class="group/list relative"
            >
              <button
                class="group flex h-[52px] w-full items-center gap-4 border-l-2 border-transparent px-7 pr-12 text-left text-[15px] text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                :class="{ 'border-[#2564cf] bg-[#eef5fc] font-semibold text-slate-900 dark:border-blue-400 dark:bg-slate-800 dark:text-white': activeListId === list.id }"
                type="button"
                @click="emit('select-list', list.id)"
              >
                <ListTodo :size="20" :stroke-width="1.8" class="shrink-0 text-slate-700 dark:text-slate-300" aria-hidden="true" />
                <span class="flex-1 truncate">{{ list.name }}</span>
                <span v-if="listTaskCounts[list.id]" class="min-w-5 text-right text-sm text-slate-600 dark:text-slate-300">{{ listTaskCounts[list.id] }}</span>
              </button>
              <button
                v-if="list.id !== DEFAULT_LIST_ID"
                class="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded text-lg tracking-widest text-slate-500 opacity-100 transition hover:bg-slate-200 sm:opacity-0 sm:focus:opacity-100 sm:group-hover/list:opacity-100 dark:hover:bg-slate-700"
                type="button"
                :aria-label="`Flytta ${list.name}`"
                :aria-expanded="openMoveMenuListId === list.id"
                @click.stop="toggleMoveMenu(list.id)"
                >
                <MoreVertical :size="19" :stroke-width="1.8" aria-hidden="true" />
              </button>
              <div
                v-if="openMoveMenuListId === list.id"
                class="absolute right-1 top-10 z-50 max-h-[70vh] w-56 overflow-y-auto rounded border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800"
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
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div class="border-t border-slate-200 pt-4 dark:border-slate-700">
        <form v-if="isAddingList" class="flex gap-2 px-2" @submit.prevent="submitNewList">
            <label class="sr-only" for="new-list-name">Nytt listnamn</label>
          <input
            id="new-list-name"
            v-model="newListName"
            class="min-w-0 flex-1 rounded-lg border border-blue-400 bg-white px-3 py-2 text-base text-slate-800 outline-none ring-2 ring-blue-100 dark:bg-slate-800 dark:text-white dark:ring-blue-900"
            type="text"
            placeholder="Listnamn"
            autofocus
          />
          <button class="text-sm text-[#2564cf] dark:text-blue-400" type="submit">Lägg till</button>
        </form>
        <button v-else class="flex h-12 w-full items-center gap-4 px-3 text-[15px] text-[#2564cf] transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800" type="button" @click="isAddingList = true">
          <Plus :size="24" :stroke-width="1.8" aria-hidden="true" />
          <span class="flex-1 text-left">Ny lista</span>
          <ListPlus :size="20" :stroke-width="1.8" aria-hidden="true" />
        </button>
        <form v-if="isAddingFolder" class="mt-2 flex gap-2 px-2" @submit.prevent="submitNewFolder">
          <label class="sr-only" for="new-folder-name">Nytt mappnamn</label>
          <input
            id="new-folder-name"
            v-model="newFolderName"
            class="min-w-0 flex-1 rounded-lg border border-blue-400 bg-white px-3 py-2 text-base text-slate-800 outline-none ring-2 ring-blue-100 dark:bg-slate-800 dark:text-white dark:ring-blue-900"
            type="text"
            placeholder="Mappnamn"
            autofocus
          />
          <button class="text-sm text-[#2564cf] dark:text-blue-400" type="submit">Lägg till</button>
        </form>
        <button v-else class="mt-1 flex h-12 w-full items-center gap-4 rounded-lg px-3 text-[15px] text-[#2564cf] transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800" type="button" @click="isAddingFolder = true">
          <FolderPlus :size="24" :stroke-width="1.8" aria-hidden="true" />
          <span class="flex-1 text-left">Ny mapp</span>
        </button>
        <RouterLink
          class="mt-2 flex h-10 w-full items-center gap-4 rounded px-3 text-sm text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          to="/settings"
          @click="emit('close')"
        >
          <Settings :size="19" :stroke-width="1.8" aria-hidden="true" />
          <span>Inställningar</span>
        </RouterLink>
      </div>
    </div>
    </aside>
  </Transition>
</template>
