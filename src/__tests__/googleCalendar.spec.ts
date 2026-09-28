import { describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import type { Task } from '@/types'
import { createGoogleCalendarUrl } from '@/utils/googleCalendar'

const makeTask = (overrides: Partial<Task> = {}): Pick<Task, 'title' | 'note' | 'dueDate'> => ({
  title: 'Planera release',
  note: 'Gå igenom checklistan',
  ...overrides,
})

const paramsFor = (url: string) => new URL(url).searchParams

describe('createGoogleCalendarUrl', () => {
  it('creates an all-day event from a date-only due date', () => {
    const params = paramsFor(createGoogleCalendarUrl(makeTask({ dueDate: '2026-10-01' })))

    expect(params.get('action')).toBe('TEMPLATE')
    expect(params.get('text')).toBe('Planera release')
    expect(params.get('details')).toBe('Gå igenom checklistan')
    expect(params.get('dates')).toBe('20261001/20261002')
    expect(params.has('ctz')).toBe(false)
  })

  it('creates a one-hour event for a due date with a time', () => {
    const params = paramsFor(createGoogleCalendarUrl(makeTask({ dueDate: '2026-10-01T14:30' })))

    expect(params.get('dates')).toBe('20261001T143000/20261001T153000')
    expect(params.get('ctz')).toBeTruthy()
  })

  it('uses a Firestore timestamp as an all-day date when it is at midnight', () => {
    const dueDate = Timestamp.fromDate(new Date(2026, 9, 1))
    const params = paramsFor(createGoogleCalendarUrl(makeTask({ dueDate })))

    expect(params.get('dates')).toBe('20261001/20261002')
  })

  it('leaves the calendar date unset when the task has no valid due date', () => {
    const params = paramsFor(createGoogleCalendarUrl(makeTask({ dueDate: 'not-a-date', note: '  ' })))

    expect(params.has('dates')).toBe(false)
    expect(params.has('details')).toBe(false)
  })
})
