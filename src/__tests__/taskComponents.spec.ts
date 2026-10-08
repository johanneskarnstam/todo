import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { Timestamp } from 'firebase/firestore'
import TaskDetailsPanel from '@/components/TaskDetailsPanel.vue'
import TaskRow from '@/components/TaskRow.vue'
import TodoSidebar from '@/components/TodoSidebar.vue'
import type { Step, Task } from '@/types'

vi.mock('@/firebase', () => ({
  auth: { currentUser: { uid: 'test-user' } },
  db: {},
}))

const task: Task = {
  id: 'task-1',
  listId: 'list-1',
  title: 'Paint the wall',
  completed: false,
  important: false,
  myDay: false,
  createdAt: Timestamp.now(),
}

describe('TodoSidebar', () => {
  it('opens the tag menu and emits the selected tag', async () => {
    const wrapper = mount(TodoSidebar, {
      props: {
        open: true,
        activeListId: null,
        activeSmartView: null,
        availableTags: ['hem', 'jobb'],
        selectedTag: '',
        folders: [],
        ungroupedLists: [],
        smartViewCounts: { myDay: 0, important: 0, planned: 0, archived: 0 },
        listTaskCounts: {},
      },
      global: { stubs: { RouterLink: true } },
    })

    const tagsButton = wrapper.get('button[aria-controls="sidebar-tags-menu"]')
    expect(tagsButton.attributes('aria-expanded')).toBe('false')

    await tagsButton.trigger('click')

    expect(tagsButton.attributes('aria-expanded')).toBe('true')
    expect(wrapper.findAll('#sidebar-tags-menu [role="menuitem"]').map((button) => button.text())).toEqual(['Alla taggar', '#hem', '#jobb'])

    await wrapper.get('#sidebar-tags-menu button[role="menuitem"]:nth-child(3)').trigger('click')

    expect(wrapper.emitted('select-tag')).toEqual([['jobb']])
    expect(tagsButton.attributes('aria-expanded')).toBe('false')
  })

  it('creates lists and folders from the sidebar forms', async () => {
    const wrapper = mount(TodoSidebar, {
      props: {
        open: true,
        activeListId: null,
        activeSmartView: null,
        availableTags: [],
        selectedTag: '',
        folders: [],
        ungroupedLists: [],
        smartViewCounts: { myDay: 0, important: 0, planned: 0, archived: 0 },
        listTaskCounts: {},
      },
      global: { stubs: { RouterLink: true } },
    })

    const addListButton = wrapper.findAll('button').find((button) => button.text().includes('Ny lista'))
    await addListButton?.trigger('click')
    await wrapper.get('input[placeholder="Listnamn"]').setValue('  Weekend  ')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('create-list')).toEqual([['Weekend']])

    const addFolderButton = wrapper.findAll('button').find((button) => button.text().includes('Ny mapp'))
    await addFolderButton?.trigger('click')
    await wrapper.get('input[placeholder="Mappnamn"]').setValue('  Resor  ')
    const folderForm = wrapper.findAll('form').find((form) => form.find('input[placeholder="Mappnamn"]').exists())
    await folderForm?.trigger('submit')
    expect(wrapper.emitted('create-folder')).toEqual([['Resor']])
  })

  it('emits create-list with folderId when creating a list inside a folder', async () => {
    const wrapper = mount(TodoSidebar, {
      props: {
        open: true,
        activeListId: null,
        activeSmartView: null,
        availableTags: [],
        selectedTag: '',
        folders: [{ folder: { id: 'folder-1', name: 'Projekt', order: 0 }, lists: [] }],
        ungroupedLists: [],
        smartViewCounts: { myDay: 0, important: 0, planned: 0, archived: 0 },
        listTaskCounts: {},
      },
      global: { stubs: { RouterLink: true } },
    })

    const addListButton = wrapper.get('button[data-folder-add-list="folder-1"]')
    await addListButton.trigger('click')

    const input = wrapper.get('input[id="new-list-name-folder-1"]')
    await input.setValue('Nytt projekt')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('create-list')).toEqual([['Nytt projekt', 'folder-1']])
  })

  it('emits the selected folder when moving a list', async () => {
    const wrapper = mount(TodoSidebar, {
      props: {
        open: true,
        activeListId: 'list-1',
        activeSmartView: null,
        availableTags: [],
        selectedTag: '',
        folders: [{ folder: { id: 'folder-1', name: 'Projekt', order: 0 }, lists: [] }],
        ungroupedLists: [{ id: 'list-1', name: 'Arbete', icon: 'list', order: 0, createdAt: Timestamp.now() }],
        smartViewCounts: { myDay: 0, important: 0, planned: 0, archived: 0 },
        listTaskCounts: {},
      },
      global: { stubs: { RouterLink: true } },
    })

    await wrapper.get('button[aria-label="Flytta Arbete"]').trigger('click')
    const folderOption = wrapper.findAll('[role="menu"][aria-label="Hantera lista Arbete"] [role="menuitem"]').find((button) => button.text() === 'Projekt')
    await folderOption?.trigger('click')

    expect(wrapper.emitted('move-list')).toEqual([['list-1', 'folder-1']])
  })

  it('opens folder options with right-click and touch long-press', async () => {
    vi.useFakeTimers()
    const wrapper = mount(TodoSidebar, {
      props: {
        open: true,
        activeListId: null,
        activeSmartView: null,
        availableTags: [],
        selectedTag: '',
        folders: [{
          folder: { id: 'folder-1', name: 'Projekt', order: 0 },
          lists: [],
        }],
        ungroupedLists: [],
        smartViewCounts: { myDay: 0, important: 0, planned: 0, archived: 0 },
        listTaskCounts: {},
      },
      global: { stubs: { RouterLink: true } },
    })

    const folderButton = wrapper.findAll('button').find((button) => button.text().includes('Projekt'))
    const folderHeader = wrapper.get('[data-folder-header]')
    expect(folderButton).toBeTruthy()
    await folderHeader.trigger('contextmenu')
    expect(wrapper.get('button[aria-label="Byt namn på mapp"]')).toBeTruthy()

    await folderHeader.trigger('pointerdown', { pointerType: 'touch' })
    vi.advanceTimersByTime(500)
    await nextTick()
    expect(wrapper.get('button[aria-label="Byt namn på mapp"]')).toBeTruthy()

    vi.useRealTimers()
    wrapper.unmount()
  })

  it('groups the default and ungrouped lists under dedicated headings', async () => {
    const wrapper = mount(TodoSidebar, {
      props: {
        open: true,
        activeListId: 'project-list',
        activeSmartView: null,
        availableTags: [],
        selectedTag: '',
        folders: [{
          folder: { id: 'folder-1', name: 'Semesteridéer', order: 0 },
          lists: [{ id: 'bali-list', name: 'Bali', folderId: 'folder-1', icon: 'list', order: 0, createdAt: Timestamp.now() }],
        }],
        ungroupedLists: [
          { id: '__default__', name: 'Att göra', icon: 'list', order: 0, createdAt: Timestamp.now() },
          { id: 'project-list', name: 'Projekt', icon: 'list', order: 1, createdAt: Timestamp.now() },
        ],
        smartViewCounts: { myDay: 0, important: 0, planned: 0, archived: 0 },
        listTaskCounts: { 'project-list': 1 },
      },
      global: { stubs: { RouterLink: true } },
    })

    expect(wrapper.text()).toContain('Huvudlista')
    expect(wrapper.text()).toContain('Att göra')
    expect(wrapper.text()).toContain('Utan mapp')
    expect(wrapper.text()).toContain('Projekt')
    expect(wrapper.text()).toContain('Semesteridéer')
    expect(wrapper.text()).toContain('Bali')

    const ungroupedHeading = wrapper.findAll('button').find((button) => button.text().includes('Utan mapp'))
    expect(ungroupedHeading).toBeTruthy()
    await ungroupedHeading?.trigger('click')
    expect(wrapper.text()).not.toContain('Projekt')
    expect(wrapper.text()).toContain('Att göra')
    expect(wrapper.text()).toContain('Bali')
  })
})

describe('TaskRow', () => {
  it('emits the selected priority from the task actions menu', async () => {
    const wrapper = mount(TaskRow, { props: { task } })

    await wrapper.get('button[aria-label="Uppgiftsåtgärder"]').trigger('click')
    await nextTick()
    const prioritySelect = document.body.querySelector('select[aria-label="Prioritet för Paint the wall"]')
    expect(prioritySelect).toBeTruthy()
    if (!(prioritySelect instanceof HTMLSelectElement)) throw new Error('Priority selector was not rendered')

    prioritySelect.value = 'urgent'
    prioritySelect.dispatchEvent(new Event('change', { bubbles: true }))

    expect(wrapper.emitted('set-priority')).toEqual([['urgent']])
  })

  it('opens details from the row and keeps inline controls independent', async () => {
    const wrapper = mount(TaskRow, { props: { task } })

    await wrapper.find('article').trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(1)
    await wrapper.find('button[aria-label="Markera uppgift som slutförd"]').trigger('click')
    expect(wrapper.emitted('toggle-completed')).toHaveLength(1)
    expect(wrapper.emitted('select')).toHaveLength(1)

    await wrapper.find('button[aria-label="Uppgiftsåtgärder"]').trigger('click')
    await nextTick()
    const starButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Stjärnmarkera')
    expect(starButton).toBeTruthy()
    starButton?.click()
    expect(wrapper.emitted('toggle-important')).toHaveLength(1)
    expect(wrapper.emitted('select')).toHaveLength(1)

    await wrapper.find('button[aria-label="Uppgiftsåtgärder"]').trigger('click')
    await nextTick()
    const myDayButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Lägg till i Min dag')
    expect(myDayButton).toBeTruthy()
    myDayButton?.click()
    expect(wrapper.emitted('toggle-my-day')).toHaveLength(1)
  })

  it('shows tags and task metadata below the title while keeping row actions separate', () => {
    // Use today as dueDate so reminderDateText returns time-only (same-day display)
    const today = new Date()
    today.setHours(9, 0, 0, 0)
    const todayStr = today.toISOString().slice(0, 10)
    const reminderDate = new Date(today.getTime() - 10 * 60_000)
    const reminderTime = reminderDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })

    const wrapper = mount(TaskRow, {
      props: {
        task: {
          ...task,
          important: true,
          myDay: true,
          reminders: [{ mode: 'relative' as const, offsetMinutes: 10 }],
          dueDate: `${todayStr}T09:00`,
          tags: ['jobb'],
          note: 'Use the blue paint.',
        },
      },
    })
    const metadata = wrapper.find('[aria-label="Taggar och uppgiftsmarkeringar"]')

    expect(metadata.exists()).toBe(true)
    expect(metadata.find('button[aria-label="Visa uppgifter med taggen #jobb"]').exists()).toBe(true)
    expect(metadata.text()).toContain('Stjärnmärkt')
    expect(metadata.text()).toContain('Min dag')
    expect(metadata.find('[aria-label="Anteckning finns"]').exists()).toBe(true)
    expect(metadata.text()).toContain(`Påminnelse ${reminderTime}`)
    expect(wrapper.find('[aria-label^="Påminnelse:"]').findAll('span')[0]?.text()).toBe(reminderTime)
    expect(wrapper.find('[aria-label="Stjärnmärkt"] svg').attributes('fill')).toBe('none')
    expect(wrapper.find('[aria-label^="Förfallodatum:"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label^="Påminnelse:"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Uppgiftsåtgärder"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Uppgiftsmarkeringar"]').exists()).toBe(false)
  })

  it('does not show note metadata for a blank note', () => {
    const wrapper = mount(TaskRow, { props: { task: { ...task, note: '   ' } } })

    expect(wrapper.find('[aria-label="Taggar och uppgiftsmarkeringar"]').exists()).toBe(false)
  })

  it('keeps the date when a reminder falls on a different day than the due date', () => {
    const wrapper = mount(TaskRow, {
      props: {
        task: {
          ...task,
          reminders: [{ mode: 'relative' as const, offsetMinutes: 1440 }],
          dueDate: '2026-09-24',
        },
      },
    })
    const reminderDate = new Date('2026-09-23T09:00:00').toLocaleDateString('sv-SE', {
      day: 'numeric',
      month: 'short',
    }).replace('.', '')
    const reminderTime = new Date('2026-09-23T09:00:00').toLocaleTimeString('sv-SE', {
      hour: '2-digit',
      minute: '2-digit',
    })

    expect(wrapper.find('[aria-label^="Påminnelse:"]').findAll('span')[0]?.text()).toBe(`${reminderDate} ${reminderTime}`)
  })

  it('shows a due date in planned view while keeping the normal list view compact', () => {
    const plannedRow = mount(TaskRow, {
      props: { task: { ...task, dueDate: '2026-09-24T14:30' }, showDueDate: true },
    })
    const expectedDate = new Date('2026-09-24T00:00:00').toLocaleDateString('sv-SE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })

    expect(plannedRow.text()).toContain(expectedDate)

    const standardRow = mount(TaskRow, { props: { task } })
    expect(standardRow.text()).not.toContain(expectedDate)
  })

  it('shows a subtask count only when steps exist', () => {
    const withSteps = mount(TaskRow, {
      props: { task, stepCount: { completed: 2, total: 3 } },
    })
    expect(withSteps.text()).toContain('(2/3)')
    expect(withSteps.find('[aria-label="2 av 3 delsteg klara"]').exists()).toBe(true)

    const withoutSteps = mount(TaskRow, { props: { task } })
    expect(withoutSteps.text()).not.toContain('(/')
  })

  it('uses dark text for active tasks and muted text for completed tasks', () => {
    const activeWrapper = mount(TaskRow, { props: { task } })
    const completedWrapper = mount(TaskRow, { props: { task: { ...task, completed: true } } })

    expect(activeWrapper.find('span.min-w-0.flex-1').classes()).toContain('text-black')
    expect(completedWrapper.find('span.min-w-0.flex-1').classes()).toContain('text-slate-400')
    expect(completedWrapper.find('span.min-w-0.flex-1').classes()).toContain('line-through')
  })

  it('toggles completion with Space and opens details with Enter', async () => {
    const wrapper = mount(TaskRow, { props: { task } })
    const row = wrapper.find('article')

    await row.trigger('keydown', { key: ' ' })
    await row.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('toggle-completed')).toHaveLength(1)
    expect(wrapper.emitted('select')).toHaveLength(1)
  })

  it('offers every task action from the vertical actions menu', async () => {
    const wrapper = mount(TaskRow, { props: { task } })
    const openMenu = () => wrapper.find('button[aria-label="Uppgiftsåtgärder"]').trigger('click')

    await openMenu()
    await nextTick()
    const detailsButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Visa detaljer')
    expect(detailsButton).toBeTruthy()
    detailsButton?.click()
    expect(wrapper.emitted('select')).toHaveLength(1)

    await openMenu()
    await nextTick()
    const completeButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Markera som slutförd')
    expect(completeButton).toBeTruthy()
    completeButton?.click()
    expect(wrapper.emitted('toggle-completed')).toHaveLength(1)
  })

  it('keeps swipe and dropdown interaction exclusive to one row', async () => {
    document.querySelectorAll('[data-task-menu-id]').forEach((menu) => menu.remove())
    const secondTask = { ...task, id: 'task-2', title: 'Paint the ceiling' }
    const firstWrapper = mount(TaskRow, { props: { task }, attachTo: document.body })
    const secondWrapper = mount(TaskRow, { props: { task: secondTask }, attachTo: document.body })

    await firstWrapper.find('button[aria-label="Uppgiftsåtgärder"]').trigger('click')
    await nextTick()
    expect(document.body.querySelector('[data-task-menu-id="task-1"]')).toBeTruthy()

    const startSecondTouch = new Event('touchstart', { bubbles: true })
    Object.defineProperty(startSecondTouch, 'touches', { value: [{ clientX: 100 }] })
    secondWrapper.element.dispatchEvent(startSecondTouch)
    await nextTick()
    expect(document.body.querySelector('[data-task-menu-id="task-1"]')).toBeNull()

    await firstWrapper.find('article').trigger('touchstart', { touches: [{ clientX: 100 }] })
    await firstWrapper.find('article').trigger('touchmove', { touches: [{ clientX: 20 }] })
    await firstWrapper.find('article').trigger('touchend')
    expect(firstWrapper.find('div.relative.flex').attributes('style')).toContain('translateX(-96px)')

    await secondWrapper.find('article').trigger('touchstart', { touches: [{ clientX: 100 }] })
    expect(firstWrapper.find('div.relative.flex').attributes('style')).toContain('translateX(0px)')

    firstWrapper.unmount()
    secondWrapper.unmount()
  })
})

describe('TaskDetailsPanel', () => {
  const steps: Step[] = [
    {
      id: 'step-1',
      taskId: 'task-1',
      title: 'Buy paint',
      completed: false,
      createdAt: Timestamp.now(),
    },
  ]

  it('uses consistent backgrounds for detail sections', () => {
    const wrapper = mount(TaskDetailsPanel, { props: { task, steps } })
    const sections = wrapper.findAll('[aria-labelledby]')
    const content = wrapper.find('div.min-h-0')

    expect(content.classes()).toContain('gap-3')
    expect(sections.map((section) => section.attributes('aria-labelledby'))).toEqual([
      'task-details-heading',
      'title-heading',
      'priority-heading',
      'tags-heading',
      'steps-heading',
      'planning-heading',
      'linked-tasks-heading',
      'notes-heading',
      'external-link-heading',
    ])
    expect(sections[1]?.classes()).toContain('bg-white')
    expect(sections[3]?.classes()).toContain('bg-white')
    expect(sections[4]?.classes()).toContain('bg-white')
    expect(sections[5]?.classes()).toContain('bg-white')
    expect(sections[6]?.classes()).toContain('bg-white')
    expect(sections[7]?.classes()).toContain('bg-white')
    expect(sections[8]?.classes()).toContain('bg-white')
  })

  it('searches tasks across lists and emits a symmetric link request', async () => {
    const candidate: Task = { ...task, id: 'task-2', listId: 'list-2', title: 'Review roadmap' }
    const wrapper = mount(TaskDetailsPanel, {
      props: {
        task,
        steps,
        availableTasks: [task, candidate, { ...candidate, id: 'task-3', title: 'Write report' }],
        availableLists: [
          { id: 'list-1', name: 'Home', icon: 'house', order: 0, createdAt: Timestamp.now() },
          { id: 'list-2', name: 'Work', icon: 'briefcase', order: 1, createdAt: Timestamp.now() },
        ],
      },
    })

    const linkButton = wrapper.findAll('button').find((button) => button.text().includes('Länka uppgift'))
    await linkButton?.trigger('click')
    await wrapper.get('[aria-labelledby="link-task-dialog-title"] input[type="search"]').setValue('road')

    const dialog = wrapper.get('[role="dialog"][aria-labelledby="link-task-dialog-title"]')
    expect(dialog.text()).toContain('Review roadmap')
    expect(dialog.text()).toContain('Work')
    expect(dialog.text()).not.toContain('Write report')
    await dialog.get('button[aria-label="Länka Review roadmap från Work"]').trigger('click')

    expect(wrapper.emitted('link-task')).toEqual([['task-2']])
    expect(wrapper.find('[role="dialog"][aria-labelledby="link-task-dialog-title"]').exists()).toBe(false)
  })

  it('adds multiple external URLs, truncates their display, and removes a saved URL', async () => {
    const linkedTask: Task = { ...task, id: 'task-2', title: 'Review roadmap' }
    const wrapper = mount(TaskDetailsPanel, {
      props: {
        task: { ...task, relatedTaskIds: [linkedTask.id] },
        steps,
        availableTasks: [task, linkedTask],
      },
    })

    expect(wrapper.get('[aria-labelledby="linked-tasks-heading"]').text()).toContain('Review roadmap')
    await wrapper.get('[aria-label="Ta bort länk till: Review roadmap"]').trigger('click')
    expect(wrapper.emitted('unlink-task')).toEqual([['task-2']])

    const firstUrl = 'https://www.tv4play.se/program/dea76dc5c339432e5796/robinson'
    const secondUrl = 'https://example.com/project'
    const urlInput = wrapper.get('#task-external-url')
    await urlInput.setValue(firstUrl)
    await wrapper.get('form:has(#task-external-url)').trigger('submit')
    expect(wrapper.emitted('save-external-urls')).toEqual([[[new URL(firstUrl).href]]])
    await wrapper.setProps({ task: { ...task, externalUrls: [firstUrl] } })
    expect(wrapper.get(`a[title="${firstUrl}"] span.truncate`).text()).toBe('https://www.tv4play.se/prog...')

    await urlInput.setValue(secondUrl)
    await wrapper.get('form:has(#task-external-url)').trigger('submit')
    expect(wrapper.emitted('save-external-urls')?.[1]).toEqual([[new URL(firstUrl).href, new URL(secondUrl).href]])
    expect(wrapper.get(`a[href="${firstUrl}"]`).attributes('rel')).toBe('noopener noreferrer')
    const normalizedFirstUrl = new URL(firstUrl).href
    await wrapper.setProps({ task: { ...task, externalUrls: [normalizedFirstUrl, new URL(secondUrl).href] } })
    await wrapper.get(`[aria-label="Ta bort extern länk: ${normalizedFirstUrl}"]`).trigger('click')
    expect(wrapper.emitted('save-external-urls')?.[2]).toEqual([[new URL(secondUrl).href]])
  })

  it('shows legacy single external URLs until they are changed', () => {
    const url = 'https://www.tv4play.se/program/robinson'
    const wrapper = mount(TaskDetailsPanel, { props: { task: { ...task, externalUrl: url }, steps } })

    expect(wrapper.get(`a[title="${url}"]`).attributes('href')).toBe(url)
  })

  it('keeps the step preparation and import section collapsed by default', () => {
    const wrapper = mount(TaskDetailsPanel, { props: { task, steps } })

    expect(wrapper.get('#step-tools-toggle').attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('#step-tools-panel').exists()).toBe(false)
  })

  it('copies only title, note, and expected response format in task context', async () => {
    const wrapper = mount(TaskDetailsPanel, { props: { task: { ...task, note: 'Keep this note' }, steps } })
    await wrapper.get('#step-tools-toggle').trigger('click')

    const contextValue = (wrapper.get('[aria-label="Uppgiftskontext"]').element as HTMLTextAreaElement).value
    const [instructions, contextJson] = contextValue.split('\n\n')
    expect(instructions).toBe([
      'Skapa konkreta delsteg för uppgiften nedan. Använd anteckningen som stöd och formulera varje steg som en tydlig åtgärd. Låt mig kunna kopiera ut resultaten direkt. Skriv endast JSON, inga förklaringar eller kommentarer.',
      'Förväntat svarsformat är JSON. Returnera endast giltig JSON enligt noden expectedResponseFormat. Inget annat får returneras.',
    ].join('\n'))
    const context = JSON.parse(contextJson ?? '') as Record<string, unknown>
    expect(context).toEqual({
      title: task.title,
      note: 'Keep this note',
      expectedResponseFormat: { steps: ['Delsteg 1', 'Delsteg 2'] },
    })
  })

  it('imports JSON subtasks for the current task in the requested order', async () => {
    const wrapper = mount(TaskDetailsPanel, { props: { task, steps } })
    await wrapper.get('#step-tools-toggle').trigger('click')
    await wrapper.get('[aria-label="JSON för delsteg"]').setValue(JSON.stringify({
      steps: ['First step', 'Second step'],
    }))
    const importButton = wrapper.get('#step-tools-panel').findAll('button').find((button) => button.text().includes('Importera delsteg'))
    expect(importButton).toBeTruthy()
    await importButton?.trigger('click')

    expect(wrapper.emitted('add-step')).toEqual([['Second step'], ['First step']])
    expect(wrapper.get('#step-tools-panel').get('[role="status"]').text()).toContain('2 delsteg importerade.')
  })

  it('emits the selected priority from task details', async () => {
    const wrapper = mount(TaskDetailsPanel, { props: { task, steps } })

    await wrapper.get('select[aria-label="Uppgiftens prioritet"]').setValue('low')

    expect(wrapper.emitted('set-priority')).toEqual([['low']])
  })

  it('emits updates for title, steps, My day, notes, and deletion', async () => {
    const wrapper = mount(TaskDetailsPanel, { props: { task, steps } })
    await wrapper.get('button[aria-label="Kopiera uppgiftslänk"]').trigger('click')
    expect(wrapper.emitted('copy-link')).toHaveLength(1)

    const titleInput = wrapper.find('input[aria-label="Uppgiftens titel"]')
    await titleInput.setValue('Paint the ceiling')
    await titleInput.trigger('blur')
    expect(wrapper.emitted('save-title')).toEqual([['Paint the ceiling']])

    const stepInput = wrapper.find('input[placeholder="Lägg till delsteg"]')
    await stepInput.setValue('Protect floor')
    await wrapper.find('form:has(input[placeholder="Lägg till delsteg"])').trigger('submit')
    expect(wrapper.emitted('add-step')).toEqual([['Protect floor']])

    await wrapper.get('[role="checkbox"][aria-label="Markera delsteg som klart: Buy paint"]').trigger('click')
    expect(wrapper.emitted('toggle-step')).toEqual([['step-1']])
    await wrapper.get('[role="dialog"][aria-labelledby="confirm-dialog-title"] button').trigger('click')

    await wrapper.find('button[aria-label="Ta bort delsteg: Buy paint"]').trigger('click')
    expect(wrapper.emitted('delete-step')).toEqual([['step-1']])

    await wrapper.get('button[aria-label="Stäng uppgiftsdetaljer"]').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()

    const myDayButton = wrapper.findAll('button').find((button) => button.text().includes('Lägg till i Min dag'))
    await myDayButton?.trigger('click')
    expect(wrapper.emitted('toggle-my-day')).toHaveLength(1)

    const noteInput = wrapper.find('textarea')
    await noteInput.setValue('Use the blue paint.')
    await noteInput.trigger('blur')
    expect(wrapper.emitted('save-note')).toEqual([['Use the blue paint.']])

    const deleteButton = wrapper.findAll('button').find((button) => button.text().includes('Ta bort uppgift'))
    await deleteButton?.trigger('click')
    expect(wrapper.emitted('delete-task')).toHaveLength(1)
  })

  it('asks before completing the parent task after the final step is checked', async () => {
    const wrapper = mount(TaskDetailsPanel, { props: { task, steps } })

    await wrapper.get('[role="checkbox"][aria-label="Markera delsteg som klart: Buy paint"]').trigger('click')

    const confirmation = wrapper.get('[role="dialog"][aria-labelledby="confirm-dialog-title"]')
    expect(confirmation.text()).toContain('Alla deluppgifter är klara. Vill du markera huvuduppgiften som slutförd?')
    expect(wrapper.emitted('toggle-step')).toEqual([['step-1']])
    await confirmation.get('button:nth-of-type(2)').trigger('click')
    expect(wrapper.emitted('toggle-task-completed')).toHaveLength(1)
  })

  it('does not complete the parent task when the user declines', async () => {
    const wrapper = mount(TaskDetailsPanel, { props: { task, steps } })

    await wrapper.get('[role="checkbox"][aria-label="Markera delsteg som klart: Buy paint"]').trigger('click')

    expect(wrapper.emitted('toggle-step')).toEqual([['step-1']])
    const confirmation = wrapper.get('[role="dialog"][aria-labelledby="confirm-dialog-title"]')
    await confirmation.get('button').trigger('click')
    expect(wrapper.emitted('toggle-task-completed')).toBeUndefined()
  })

  it('keeps the subtask section expanded without a collapse control', () => {
    const wrapper = mount(TaskDetailsPanel, { props: { task, steps } })

    expect(wrapper.get('#steps-heading').element.tagName).toBe('H2')
    expect(wrapper.find('[role="checkbox"][aria-label="Markera delsteg som klart: Buy paint"]').exists()).toBe(true)
  })

  it('makes a subtask title editable when its text is clicked', async () => {
    const wrapper = mount(TaskDetailsPanel, { props: { task, steps } })

    const stepButton = wrapper.findAll('button').find((button) => button.text() === 'Buy paint')
    await stepButton?.trigger('click')
    const editInput = wrapper.find('input[aria-label="Redigera delsteg: Buy paint"]')
    await editInput.setValue('Buy green paint')
    await editInput.trigger('keydown.enter')

    expect(wrapper.emitted('save-step-title')).toEqual([['step-1', 'Buy green paint']])
  })

  it('refreshes editable fields when the active task changes', async () => {
    const wrapper = mount(TaskDetailsPanel, { props: { task, steps } })

    await wrapper.setProps({ task: { ...task, id: 'task-2', title: 'New task', note: 'New note' } })

    expect((wrapper.get('input[aria-label="Uppgiftens titel"]').element as HTMLInputElement).value).toBe('New task')
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('New note')
  })

  it('adds tags and emits quick due-date changes', async () => {
    const wrapper = mount(TaskDetailsPanel, { props: { task, steps } })

    await wrapper.find('input[placeholder="Lägg till tagg"]').setValue(' Work Tag ')
    await wrapper.find('form:has(input[placeholder="Lägg till tagg"])').trigger('submit')
    await wrapper.findAll('button').find((button) => button.text() === 'Imorgon')?.trigger('click')

    expect(wrapper.emitted('save-tags')).toEqual([[['work-tag']]])
    expect(wrapper.emitted('set-due-date')?.[0]?.[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('suggests matching existing tags as the user types', async () => {
    const wrapper = mount(TaskDetailsPanel, {
      props: {
        task: { ...task, tags: ['home'] },
        steps,
        availableTags: ['lägenhet', 'läget', 'home'],
      },
    })
    const tagInput = wrapper.get('input[placeholder="Lägg till tagg"]')

    await tagInput.setValue('LÄG')
    expect(wrapper.findAll('[aria-label="Taggförslag"] button').map((button) => button.text())).toEqual(['#lägenhet', '#läget'])

    await wrapper.get('button[aria-label="Lägg till befintlig tagg #lägenhet"]').trigger('click')

    expect(wrapper.emitted('save-tags')).toEqual([[['home', 'lägenhet']]])
  })

  it('adds a reminder via ReminderEditor and emits save-reminders', async () => {
    const wrapper = mount(TaskDetailsPanel, {
      props: { task: { ...task, dueDate: '2026-10-01' }, steps },
    })

    // Click "Lägg till påminnelse"
    const addBtn = wrapper.findAll('button').find((btn) => btn.text().includes('Lägg till påminnelse'))
    expect(addBtn).toBeDefined()
    await addBtn!.trigger('click')

    // ReminderEditor should now be visible (relative mode since dueDate exists)
    expect(wrapper.find('[data-testid="reminder-editor"]').exists()).toBe(true)

    // Select offset 60 minutes
    await wrapper.find('#relative-reminder-offset').setValue('60')
    const saveBtn = wrapper.findAll('button').find((btn) => btn.text().includes('Spara påminnelse'))
    await saveBtn!.trigger('click')

    expect(wrapper.emitted('save-reminders')).toEqual([[[{ mode: 'relative', offsetMinutes: 60 }]]])
  })

  it('emits a selected due date from the native date input', async () => {
    const wrapper = mount(TaskDetailsPanel, { props: { task, steps } })

    const dateInput = wrapper.get('input[aria-label="Uppgiftens förfallodatum"]')
    expect(dateInput.attributes('type')).toBe('date')
    await dateInput.setValue('2026-10-01')

    expect(wrapper.emitted('set-due-date')).toEqual([['2026-10-01']])
  })

  it('renders a task due time and emits changes with its due date', async () => {
    const wrapper = mount(TaskDetailsPanel, {
      props: { task: { ...task, dueDate: '2026-10-01T09:15' }, steps },
    })
    const dateInput = wrapper.get('input[aria-label="Uppgiftens förfallodatum"]')
    const timeInput = wrapper.get('input[aria-label="Uppgiftens förfallotid"]')

    expect((dateInput.element as HTMLInputElement).value).toBe('2026-10-01')
    expect((timeInput.element as HTMLInputElement).value).toBe('09:15')
    expect((timeInput.element as HTMLInputElement).disabled).toBe(false)
    await timeInput.setValue('14:30')

    expect(wrapper.emitted('set-due-date')).toEqual([['2026-10-01T14:30']])
  })

  it('triggers showPicker on native date input when clicked', async () => {
    const wrapper = mount(TaskDetailsPanel, { props: { task, steps } })
    const dateInput = wrapper.get('input[aria-label="Uppgiftens förfallodatum"]')
    const showPickerSpy = vi.fn()
    ;(dateInput.element as HTMLInputElement).showPicker = showPickerSpy

    await dateInput.trigger('click')
    expect(showPickerSpy).toHaveBeenCalledOnce()
  })

  it('triggers showPicker on native time input when clicked if due date exists', async () => {
    const wrapper = mount(TaskDetailsPanel, {
      props: { task: { ...task, dueDate: '2026-10-01' }, steps },
    })
    const timeInput = wrapper.get('input[aria-label="Uppgiftens förfallotid"]')
    const showPickerSpy = vi.fn()
    ;(timeInput.element as HTMLInputElement).showPicker = showPickerSpy

    await timeInput.trigger('click')
    expect(showPickerSpy).toHaveBeenCalledOnce()
  })

  it('does not trigger showPicker on time input when clicked if due date is missing', async () => {
    const wrapper = mount(TaskDetailsPanel, {
      props: { task: { ...task, dueDate: '' }, steps },
    })
    const timeInput = wrapper.get('input[aria-label="Uppgiftens förfallotid"]')
    const showPickerSpy = vi.fn()
    ;(timeInput.element as HTMLInputElement).showPicker = showPickerSpy

    await timeInput.trigger('click')
    expect(showPickerSpy).not.toHaveBeenCalled()
  })
})
