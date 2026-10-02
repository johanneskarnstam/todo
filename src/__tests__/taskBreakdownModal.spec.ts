import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { Timestamp } from 'firebase/firestore'
import TaskBreakdownModal from '@/components/TaskBreakdownModal.vue'
import { useTaskBreakdownStore } from '@/stores/taskBreakdownStore'
import { useTaskStore } from '@/stores/taskStore'
import { TaskBreakdownError } from '@/services/taskBreakdownService'
import { useTaskBreakdownModels } from '@/composables/useTaskBreakdownModels'
import type { Task, TaskAiBreakdown } from '@/types'

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
    sourcePrompt: '',
    generatedAt: Timestamp.now(),
    suggestionCount: 3,
    suggestionIds: ['s-1', 's-2', 's-3'],
  },
  suggestions: [
    { id: 's-1', title: 'Köp färg och roller', order: 0, status: 'available' },
    { id: 's-2', title: 'Täck golv och lister', order: 1, status: 'skipped' },
    { id: 's-3', title: 'Spackla ojämnheter', order: 2, status: 'added', stepId: 'step-3' },
  ],
}

const mountModal = (props: { isOpen: boolean; task: Task }) =>
  mount(TaskBreakdownModal, {
    props,
    global: { stubs: { Teleport: true, RouterLink: true } },
  })

describe('TaskBreakdownModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    useTaskBreakdownModels().selectedModelId.value = 'gemini-3.8-flash'
  })

  it('renders task context and informative disclosure text', async () => {
    const breakdownStore = useTaskBreakdownStore()
    vi.spyOn(breakdownStore, 'loadLatest').mockResolvedValue(null)

    const wrapper = mountModal({
      isOpen: true,
      task: sampleTask(),
    })

    expect(wrapper.text()).toContain('Bryt ner uppgiften')
    expect(wrapper.text()).toContain('Måla sovrummet')
    expect(wrapper.text()).toContain('Grundmåla väggarna.')
    expect(wrapper.text()).toContain(
      'Titel, anteckning och eventuell extratext skickas till Gemini Developer API när du genererar.',
    )
    expect(wrapper.find('textarea').exists()).toBe(true)
  })

  it('renders suggestions with checkboxes and handles selection toggle', async () => {
    const breakdownStore = useTaskBreakdownStore()
    vi.spyOn(breakdownStore, 'loadLatest').mockImplementation(async (taskId: string) => {
      breakdownStore.currentTaskId = taskId
      breakdownStore.latest = sampleBreakdown
      return sampleBreakdown
    })

    const wrapper = mountModal({
      isOpen: true,
      task: sampleTask(),
    })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Föreslagna delsteg'))

    expect(wrapper.text()).toContain('Köp färg och roller')
    expect(wrapper.text()).toContain('Täck golv och lister')
    expect(wrapper.text()).toContain('Spackla ojämnheter')
    expect(wrapper.text()).toContain('Tillagt')

    // Wait for openModal to sync checkboxes
    await vi.waitFor(() => {
      const inputs = wrapper.findAll('input[type="checkbox"]')
      expect(inputs).toHaveLength(3)
      expect((inputs[0].element as HTMLInputElement).checked).toBe(true)
    })

    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    expect((checkboxes[1].element as HTMLInputElement).checked).toBe(false)
    expect((checkboxes[2].element as HTMLInputElement).disabled).toBe(true)

    // "Lägg till valda (1)" button is displayed since only s-1 is new and selected
    expect(wrapper.find('button.bg-\\[\\#2564cf\\]').text()).toContain('Lägg till valda (1)')

    // Toggle s-2 (check it)
    await checkboxes[1].trigger('change')
    await vi.waitFor(() => expect(wrapper.find('button.bg-\\[\\#2564cf\\]').text()).toContain('Lägg till valda (2)'))

    // Uncheck s-1
    await checkboxes[0].trigger('change')
    await vi.waitFor(() => expect(wrapper.find('button.bg-\\[\\#2564cf\\]').text()).toContain('Lägg till valda (1)'))
  })

  it('shows stale context warning if task title was modified after generation', async () => {
    const breakdownStore = useTaskBreakdownStore()
    vi.spyOn(breakdownStore, 'loadLatest').mockImplementation(async () => {
      breakdownStore.latest = sampleBreakdown
      return sampleBreakdown
    })

    const wrapper = mountModal({
      isOpen: true,
      task: sampleTask({ title: 'Måla sovrummet och hallen' }),
    })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Föreslagna delsteg'))

    expect(wrapper.text()).toContain('Förslagen skapades från en äldre titel eller anteckning.')
  })

  it('does not suggest a model change for quota errors', async () => {
    const breakdownStore = useTaskBreakdownStore()
    vi.spyOn(breakdownStore, 'loadLatest').mockImplementation(async () => {
      const err = new TaskBreakdownError('quota', 'AI-tjänstens kvot har överskridits.')
      breakdownStore.error = err
      throw err
    })

    const wrapper = mountModal({
      isOpen: true,
      task: sampleTask(),
    })
    await vi.waitFor(() => expect(wrapper.text()).toContain('AI-kvoten är nådd'))

    expect(wrapper.text()).toContain('AI-tjänstens kvot har överskridits.')
    expect(wrapper.text()).not.toContain('Välj en annan modell')
  })

  it('always shows model selector and allows retry with different model on overload', async () => {
    const breakdownStore = useTaskBreakdownStore()
    vi.spyOn(breakdownStore, 'loadLatest').mockImplementation(async () => {
      const err = new TaskBreakdownError('overloaded', 'Modellen är för närvarande överbelastad.')
      breakdownStore.error = err
      throw err
    })
    const generateSpy = vi.spyOn(breakdownStore, 'generateLatest').mockResolvedValue(sampleBreakdown)

    const wrapper = mountModal({
      isOpen: true,
      task: sampleTask(),
    })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Modellen är tillfälligt överbelastad'))

    // The model selector is always visible (not just on error)
    const select = wrapper.find('#modal-model-select')
    expect(select.exists()).toBe(true)

    // Should list the default plus fallback models
    const options = select.findAll('option')
    expect(options.length).toBeGreaterThanOrEqual(4)
    expect(options[0].text()).toContain('standard')

    // Change model to 3.6 Flash
    await select.setValue('gemini-3.6-flash')

    // Click "Försök igen" retry button
    const retryButton = wrapper.findAll('button').find((btn) => btn.text().includes('Försök igen'))
    expect(retryButton).toBeTruthy()
    await retryButton?.trigger('click')

    expect(generateSpy).toHaveBeenCalledWith('task-1', expect.objectContaining({
      modelId: 'gemini-3.6-flash',
    }))
  })

  it('confirms selection and emits close on success', async () => {
    const breakdownStore = useTaskBreakdownStore()
    vi.spyOn(breakdownStore, 'loadLatest').mockImplementation(async () => {
      breakdownStore.latest = sampleBreakdown
      return sampleBreakdown
    })
    const taskStore = useTaskStore()
    vi.spyOn(taskStore, 'createStepsFromAi').mockResolvedValue([
      {
        id: 'new-step-1',
        taskId: 'task-1',
        title: 'Köp färg och roller',
        completed: false,
        createdAt: Timestamp.now(),
      },
    ])

    const wrapper = mountModal({
      isOpen: true,
      task: sampleTask(),
    })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Lägg till valda (1)'))

    const confirmButton = wrapper.find('button.bg-\\[\\#2564cf\\]')
    await confirmButton.trigger('click')

    await vi.waitFor(() => expect(wrapper.emitted('close')).toHaveLength(1))
  })

  it('emits close when clicking close button', async () => {
    const breakdownStore = useTaskBreakdownStore()
    vi.spyOn(breakdownStore, 'loadLatest').mockResolvedValue(null)

    const wrapper = mountModal({
      isOpen: true,
      task: sampleTask(),
    })

    const closeBtn = wrapper.find('button[aria-label="Stäng AI-förslag"]')
    await closeBtn.trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('disables confirm when all non-added suggestions are unchecked', async () => {
    const breakdownStore = useTaskBreakdownStore()
    vi.spyOn(breakdownStore, 'loadLatest').mockImplementation(async (taskId: string) => {
      breakdownStore.currentTaskId = taskId
      breakdownStore.latest = {
        ...sampleBreakdown,
        suggestions: [
          { id: 's-1', title: 'Already added', order: 0, status: 'added', stepId: 'step-1' },
          { id: 's-2', title: 'Skippable', order: 1, status: 'available' },
        ],
      }
      return breakdownStore.latest
    })

    const wrapper = mountModal({
      isOpen: true,
      task: sampleTask(),
    })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Föreslagna delsteg'))

    // Wait for initial sync where s-2 is checked
    await vi.waitFor(() => {
      const inputs = wrapper.findAll('input[type="checkbox"]')
      expect(inputs).toHaveLength(2)
      expect((inputs[1].element as HTMLInputElement).checked).toBe(true)
    })

    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    const skippableCheckbox = checkboxes.find(
      (cb) => !(cb.element as HTMLInputElement).disabled,
    )
    expect(skippableCheckbox).toBeTruthy()
    await skippableCheckbox!.trigger('change')

    await vi.waitFor(() => {
      const confirmButton = wrapper.findAll('button').find((btn) => btn.text().includes('Lägg till valda'))
      expect((confirmButton?.element as HTMLButtonElement).disabled).toBe(true)
    })
  })

  it('restores saved extra prompt when reopening with existing breakdown', async () => {
    const breakdownWithPrompt: TaskAiBreakdown = {
      ...sampleBreakdown,
      metadata: { ...sampleBreakdown.metadata, sourcePrompt: 'Fokusera på korta steg' },
    }
    const breakdownStore = useTaskBreakdownStore()
    vi.spyOn(breakdownStore, 'loadLatest').mockImplementation(async (taskId: string) => {
      breakdownStore.currentTaskId = taskId
      breakdownStore.latest = breakdownWithPrompt
      return breakdownWithPrompt
    })

    const wrapper = mountModal({
      isOpen: true,
      task: sampleTask(),
    })
    await vi.waitFor(() => {
      const textarea = wrapper.find('textarea')
      expect((textarea.element as HTMLTextAreaElement).value).toBe('Fokusera på korta steg')
    })
  })

  it('shows network error with retry button', async () => {
    const breakdownStore = useTaskBreakdownStore()
    vi.spyOn(breakdownStore, 'loadLatest').mockImplementation(async () => {
      const err = new TaskBreakdownError('network', 'Ingen internetanslutning.')
      breakdownStore.error = err
      throw err
    })

    const wrapper = mountModal({
      isOpen: true,
      task: sampleTask(),
    })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Nätverksproblem'))

    expect(wrapper.text()).toContain('Ingen internetanslutning.')
    const retryButton = wrapper.findAll('button').find((btn) => btn.text().includes('Försök igen'))
    expect(retryButton).toBeTruthy()
  })

  it('shows configuration error without retry button', async () => {
    const breakdownStore = useTaskBreakdownStore()
    vi.spyOn(breakdownStore, 'loadLatest').mockImplementation(async () => {
      const err = new TaskBreakdownError('configuration', 'AI-tjänsten är inte korrekt konfigurerad.')
      breakdownStore.error = err
      throw err
    })

    const wrapper = mountModal({
      isOpen: true,
      task: sampleTask(),
    })
    await vi.waitFor(() => expect(wrapper.text()).toContain('AI-tjänsten är inte tillgänglig'))

    // Model selector is always visible, but retry is not shown for config errors
    const retryButton = wrapper.findAll('button').find((btn) => btn.text().includes('Försök igen'))
    expect(retryButton).toBeUndefined()
  })

})


