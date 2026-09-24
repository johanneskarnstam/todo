import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDocs,
  getDocsFromCache,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { auth, db } from '@/firebase'
import { useToastStore } from '@/stores/toastStore'
import type { Folder, List } from '@/types'

interface NewListInput {
  name: string
  folderId?: string
  icon?: string
}

interface NewFolderInput {
  name: string
}

type ListUpdate = Partial<Pick<List, 'name' | 'folderId' | 'icon' | 'order' | 'themeColor'>>
type FolderUpdate = Partial<Pick<Folder, 'name' | 'order'>>

export const DEFAULT_LIST_ID = '__default__'

const defaultList: List = {
  id: DEFAULT_LIST_ID,
  name: 'Att göra',
  icon: '⌂',
  order: 0,
  createdAt: Timestamp.fromMillis(0),
}

const sortByOrder = <T extends { order: number }>(items: T[]): T[] =>
  [...items].sort((first, second) => first.order - second.order)

export const useListStore = defineStore('lists', () => {
  const folders = ref<Folder[]>([])
  const lists = ref<List[]>([])
  const selectedListId = ref<string | null>(null)
  const defaultListId = ref<string | null>(null)
  const isLoaded = ref(false)
  const error = ref<string | null>(null)
  const pendingWriteCount = ref(0)
  const isSaving = computed(() => pendingWriteCount.value > 0)
  const pendingListIds = new Set<string>()
  const pendingFolderIds = new Set<string>()
  const toastStore = useToastStore()

  const reportWriteError = (writeError: unknown, fallback: string) => {
    const message = writeError instanceof Error ? writeError.message : fallback
    error.value = message
    toastStore.show(message)
  }

  const trackWrite = async <T>(write: () => Promise<T>): Promise<T> => {
    pendingWriteCount.value += 1
    try {
      return await write()
    } finally {
      pendingWriteCount.value -= 1
    }
  }

  const foldersWithLists = computed(() =>
    folders.value.map((folder) => ({
      folder,
      lists: lists.value.filter((list) => list.folderId === folder.id),
    })),
  )

  const ungroupedLists = computed(() => lists.value.filter((list) => !list.folderId))
  const selectedList = computed(() => lists.value.find((list) => list.id === selectedListId.value) ?? null)

  const defaultListStorageKey = () => {
    const userId = auth.currentUser?.uid
    return userId ? `todo-default-list-${userId}` : null
  }

  const readDefaultListId = () => {
    const storageKey = defaultListStorageKey()
    if (!storageKey || typeof localStorage === 'undefined') return null
    return localStorage.getItem(storageKey)
  }

  const selectFallbackList = () => {
    lists.value = sortByOrder([defaultList, ...lists.value.filter((list) => list.id !== DEFAULT_LIST_ID)])
    defaultListId.value = null
    selectedListId.value = DEFAULT_LIST_ID
    isLoaded.value = true
  }

  const clearState = () => {
    folders.value = []
    lists.value = []
    selectedListId.value = null
    defaultListId.value = null
    isLoaded.value = false
    error.value = null
    pendingListIds.clear()
    pendingFolderIds.clear()
  }

  const userCollection = (collectionName: 'folders' | 'lists') => {
    const userId = auth.currentUser?.uid
    if (!userId) {
      throw new Error('En inloggad användare krävs för att komma åt listor.')
    }

    return collection(db, 'users', userId, collectionName)
  }

  const fetchLists = async () => {
    error.value = null
    if (!selectedListId.value) selectedListId.value = DEFAULT_LIST_ID

    try {
      const [folderSnapshot, listSnapshot] = await Promise.all([
        getDocs(userCollection('folders')),
        getDocs(userCollection('lists')),
      ])

      const fetchedFolders = folderSnapshot.docs.map((folder) => ({ id: folder.id, ...folder.data() }) as Folder)
      const fetchedLists = listSnapshot.docs.map((list) => ({ id: list.id, ...list.data() }) as List)
      const pendingFolders = folders.value.filter((folder) => pendingFolderIds.has(folder.id))
      const pendingLists = lists.value.filter((list) => pendingListIds.has(list.id))

      fetchedFolders.forEach((folder) => pendingFolderIds.delete(folder.id))
      fetchedLists.forEach((list) => pendingListIds.delete(list.id))

      folders.value = sortByOrder([
        ...fetchedFolders,
        ...pendingFolders.filter((folder) => !fetchedFolders.some((item) => item.id === folder.id)),
      ])
      lists.value = sortByOrder([
        defaultList,
        ...fetchedLists,
        ...pendingLists.filter((list) => !fetchedLists.some((item) => item.id === list.id)),
      ])
      const storedDefaultListId = readDefaultListId()
      defaultListId.value = storedDefaultListId && lists.value.some((list) => list.id === storedDefaultListId) ? storedDefaultListId : null
      selectedListId.value = lists.value.some((list) => list.id === selectedListId.value)
        ? selectedListId.value
        : defaultListId.value ?? DEFAULT_LIST_ID
      isLoaded.value = true
    } catch (fetchError) {
      try {
        const [folderSnapshot, listSnapshot] = await Promise.all([
          getDocsFromCache(userCollection('folders')),
          getDocsFromCache(userCollection('lists')),
        ])
        const cachedFolders = folderSnapshot.docs.map((folder) => ({ id: folder.id, ...folder.data() }) as Folder)
        const cachedLists = listSnapshot.docs.map((list) => ({ id: list.id, ...list.data() }) as List)
        folders.value = sortByOrder(cachedFolders)
        lists.value = sortByOrder([defaultList, ...cachedLists])
        const storedDefaultListId = readDefaultListId()
        defaultListId.value = storedDefaultListId && lists.value.some((list) => list.id === storedDefaultListId) ? storedDefaultListId : null
        selectedListId.value = lists.value.some((list) => list.id === selectedListId.value)
          ? selectedListId.value
          : defaultListId.value ?? DEFAULT_LIST_ID
        isLoaded.value = true
      } catch {
        error.value = fetchError instanceof Error ? fetchError.message : 'Listorna kunde inte läsas in.'
        selectFallbackList()
      }
    }
  }

  const setDefaultList = (listId: string | null) => {
    const storageKey = defaultListStorageKey()
    if (!storageKey || typeof localStorage === 'undefined') return

    defaultListId.value = listId && listId !== DEFAULT_LIST_ID && lists.value.some((list) => list.id === listId) ? listId : null
    if (defaultListId.value) {
      localStorage.setItem(storageKey, defaultListId.value)
    } else {
      localStorage.removeItem(storageKey)
    }
  }

  const createList = async (input: NewListInput) => {
    const name = input.name.trim()
    if (!name) return

    const optimisticId = `optimistic-${crypto.randomUUID()}`
    const listReference = doc(userCollection('lists'), optimisticId)
    const optimisticList: List = {
      id: optimisticId,
      name,
      ...(input.folderId ? { folderId: input.folderId } : {}),
      icon: input.icon ?? '☷',
      order: lists.value.length,
      createdAt: Timestamp.now(),
    }

    lists.value = sortByOrder([...lists.value, optimisticList])
    pendingListIds.add(optimisticId)
    selectedListId.value = optimisticId
    error.value = null

    try {
      await trackWrite(() => setDoc(listReference, {
        name: optimisticList.name,
        ...(optimisticList.folderId ? { folderId: optimisticList.folderId } : {}),
        icon: optimisticList.icon,
        order: optimisticList.order,
        createdAt: serverTimestamp(),
      }))
      return optimisticList
    } catch (createError) {
      reportWriteError(createError, 'Listan kunde inte skapas.')
      return optimisticList
    }
  }

  const createFolder = async (input: NewFolderInput) => {
    const name = input.name.trim()
    if (!name) return

    const optimisticId = `optimistic-${crypto.randomUUID()}`
    const folderReference = doc(userCollection('folders'), optimisticId)
    const optimisticFolder: Folder = {
      id: optimisticId,
      name,
      order: folders.value.length,
    }

    folders.value = sortByOrder([...folders.value, optimisticFolder])
    pendingFolderIds.add(optimisticId)
    error.value = null

    try {
      await trackWrite(() => setDoc(folderReference, {
        name: optimisticFolder.name,
        order: optimisticFolder.order,
      }))
      return optimisticFolder
    } catch (createError) {
      reportWriteError(createError, 'Mappen kunde inte skapas.')
      return optimisticFolder
    }
  }

  const updateList = async (listId: string, updates: ListUpdate) => {
    if (listId === DEFAULT_LIST_ID) return

    const currentList = lists.value.find((list) => list.id === listId)
    if (!currentList) return

    const previousList = { ...currentList }
    Object.assign(currentList, updates)
    lists.value = sortByOrder(lists.value)

    try {
      await trackWrite(() => updateDoc(doc(userCollection('lists'), listId), updates))
    } catch (updateError) {
      lists.value = lists.value.map((list) => (list.id === listId ? previousList : list))
      reportWriteError(updateError, 'Listan kunde inte uppdateras.')
    }
  }

  const moveList = async (listId: string, folderId: string | null) => {
    if (listId === DEFAULT_LIST_ID) return

    const currentList = lists.value.find((list) => list.id === listId)
    if (!currentList) return

    const previousList = { ...currentList }
    if (folderId) {
      currentList.folderId = folderId
    } else {
      delete currentList.folderId
    }

    try {
      await trackWrite(() => updateDoc(doc(userCollection('lists'), listId), {
        folderId: folderId ?? deleteField(),
      }))
    } catch (moveError) {
      lists.value = lists.value.map((list) => (list.id === listId ? previousList : list))
      reportWriteError(moveError, 'Listan kunde inte flyttas.')
    }
  }

  const updateListTheme = (listId: string, themeColor: string) => {
    void updateList(listId, { themeColor })
  }

  const deleteList = async (listId: string) => {
    if (listId === DEFAULT_LIST_ID) return false

    const listIndex = lists.value.findIndex((list) => list.id === listId)
    if (listIndex < 0) return false

    const [deletedList] = lists.value.splice(listIndex, 1)
    if (selectedListId.value === listId) selectedListId.value = lists.value[0]?.id ?? null

    try {
      await trackWrite(() => deleteDoc(doc(userCollection('lists'), listId)))
      return true
    } catch (deleteError) {
      lists.value = sortByOrder([...lists.value, deletedList])
      selectedListId.value ??= listId
      reportWriteError(deleteError, 'Listan kunde inte tas bort.')
      return false
    }
  }

  const deleteFolder = async (folderId: string, deleteContainedLists: boolean) => {
    const containedLists = lists.value.filter((list) => list.folderId === folderId)
    const previousLists = [...lists.value]
    const previousFolders = [...folders.value]
    const removedListIds = deleteContainedLists ? containedLists.map((list) => list.id) : []

    if (deleteContainedLists) {
      lists.value = lists.value.filter((list) => list.folderId !== folderId)
      if (containedLists.some((list) => list.id === selectedListId.value)) {
        selectedListId.value = lists.value[0]?.id ?? null
      }
    } else {
      lists.value = lists.value.map((list) => {
        if (list.folderId !== folderId) return list
        const { folderId: _folderId, ...listWithoutFolder } = list
        return listWithoutFolder
      })
    }
    folders.value = folders.value.filter((folder) => folder.id !== folderId)

    try {
      await trackWrite(async () => {
        await deleteDoc(doc(userCollection('folders'), folderId))
        await Promise.all(
        containedLists.map((list) =>
          deleteContainedLists
            ? deleteDoc(doc(userCollection('lists'), list.id))
            : updateDoc(doc(userCollection('lists'), list.id), { folderId: deleteField() }),
        ),
        )
      })
      return removedListIds
    } catch (deleteError) {
      lists.value = previousLists
      folders.value = previousFolders
      reportWriteError(deleteError, 'Mappen kunde inte tas bort.')
      return null
    }
  }

  const reorderList = async (listId: string, direction: 'up' | 'down') => {
    if (listId === DEFAULT_LIST_ID) return

    const currentList = lists.value.find((list) => list.id === listId)
    if (!currentList) return

    const siblings = lists.value
      .filter((list) => list.folderId === currentList.folderId)
      .sort((first, second) => first.order - second.order)
    const index = siblings.findIndex((list) => list.id === listId)
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || swapIndex < 0 || swapIndex >= siblings.length) return

    const otherList = siblings[swapIndex]
    const currentOrder = currentList.order
    currentList.order = otherList.order
    otherList.order = currentOrder
    lists.value = sortByOrder(lists.value)

    try {
      await trackWrite(() => Promise.all([
        updateDoc(doc(userCollection('lists'), currentList.id), { order: currentList.order }),
        updateDoc(doc(userCollection('lists'), otherList.id), { order: otherList.order }),
      ]))
    } catch (reorderError) {
      currentList.order = otherList.order
      otherList.order = currentOrder
      lists.value = sortByOrder(lists.value)
      reportWriteError(reorderError, 'Listan kunde inte ordnas om.')
    }
  }

  const updateFolder = async (folderId: string, updates: FolderUpdate) => {
    const currentFolder = folders.value.find((folder) => folder.id === folderId)
    if (!currentFolder) return

    const previousFolder = { ...currentFolder }
    Object.assign(currentFolder, updates)
    folders.value = sortByOrder(folders.value)

    try {
      await trackWrite(() => updateDoc(doc(userCollection('folders'), folderId), updates))
    } catch (updateError) {
      folders.value = folders.value.map((folder) => (folder.id === folderId ? previousFolder : folder))
      reportWriteError(updateError, 'Mappen kunde inte uppdateras.')
    }
  }

  const selectList = (listId: string) => {
    if (lists.value.some((list) => list.id === listId)) {
      selectedListId.value = listId
    }
  }

  return {
    folders,
    lists,
    foldersWithLists,
    ungroupedLists,
    selectedList,
    selectedListId,
    defaultListId,
    isLoaded,
    isSaving,
    error,
    clearState,
    fetchLists,
    setDefaultList,
    createFolder,
    createList,
    updateListTheme,
    deleteList,
    deleteFolder,
    moveList,
    reorderList,
    updateList,
    updateFolder,
    selectList,
  }
})
