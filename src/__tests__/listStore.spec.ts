import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { Timestamp } from 'firebase/firestore'
import { useListStore } from '@/stores/listStore'

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
}))

vi.mock('@/firebase', () => ({
  auth: { currentUser: { uid: 'user-1' } },
  db: {},
}))

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore')
  return { ...actual, ...firestoreMocks }
})

const snapshot = (documents: Array<{ id: string; data: () => Record<string, unknown> }>) => ({
  docs: documents,
})

describe('useListStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    firestoreMocks.collection.mockImplementation((...path: string[]) => ({ path }))
    firestoreMocks.doc.mockImplementation((...path: string[]) => ({ path }))
    firestoreMocks.getDocs.mockResolvedValue(snapshot([]))
    firestoreMocks.setDoc.mockResolvedValue(undefined)
    firestoreMocks.updateDoc.mockResolvedValue(undefined)
  })

  it('loads folders and lists sorted by order', async () => {
    firestoreMocks.getDocs
      .mockResolvedValueOnce(
        snapshot([
          { id: 'folder-2', data: () => ({ name: 'Second', order: 2 }) },
          { id: 'folder-1', data: () => ({ name: 'First', order: 1 }) },
        ]),
      )
      .mockResolvedValueOnce(
        snapshot([
          {
            id: 'list-2',
            data: () => ({ name: 'Loose list', order: 2, icon: '☷', createdAt: Timestamp.now() }),
          },
          {
            id: 'list-1',
            data: () => ({ name: 'Nested list', folderId: 'folder-1', order: 1, icon: '☷', createdAt: Timestamp.now() }),
          },
        ]),
      )

    const store = useListStore()
    await store.fetchLists()

    expect(store.folders.map((folder) => folder.id)).toEqual(['folder-1', 'folder-2'])
    expect(store.lists.map((list) => list.id)).toEqual(['list-1', 'list-2'])
    expect(store.foldersWithLists[0].lists.map((list) => list.id)).toEqual(['list-1'])
    expect(store.ungroupedLists.map((list) => list.id)).toEqual(['list-2'])
    expect(store.selectedListId).toBe('list-1')
  })

  it('keeps a new list visible across a concurrent fetch and persists its stable id', async () => {
    let resolveAdd: () => void = () => undefined
    firestoreMocks.setDoc.mockReturnValueOnce(new Promise<void>((resolve) => {
      resolveAdd = () => resolve()
    }))
    const store = useListStore()

    const creation = store.createList({ name: '  Weekend jobs  ' })
    const optimisticId = store.lists[0].id
    expect(store.lists[0]).toMatchObject({
      id: optimisticId,
      name: 'Weekend jobs',
    })

    await store.fetchLists()
    expect(store.lists.map((list) => list.id)).toContain(optimisticId)

    resolveAdd()
    await creation
    expect(store.lists[0].id).toBe(optimisticId)
    expect(store.selectedListId).toBe(optimisticId)
    expect(firestoreMocks.setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'Weekend jobs' }),
    )
  })

  it('rolls back an optimistic list update when Firestore rejects', async () => {
    const store = useListStore()
    store.lists.push({
      id: 'list-1',
      name: 'Original name',
      icon: '☷',
      order: 1,
      createdAt: Timestamp.now(),
    })

    firestoreMocks.updateDoc.mockRejectedValueOnce(new Error('update failed'))
    await store.updateList('list-1', { name: 'Changed name' })

    expect(store.lists[0].name).toBe('Original name')
    expect(store.error).toBe('update failed')
  })

  it('moves a list between folders optimistically', async () => {
    const store = useListStore()
    store.folders.push(
      { id: 'folder-1', name: 'First', order: 1 },
      { id: 'folder-2', name: 'Second', order: 2 },
    )
    store.lists.push({
      id: 'list-1',
      name: 'Nested list',
      folderId: 'folder-1',
      icon: '☷',
      order: 1,
      createdAt: Timestamp.now(),
    })

    await store.moveList('list-1', 'folder-2')

    expect(store.foldersWithLists[0].lists).toHaveLength(0)
    expect(store.foldersWithLists[1].lists.map((list) => list.id)).toEqual(['list-1'])
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { folderId: 'folder-2' },
    )
  })

  it('moves a list out of a folder and rolls back when Firestore rejects', async () => {
    const store = useListStore()
    store.lists.push({
      id: 'list-1',
      name: 'Nested list',
      folderId: 'folder-1',
      icon: '☷',
      order: 1,
      createdAt: Timestamp.now(),
    })
    firestoreMocks.updateDoc.mockRejectedValueOnce(new Error('move failed'))

    await store.moveList('list-1', null)

    expect(store.lists[0].folderId).toBe('folder-1')
    expect(store.ungroupedLists).toHaveLength(0)
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ folderId: expect.anything() }),
    )
    expect(store.error).toBe('move failed')
  })

  it('keeps a newly created list visible when the write is temporarily rejected', async () => {
    firestoreMocks.setDoc.mockRejectedValueOnce(new Error('temporarily unavailable'))
    const store = useListStore()

    const createdList = await store.createList({ name: 'Offline list' })

    expect(createdList?.name).toBe('Offline list')
    expect(store.lists.map((list) => list.name)).toContain('Offline list')
    expect(store.error).toBe('temporarily unavailable')
  })

  it('creates a folder optimistically and persists it with a stable id', async () => {
    const store = useListStore()

    const createdFolder = await store.createFolder({ name: 'Home projects' })

    expect(createdFolder?.name).toBe('Home projects')
    expect(store.folders).toHaveLength(1)
    expect(store.folders[0].id).toBe(createdFolder?.id)
    expect(firestoreMocks.setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'Home projects', order: 0 }),
    )
  })
})
