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

const sortByOrder = <T extends { order: number }>(items: T[]): T[] =>
  [...items].sort((first, second) => first.order - second.order)

export const useListStore = defineStore('lists', () => {
  const folders = ref<Folder[]>([])
  const lists = ref<List[]>([])
  const selectedListId = ref<string | null>(null)
  const isLoaded = ref(false)
  const error = ref<string | null>(null)
  const pendingListIds = new Set<string>()
  const pendingFolderIds = new Set<string>()

  const foldersWithLists = computed(() =>
    folders.value.map((folder) => ({
      folder,
      lists: lists.value.filter((list) => list.folderId === folder.id),
    })),
  )

  const ungroupedLists = computed(() => lists.value.filter((list) => !list.folderId))
  const selectedList = computed(() => lists.value.find((list) => list.id === selectedListId.value) ?? null)

  const clearState = () => {
    folders.value = []
    lists.value = []
    selectedListId.value = null
    isLoaded.value = false
    error.value = null
    pendingListIds.clear()
    pendingFolderIds.clear()
  }

  const userCollection = (collectionName: 'folders' | 'lists') => {
    const userId = auth.currentUser?.uid
    if (!userId) {
      throw new Error('A signed-in user is required to access lists.')
    }

    return collection(db, 'users', userId, collectionName)
  }

  const fetchLists = async () => {
    error.value = null

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
        ...fetchedLists,
        ...pendingLists.filter((list) => !fetchedLists.some((item) => item.id === list.id)),
      ])
      selectedListId.value ??= lists.value[0]?.id ?? null
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
        lists.value = sortByOrder(cachedLists)
        selectedListId.value ??= lists.value[0]?.id ?? null
        isLoaded.value = true
      } catch {
        error.value = fetchError instanceof Error ? fetchError.message : 'Unable to load lists.'
      }
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
      await setDoc(listReference, {
        name: optimisticList.name,
        ...(optimisticList.folderId ? { folderId: optimisticList.folderId } : {}),
        icon: optimisticList.icon,
        order: optimisticList.order,
        createdAt: serverTimestamp(),
      })
      return optimisticList
    } catch (createError) {
      error.value = createError instanceof Error ? createError.message : 'Unable to create list.'
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
      await setDoc(folderReference, {
        name: optimisticFolder.name,
        order: optimisticFolder.order,
      })
      return optimisticFolder
    } catch (createError) {
      error.value = createError instanceof Error ? createError.message : 'Unable to create folder.'
      return optimisticFolder
    }
  }

  const updateList = async (listId: string, updates: ListUpdate) => {
    const currentList = lists.value.find((list) => list.id === listId)
    if (!currentList) return

    const previousList = { ...currentList }
    Object.assign(currentList, updates)
    lists.value = sortByOrder(lists.value)

    try {
      await updateDoc(doc(userCollection('lists'), listId), updates)
    } catch (updateError) {
      lists.value = lists.value.map((list) => (list.id === listId ? previousList : list))
      error.value = updateError instanceof Error ? updateError.message : 'Unable to update list.'
    }
  }

  const moveList = async (listId: string, folderId: string | null) => {
    const currentList = lists.value.find((list) => list.id === listId)
    if (!currentList) return

    const previousList = { ...currentList }
    if (folderId) {
      currentList.folderId = folderId
    } else {
      delete currentList.folderId
    }

    try {
      await updateDoc(doc(userCollection('lists'), listId), {
        folderId: folderId ?? deleteField(),
      })
    } catch (moveError) {
      lists.value = lists.value.map((list) => (list.id === listId ? previousList : list))
      error.value = moveError instanceof Error ? moveError.message : 'Unable to move list.'
    }
  }

  const updateListTheme = (listId: string, themeColor: string) => {
    void updateList(listId, { themeColor })
  }

  const deleteList = async (listId: string) => {
    const listIndex = lists.value.findIndex((list) => list.id === listId)
    if (listIndex < 0) return false

    const [deletedList] = lists.value.splice(listIndex, 1)
    if (selectedListId.value === listId) selectedListId.value = lists.value[0]?.id ?? null

    try {
      await deleteDoc(doc(userCollection('lists'), listId))
      return true
    } catch (deleteError) {
      lists.value = sortByOrder([...lists.value, deletedList])
      selectedListId.value ??= listId
      error.value = deleteError instanceof Error ? deleteError.message : 'Unable to delete list.'
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
      await deleteDoc(doc(userCollection('folders'), folderId))
      await Promise.all(
        containedLists.map((list) =>
          deleteContainedLists
            ? deleteDoc(doc(userCollection('lists'), list.id))
            : updateDoc(doc(userCollection('lists'), list.id), { folderId: deleteField() }),
        ),
      )
      return removedListIds
    } catch (deleteError) {
      lists.value = previousLists
      folders.value = previousFolders
      error.value = deleteError instanceof Error ? deleteError.message : 'Unable to delete folder.'
      return null
    }
  }

  const reorderList = async (listId: string, direction: 'up' | 'down') => {
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
      await Promise.all([
        updateDoc(doc(userCollection('lists'), currentList.id), { order: currentList.order }),
        updateDoc(doc(userCollection('lists'), otherList.id), { order: otherList.order }),
      ])
    } catch (reorderError) {
      currentList.order = otherList.order
      otherList.order = currentOrder
      lists.value = sortByOrder(lists.value)
      error.value = reorderError instanceof Error ? reorderError.message : 'Unable to reorder list.'
    }
  }

  const updateFolder = async (folderId: string, updates: FolderUpdate) => {
    const currentFolder = folders.value.find((folder) => folder.id === folderId)
    if (!currentFolder) return

    const previousFolder = { ...currentFolder }
    Object.assign(currentFolder, updates)
    folders.value = sortByOrder(folders.value)

    try {
      await updateDoc(doc(userCollection('folders'), folderId), updates)
    } catch (updateError) {
      folders.value = folders.value.map((folder) => (folder.id === folderId ? previousFolder : folder))
      error.value = updateError instanceof Error ? updateError.message : 'Unable to update folder.'
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
    isLoaded,
    error,
    clearState,
    fetchLists,
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
