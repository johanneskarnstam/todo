import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { Timestamp } from 'firebase/firestore'
import { useTaskBreakdownStore } from '@/stores/taskBreakdownStore'
import type { AiBreakdownMetadata } from '@/types'

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn(),
  delete: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocFromCache: vi.fn(),
  getDocs: vi.fn(),
  getDocsFromCache: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
  set: vi.fn(),
  writeBatch: vi.fn(),
}))

const serviceMocks = vi.hoisted(() => ({
  generateTaskBreakdown: vi.fn(),
}))

vi.mock('@/firebase', () => ({
  auth: { currentUser: { uid: 'user-1' } },
  db: {},
}))

vi.mock('@/services/taskBreakdownService', () => ({
  classifyTaskBreakdownError: (error: unknown) => error instanceof Error
    ? error
    : new Error('Unknown error'),
  generateTaskBreakdown: serviceMocks.generateTaskBreakdown,
}))

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore')
  return {
    ...actual,
    collection: firestoreMocks.collection,
    doc: firestoreMocks.doc,
    getDoc: firestoreMocks.getDoc,
    getDocFromCache: firestoreMocks.getDocFromCache,
    getDocs: firestoreMocks.getDocs,
    getDocsFromCache: firestoreMocks.getDocsFromCache,
    orderBy: firestoreMocks.orderBy,
    query: firestoreMocks.query,
    serverTimestamp: firestoreMocks.serverTimestamp,
    writeBatch: firestoreMocks.writeBatch,
  }
})

const metadata = (overrides: Partial<AiBreakdownMetadata> = {}): AiBreakdownMetadata => ({
  schemaVersion: 1,
  modelId: 'gemini-3.8-flash',
  sourceTitle: 'Paint bedroom',
  sourceNote: 'Prime the wall',
  sourcePrompt: 'Spread over two days',
  generatedAt: Timestamp.fromMillis(10),
  suggestionCount: 1,
  suggestionIds: ['suggestion-1'],
  ...overrides,
})

const snapshot = (exists: boolean, data: object = {}) => ({
  exists: () => exists,
  data: () => data as Record<string, unknown>,
})

const suggestionsSnapshot = (documents: Array<{ id: string; data: Record<string, unknown> }>) => ({
  docs: documents.map((document) => ({ id: document.id, data: () => document.data })),
})

const batch = {
  delete: firestoreMocks.delete,
  set: firestoreMocks.set,
  commit: vi.fn(),
}

describe('useTaskBreakdownStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    firestoreMocks.collection.mockImplementation((...path: string[]) => ({ path }))
    firestoreMocks.doc.mockImplementation((...path: string[]) => ({ path }))
    firestoreMocks.orderBy.mockImplementation((field: string) => ({ field }))
    firestoreMocks.query.mockImplementation((reference: unknown) => reference)
    firestoreMocks.getDoc.mockResolvedValue(snapshot(false))
    firestoreMocks.getDocs.mockResolvedValue(suggestionsSnapshot([]))
    firestoreMocks.writeBatch.mockReturnValue(batch)
    batch.commit.mockResolvedValue(undefined)
    serviceMocks.generateTaskBreakdown.mockResolvedValue({
      modelId: 'gemini-3.8-flash',
      steps: ['Clear the room', 'Cover the floor'],
    })
  })

  it('loads latest metadata and ordered suggestion documents', async () => {
    firestoreMocks.getDoc.mockResolvedValueOnce(snapshot(true, metadata()))
    firestoreMocks.getDocs.mockResolvedValueOnce(suggestionsSnapshot([
      { id: 'suggestion-1', data: { title: 'Clear the room', order: 0, status: 'available' } },
    ]))
    const store = useTaskBreakdownStore()

    await store.loadLatest('task-1')

    expect(store.latest?.metadata.sourceNote).toBe('Prime the wall')
    expect(store.suggestions).toEqual([
      { id: 'suggestion-1', title: 'Clear the room', order: 0, status: 'available' },
    ])
    expect(firestoreMocks.orderBy).toHaveBeenCalledWith('order')
  })

  it('writes latest metadata and suggestion documents in one batch', async () => {
    const store = useTaskBreakdownStore()

    const result = await store.generateLatest('task-1', {
      title: ' Paint bedroom ',
      note: ' Prime the wall ',
      additionalPrompt: ' two days ',
    })

    expect(result.metadata).toMatchObject({
      sourceTitle: 'Paint bedroom',
      sourceNote: 'Prime the wall',
      sourcePrompt: 'two days',
      suggestionCount: 2,
      modelId: 'gemini-3.8-flash',
    })
    expect(result.metadata.suggestionIds).toHaveLength(2)
    expect(firestoreMocks.set).toHaveBeenCalledTimes(3)
    expect(batch.commit).toHaveBeenCalledOnce()
    expect(store.latest).toEqual(result)
  })

  it('deletes the previous suggestion docs only when a replacement generation succeeds', async () => {
    firestoreMocks.getDoc.mockResolvedValueOnce(snapshot(true, metadata()))
    firestoreMocks.getDocs.mockResolvedValueOnce(suggestionsSnapshot([
      { id: 'suggestion-1', data: { title: 'Old suggestion', order: 0, status: 'available' } },
    ]))
    const store = useTaskBreakdownStore()
    await store.loadLatest('task-1')
    firestoreMocks.set.mockClear()
    firestoreMocks.delete.mockClear()

    await store.generateLatest('task-1', { title: 'Paint bedroom' })

    const deletedReference = firestoreMocks.delete.mock.calls[0]?.[0] as { path: unknown[] }
    expect(deletedReference.path[deletedReference.path.length - 1]).toBe('suggestion-1')
    expect(JSON.stringify(deletedReference.path)).toContain('task-1')
    expect(batch.commit).toHaveBeenCalledOnce()
  })

  it('keeps the previous set when generation fails', async () => {
    firestoreMocks.getDoc.mockResolvedValueOnce(snapshot(true, metadata()))
    firestoreMocks.getDocs.mockResolvedValueOnce(suggestionsSnapshot([
      { id: 'suggestion-1', data: { title: 'Keep this', order: 0, status: 'available' } },
    ]))
    const store = useTaskBreakdownStore()
    await store.loadLatest('task-1')
    const previous = store.latest
    serviceMocks.generateTaskBreakdown.mockRejectedValueOnce(new Error('model failed'))

    await expect(store.generateLatest('task-1', { title: 'Paint bedroom' })).rejects.toThrow('model failed')

    expect(store.latest).toBe(previous)
    expect(batch.commit).not.toHaveBeenCalled()
  })

  it('clears local state when switching away from an active task', async () => {
    const store = useTaskBreakdownStore()
    store.currentTaskId = 'task-1'
    store.latest = {
      metadata: metadata(),
      suggestions: [],
    }

    store.clearState()

    expect(store.currentTaskId).toBeNull()
    expect(store.latest).toBeNull()
    expect(store.error).toBeNull()
  })
})
