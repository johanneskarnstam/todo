import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { Timestamp } from 'firebase/firestore'
import { useTaskBreakdown } from '@/composables/useTaskBreakdown'
import { useTaskBreakdownStore } from '@/stores/taskBreakdownStore'
import { useTaskStore } from '@/stores/taskStore'
import type { Step, Task, TaskAiBreakdown } from '@/types'

vi.mock('@/firebase', () => ({
  app: {},
  auth: { currentUser: { uid: 'user-1' } },
  db: {},
}))

const sampleTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  listId: 'list-1',
  title: 'Måla sovrummet',
  note: 'Grundmåla väggarna.',
  completed: false,
  important: false,
  myDay: false,
  order: 0,
  createdAt: Timestamp.now(),
  ...overrides,
})

const sampleBreakdown: TaskAiBreakdown = {
  metadata: {
    schemaVersion: 1,
    modelId: 'gemini-3.8-flash',
    sourceTitle: 'Måla sovrummet',
    sourceNote: 'Grundmåla väggarna.',
    sourcePrompt: 'Två dagars plan',
    generatedAt: Timestamp.now(),
    suggestionCount: 2,
    suggestionIds: ['s-1', 's-2'],
  },
  suggestions: [
    { id: 's-1', title: 'Täck golvet', order: 0, status: 'available' },
    { id: 's-2', title: 'Grundmåla', order: 1, status: 'available' },
  ],
}

describe('useTaskBreakdown', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('loads latest suggestions and exposes store state', async () => {
    const breakdownStore = useTaskBreakdownStore()
    vi.spyOn(breakdownStore, 'loadLatest').mockImplementation(async () => {
      breakdownStore.latest = sampleBreakdown
      return sampleBreakdown
    })

    const composable = useTaskBreakdown()
    const task = sampleTask()

    const result = await composable.loadLatest(task)

    expect(result).toEqual(sampleBreakdown)
    expect(composable.latest.value).toEqual(sampleBreakdown)
    expect(composable.suggestions.value).toHaveLength(2)
    expect(composable.activeTaskId.value).toBe('task-1')
  })

  it('ignores late responses when task changes before loadLatest resolves', async () => {
    const breakdownStore = useTaskBreakdownStore()
    let resolveFirst: (val: TaskAiBreakdown | null) => void = () => {}
    const firstPromise = new Promise<TaskAiBreakdown | null>((resolve) => {
      resolveFirst = resolve
    })

    vi.spyOn(breakdownStore, 'loadLatest')
      .mockImplementationOnce(() => firstPromise)
      .mockResolvedValueOnce(null)

    const composable = useTaskBreakdown()
    const task1 = sampleTask({ id: 'task-1' })
    const task2 = sampleTask({ id: 'task-2' })

    const call1 = composable.loadLatest(task1)
    const call2 = composable.loadLatest(task2)

    resolveFirst(sampleBreakdown)

    const result1 = await call1
    const result2 = await call2

    expect(result1).toBeNull()
    expect(result2).toBeNull()
    expect(composable.activeTaskId.value).toBe('task-2')
  })

  it('generates suggestions with provided input', async () => {
    const breakdownStore = useTaskBreakdownStore()
    const generateSpy = vi.spyOn(breakdownStore, 'generateLatest').mockResolvedValue(sampleBreakdown)

    const composable = useTaskBreakdown()
    const task = sampleTask()

    const result = await composable.generate(task, 'Dela upp i korta pass', 'gemini-3.7-flash')

    expect(generateSpy).toHaveBeenCalledWith('task-1', {
      title: 'Måla sovrummet',
      note: 'Grundmåla väggarna.',
      additionalPrompt: 'Dela upp i korta pass',
      modelId: 'gemini-3.7-flash',
    })
    expect(result).toEqual(sampleBreakdown)
  })

  it('ignores generate response if task was switched while generating', async () => {
    const breakdownStore = useTaskBreakdownStore()
    vi.spyOn(breakdownStore, 'loadLatest').mockResolvedValue(null)
    let resolveGen: (val: TaskAiBreakdown) => void = () => {}
    const genPromise = new Promise<TaskAiBreakdown>((resolve) => {
      resolveGen = resolve
    })
    vi.spyOn(breakdownStore, 'generateLatest').mockReturnValue(genPromise)

    const composable = useTaskBreakdown()
    const task1 = sampleTask({ id: 'task-1' })
    const task2 = sampleTask({ id: 'task-2' })

    const call = composable.generate(task1, 'Extra')
    await composable.loadLatest(task2)
    resolveGen(sampleBreakdown)

    const result = await call
    expect(result).toBeNull()
  })

  it('confirms selection and handles errors gracefully', async () => {
    const breakdownStore = useTaskBreakdownStore()
    vi.spyOn(breakdownStore, 'loadLatest').mockResolvedValue(sampleBreakdown)
    breakdownStore.latest = sampleBreakdown
    const taskStore = useTaskStore()

    const composable = useTaskBreakdown()
    composable.activeTaskId.value = 'task-1'

    const createdStep: Step = {
      id: 'step-1',
      taskId: 'task-1',
      title: 'Täck golvet',
      completed: false,
      aiSuggestionId: 's-1',
      createdAt: Timestamp.now(),
    }
    vi.spyOn(taskStore, 'createStepsFromAi').mockResolvedValue([createdStep])

    const created = await composable.confirmSelection('task-1', [
      { suggestionId: 's-1', selected: true },
      { suggestionId: 's-2', selected: false },
    ])

    expect(created).toHaveLength(1)
    expect(composable.confirmError.value).toBeNull()
  })

  it('sets confirmError if createStepsFromAi returns empty list or rejects', async () => {
    const breakdownStore = useTaskBreakdownStore()
    breakdownStore.latest = sampleBreakdown
    const taskStore = useTaskStore()

    const composable = useTaskBreakdown()
    composable.activeTaskId.value = 'task-1'

    vi.spyOn(taskStore, 'createStepsFromAi').mockResolvedValue([])

    const result = await composable.confirmSelection('task-1', [{ suggestionId: 's-1', selected: true }])

    expect(result).toEqual([])
    expect(composable.confirmError.value).toBe('Delstegen kunde inte sparas. Försök igen.')

    vi.spyOn(taskStore, 'createStepsFromAi').mockRejectedValue(new Error('Network error'))
    const result2 = await composable.confirmSelection('task-1', [{ suggestionId: 's-1', selected: true }])
    expect(result2).toEqual([])
    expect(composable.confirmError.value).toBe('Delstegen kunde inte sparas. Försök igen.')
  })

  it('detects when task title or note differs from generated metadata snapshot', () => {
    const breakdownStore = useTaskBreakdownStore()
    breakdownStore.latest = sampleBreakdown

    const composable = useTaskBreakdown()
    const taskSame = sampleTask()
    expect(composable.isContextStale(taskSame)).toBe(false)

    const taskDifferentTitle = sampleTask({ title: 'Måla vardagsrummet' })
    expect(composable.isContextStale(taskDifferentTitle)).toBe(true)

    const taskDifferentNote = sampleTask({ note: 'Annan anteckning' })
    expect(composable.isContextStale(taskDifferentNote)).toBe(true)
  })

  it('clears active task and store state on clear', () => {
    const breakdownStore = useTaskBreakdownStore()
    const clearSpy = vi.spyOn(breakdownStore, 'clearState')

    const composable = useTaskBreakdown()
    composable.activeTaskId.value = 'task-1'

    composable.clear()

    expect(composable.activeTaskId.value).toBeNull()
    expect(clearSpy).toHaveBeenCalled()
  })

  it('does not generate when a generation is already in progress', async () => {
    const breakdownStore = useTaskBreakdownStore()
    breakdownStore.isGenerating = true
    const generateSpy = vi.spyOn(breakdownStore, 'generateLatest')

    const composable = useTaskBreakdown()
    const task = sampleTask()

    const result = await composable.generate(task, 'Extra')

    expect(result).toBeNull()
    expect(generateSpy).not.toHaveBeenCalled()
  })

  it('resets confirmError when starting a new generation', async () => {
    const breakdownStore = useTaskBreakdownStore()
    vi.spyOn(breakdownStore, 'generateLatest').mockResolvedValue(sampleBreakdown)
    const taskStore = useTaskStore()
    breakdownStore.latest = sampleBreakdown
    vi.spyOn(taskStore, 'createStepsFromAi').mockResolvedValue([])

    const composable = useTaskBreakdown()
    composable.activeTaskId.value = 'task-1'

    await composable.confirmSelection('task-1', [{ suggestionId: 's-1', selected: true }])
    expect(composable.confirmError.value).toBeTruthy()

    await composable.generate(sampleTask(), 'Extra')
    expect(composable.confirmError.value).toBeNull()
  })

  it('resets confirmError when loading latest for a new task', async () => {
    const breakdownStore = useTaskBreakdownStore()
    vi.spyOn(breakdownStore, 'loadLatest').mockResolvedValue(null)
    const taskStore = useTaskStore()
    breakdownStore.latest = sampleBreakdown
    vi.spyOn(taskStore, 'createStepsFromAi').mockResolvedValue([])

    const composable = useTaskBreakdown()
    composable.activeTaskId.value = 'task-1'

    await composable.confirmSelection('task-1', [{ suggestionId: 's-1', selected: true }])
    expect(composable.confirmError.value).toBeTruthy()

    await composable.loadLatest(sampleTask({ id: 'task-2' }))
    expect(composable.confirmError.value).toBeNull()
  })

  it('returns null for task with no previous breakdown', async () => {
    const breakdownStore = useTaskBreakdownStore()
    vi.spyOn(breakdownStore, 'loadLatest').mockResolvedValue(null)

    const composable = useTaskBreakdown()
    const result = await composable.loadLatest(sampleTask())

    expect(result).toBeNull()
    expect(composable.latest.value).toBeNull()
    expect(composable.suggestions.value).toEqual([])
  })
})

