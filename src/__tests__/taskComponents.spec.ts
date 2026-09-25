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
        smartViewCounts: { myDay: 0, important: 0, planned: 0 },
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
        smartViewCounts: { myDay: 0, important: 0, planned: 0 },
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
        smartViewCounts: { myDay: 0, important: 0, planned: 0 },
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
        smartViewCounts: { myDay: 0, important: 0, planned: 0 },
        listTaskCounts: {},
      },
      global: { stubs: { RouterLink: true } },
    })

    await wrapper.get('button[aria-label="Flytta Arbete"]').trigger('click')
    const folderOption = wrapper.findAll('[role="menu"][aria-label="Hantera lista Arbete"] [role="menuitem"]').find((button) => button.text() === 'Projekt')
    await folderOption?.trigger('click')

    expect(wrapper.emitted('move-list')).toEqual([['list-1', 'folder-1']])
  })

  it('closes a list menu on outside click and emits list deletion', async () => {
    const wrapper = mount(TodoSidebar, {
      props: {
        open: true,
        activeListId: 'list-1',
        activeSmartView: null,
        availableTags: [],
        selectedTag: '',
        folders: [],
        ungroupedLists: [{ id: 'list-1', name: 'Arbete', icon: 'list', order: 0, createdAt: Timestamp.now() }],
        smartViewCounts: { myDay: 0, important: 0, planned: 0 },
        listTaskCounts: {},
      },
      global: { stubs: { RouterLink: true } },
    })

    const menuButton = wrapper.get('button[aria-label="Flytta Arbete"]')
    await menuButton.trigger('click')
    expect(wrapper.get('[role="menu"][aria-label="Hantera lista Arbete"]')).toBeTruthy()

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(wrapper.find('[role="menu"][aria-label="Hantera lista Arbete"]').exists()).toBe(false)

    await menuButton.trigger('click')
    await wrapper.get('button[aria-label="Ta bort Arbete"]').trigger('click')
    expect(wrapper.emitted('delete-list')).toEqual([['list-1']])
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
        smartViewCounts: { myDay: 0, important: 0, planned: 0 },
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
        smartViewCounts: { myDay: 0, important: 0, planned: 0 },
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

  it('shows a due date in planned view while keeping the normal list view compact', () => {
    const plannedRow = mount(TaskRow, {
      props: { task: { ...task, dueDate: '2026-09-24' }, showDueDate: true },
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

  it('offers other lists in the task actions menu', async () => {
    const wrapper = mount(TaskRow, {
      props: {
        task,
        availableLists: [
          { id: 'list-1', name: 'Arbete', icon: 'list', order: 0, createdAt: Timestamp.now() },
          { id: 'list-2', name: 'Projekt', icon: 'list', order: 1, createdAt: Timestamp.now() },
        ],
      },
    })

    await wrapper.find('button[aria-label="Uppgiftsåtgärder"]').trigger('click')
    await nextTick()
    const moveButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.includes('Flytta till lista'))
    expect(moveButton).toBeTruthy()
    moveButton?.click()
    await nextTick()

    const targetButton = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find((button) => button.textContent?.includes('Projekt'))
    expect(targetButton).toBeTruthy()
    targetButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(wrapper.emitted('move-to-list')).toEqual([['list-2']])
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

  it('uses alternating backgrounds for detail sections', () => {
    const wrapper = mount(TaskDetailsPanel, { props: { task, steps } })
    const sections = wrapper.findAll('[aria-labelledby]')
    const content = wrapper.find('div.min-h-0')

    expect(content.classes()).toContain('gap-3')
    expect(sections.map((section) => section.attributes('aria-labelledby'))).toEqual([
      'task-details-heading',
      'title-heading',
      'tags-heading',
      'steps-heading',
      'planning-heading',
      'notes-heading',
    ])
    expect(sections[1]?.classes()).toContain('bg-slate-50')
    expect(sections[2]?.classes()).toContain('bg-white')
    expect(sections[3]?.classes()).toContain('bg-slate-50')
    expect(sections[4]?.classes()).toContain('bg-white')
    expect(sections[5]?.classes()).toContain('bg-slate-50')
  })

  it('emits updates for title, steps, My day, due date, notes, and deletion', async () => {
    const wrapper = mount(TaskDetailsPanel, { props: { task, steps } })

    const titleInput = wrapper.find('input[aria-label="Uppgiftens titel"]')
    await titleInput.setValue('Paint the ceiling')
    await titleInput.trigger('blur')
    expect(wrapper.emitted('save-title')).toEqual([['Paint the ceiling']])

    const stepInput = wrapper.find('input[placeholder="Lägg till delsteg"]')
    await stepInput.setValue('Protect floor')
    await wrapper.find('form:has(input[placeholder="Lägg till delsteg"])').trigger('submit')
    expect(wrapper.emitted('add-step')).toEqual([['Protect floor']])

    await wrapper.find('input[type="checkbox"]').trigger('change')
    expect(wrapper.emitted('toggle-step')).toEqual([['step-1']])

    await wrapper.find('button[aria-label="Ta bort delsteg: Buy paint"]').trigger('click')
    expect(wrapper.emitted('delete-step')).toEqual([['step-1']])

    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()

    const myDayButton = wrapper.findAll('button').find((button) => button.text().includes('Lägg till i Min dag'))
    await myDayButton?.trigger('click')
    expect(wrapper.emitted('toggle-my-day')).toHaveLength(1)

    const dateInput = wrapper.find('input[type="date"]')
    await dateInput.setValue('2026-10-01')
    expect(wrapper.emitted('set-due-date')).toEqual([['2026-10-01']])

    const noteInput = wrapper.find('textarea')
    await noteInput.setValue('Use the blue paint.')
    await noteInput.trigger('blur')
    expect(wrapper.emitted('save-note')).toEqual([['Use the blue paint.']])

    const deleteButton = wrapper.findAll('button').find((button) => button.text().includes('Ta bort uppgift'))
    await deleteButton?.trigger('click')
    expect(wrapper.emitted('delete-task')).toHaveLength(1)
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

    await wrapper.find('input[placeholder="Lägg till tagg"]').setValue(' Work ')
    await wrapper.find('form:has(input[placeholder="Lägg till tagg"])').trigger('submit')
    await wrapper.findAll('button').find((button) => button.text() === 'Imorgon')?.trigger('click')

    expect(wrapper.emitted('save-tags')).toEqual([[['work']]])
    expect(wrapper.emitted('set-due-date')?.[0]?.[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('emits a due time and reminder offset', async () => {
    const wrapper = mount(TaskDetailsPanel, {
      props: { task: { ...task, dueDate: '2026-10-01' }, steps },
    })

    await wrapper.get('input[aria-label="Uppgiftens förfallotid"]').setValue('14:30')
    await wrapper.get('select[aria-label="Påminnelse"]').setValue('60')

    expect(wrapper.emitted('set-due-date')).toEqual([['2026-10-01T14:30']])
    expect(wrapper.emitted('save-reminder')).toEqual([[{ offsetMinutes: 60 }]])
  })

})
