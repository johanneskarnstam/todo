import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
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

type ListUpdate = Partial<Pick<List, 'name' | 'folderId' | 'icon' | 'order'>>
type FolderUpdate = Partial<Pick<Folder, 'name' | 'order'>>

const sortByOrder = <T extends { order: number }>(items: T[]): T[] =>
  [...items].sort((first, second) => first.order - second.order)

export const useListStore = defineStore('lists', () => {
  const folders = ref<Folder[]>([])
  const lists = ref<List[]>([])
  const selectedListId = ref<string | null>(null)
  const isLoaded = ref(false)
  const error = ref<string | null>(null)

  const foldersWithLists = computed(() =>
    folders.value.map((folder) => ({
      folder,
      lists: lists.value.filter((list) => list.folderId === folder.id),
    })),
  )

  const ungroupedLists = computed(() => lists.value.filter((list) => !list.folderId))
  const selectedList = computed(() => lists.value.find((list) => list.id === selectedListId.value) ?? null)

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

      folders.value = sortByOrder(
        folderSnapshot.docs.map((folder) => ({ id: folder.id, ...folder.data() }) as Folder),
      )
      lists.value = sortByOrder(
        listSnapshot.docs.map((list) => ({ id: list.id, ...list.data() }) as List),
      )
      selectedListId.value ??= lists.value[0]?.id ?? null
      isLoaded.value = true
    } catch (fetchError) {
      error.value = fetchError instanceof Error ? fetchError.message : 'Unable to load lists.'
    }
  }

  const createList = async (input: NewListInput) => {
    const name = input.name.trim()
    if (!name) return

    const optimisticId = `optimistic-${crypto.randomUUID()}`
    const optimisticList: List = {
      id: optimisticId,
      name,
      ...(input.folderId ? { folderId: input.folderId } : {}),
      icon: input.icon ?? '☷',
      order: lists.value.length,
      createdAt: Timestamp.now(),
    }

    lists.value = sortByOrder([...lists.value, optimisticList])
    selectedListId.value = optimisticId
    error.value = null

    try {
      const listReference = await addDoc(userCollection('lists'), {
        name: optimisticList.name,
        ...(optimisticList.folderId ? { folderId: optimisticList.folderId } : {}),
        icon: optimisticList.icon,
        order: optimisticList.order,
        createdAt: serverTimestamp(),
      })
      const persistedList: List = { ...optimisticList, id: listReference.id }
      lists.value = lists.value.map((list) => (list.id === optimisticId ? persistedList : list))
      selectedListId.value = listReference.id
      return persistedList
    } catch (createError) {
      lists.value = lists.value.filter((list) => list.id !== optimisticId)
      selectedListId.value = lists.value[0]?.id ?? null
      error.value = createError instanceof Error ? createError.message : 'Unable to create list.'
    }
  }

  const createFolder = async (input: NewFolderInput) => {
    const name = input.name.trim()
    if (!name) return

    const optimisticId = `optimistic-${crypto.randomUUID()}`
    const optimisticFolder: Folder = {
      id: optimisticId,
      name,
      order: folders.value.length,
    }

    folders.value = sortByOrder([...folders.value, optimisticFolder])
    error.value = null

    try {
      const folderReference = await addDoc(userCollection('folders'), {
        name: optimisticFolder.name,
        order: optimisticFolder.order,
      })
      const persistedFolder: Folder = { ...optimisticFolder, id: folderReference.id }
      folders.value = folders.value.map((folder) => (folder.id === optimisticId ? persistedFolder : folder))
      return persistedFolder
    } catch (createError) {
      folders.value = folders.value.filter((folder) => folder.id !== optimisticId)
      error.value = createError instanceof Error ? createError.message : 'Unable to create folder.'
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
    fetchLists,
    createFolder,
    createList,
    updateList,
    updateFolder,
    selectList,
  }
})
