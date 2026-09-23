import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { Timestamp } from 'firebase/firestore'
import { useListStore } from '@/stores/listStore'

const firestoreMocks = vi.hoisted(() => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
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
    firestoreMocks.addDoc.mockResolvedValue({ id: 'persisted-list' })
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

  it('adds a list optimistically and replaces the temporary id', async () => {
    let resolveAdd: (value: { id: string }) => void = () => undefined
    firestoreMocks.addDoc.mockReturnValueOnce(new Promise<{ id: string }>((resolve) => {
      resolveAdd = resolve
    }))
    const store = useListStore()

    const creation = store.createList({ name: '  Weekend jobs  ' })
    expect(store.lists[0]).toMatchObject({
      id: expect.stringContaining('optimistic-'),
      name: 'Weekend jobs',
    })

    resolveAdd({ id: 'list-1' })
    await creation
    expect(store.lists[0].id).toBe('list-1')
    expect(store.selectedListId).toBe('list-1')
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
})
