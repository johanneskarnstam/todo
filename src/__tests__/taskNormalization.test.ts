import { describe, expect, it } from 'vitest'
import { normalizeSingleReminder, normalizeTask, normalizeTaskReminders } from '@/utils/taskNormalization'

describe('taskNormalization', () => {
  describe('normalizeSingleReminder', () => {
    it('normalizes valid absolute reminder', () => {
      const result = normalizeSingleReminder({
        mode: 'absolute',
        at: '2026-10-15T09:00',
        timeZone: 'Europe/Stockholm',
      })
      expect(result).toEqual({
        mode: 'absolute',
        at: '2026-10-15T09:00',
        timeZone: 'Europe/Stockholm',
      })
    })

    it('rejects absolute reminder with missing fields', () => {
      expect(normalizeSingleReminder({ mode: 'absolute', at: '' })).toBeNull()
      expect(normalizeSingleReminder({ mode: 'absolute', at: '2026-10-15T09:00' })).toBeNull()
      expect(normalizeSingleReminder({ mode: 'absolute', timeZone: 'Europe/Stockholm' })).toBeNull()
    })

    it('normalizes valid relative reminder', () => {
      const result = normalizeSingleReminder({
        mode: 'relative',
        offsetMinutes: 10,
      })
      expect(result).toEqual({
        mode: 'relative',
        offsetMinutes: 10,
      })
    })

    it('normalizes legacy reminder object without mode', () => {
      const result = normalizeSingleReminder({
        offsetMinutes: 60,
      })
      expect(result).toEqual({
        mode: 'relative',
        offsetMinutes: 60,
      })
    })

    it('rejects invalid or non-object values', () => {
      expect(normalizeSingleReminder(null)).toBeNull()
      expect(normalizeSingleReminder('invalid')).toBeNull()
      expect(normalizeSingleReminder(123)).toBeNull()
      expect(normalizeSingleReminder({})).toBeNull()
      expect(normalizeSingleReminder({ mode: 'unknown' })).toBeNull()
    })
  })

  describe('normalizeTaskReminders', () => {
    it('returns empty array when no reminder data exists', () => {
      expect(normalizeTaskReminders({})).toEqual([])
      expect(normalizeTaskReminders(null)).toEqual([])
      expect(normalizeTaskReminders({ reminder: null })).toEqual([])
    })

    it('converts legacy reminder object with offsetMinutes to RelativeReminder array', () => {
      const result = normalizeTaskReminders({
        reminder: { offsetMinutes: 60 },
      })
      expect(result).toEqual([
        { mode: 'relative', offsetMinutes: 60 },
      ])
    })

    it('prioritizes reminders array when present', () => {
      const result = normalizeTaskReminders({
        reminder: { offsetMinutes: 10 },
        reminders: [
          { mode: 'absolute', at: '2026-10-15T09:00', timeZone: 'Europe/Stockholm' },
          { mode: 'relative', offsetMinutes: 60 },
        ],
      })
      expect(result).toEqual([
        { mode: 'absolute', at: '2026-10-15T09:00', timeZone: 'Europe/Stockholm' },
        { mode: 'relative', offsetMinutes: 60 },
      ])
    })

    it('filters out invalid items in reminders array', () => {
      const result = normalizeTaskReminders({
        reminders: [
          { mode: 'relative', offsetMinutes: 10 },
          { invalid: true },
          'random string',
          { mode: 'absolute', at: '2026-10-20T10:00', timeZone: 'Europe/Stockholm' },
        ],
      })
      expect(result).toEqual([
        { mode: 'relative', offsetMinutes: 10 },
        { mode: 'absolute', at: '2026-10-20T10:00', timeZone: 'Europe/Stockholm' },
      ])
    })
  })

  describe('normalizeTask', () => {
    it('ensures task has reminders array attached', () => {
      const task = normalizeTask({
        id: 'task-1',
        title: 'Test task',
        reminder: { offsetMinutes: 1440 },
      })
      expect(task.reminders).toEqual([
        { mode: 'relative', offsetMinutes: 1440 },
      ])
    })

    it('retains existing valid fields', () => {
      const task = normalizeTask({
        id: 'task-2',
        title: 'Another task',
        completed: false,
      })
      expect(task.id).toBe('task-2')
      expect(task.title).toBe('Another task')
      expect(task.completed).toBe(false)
      expect(task.reminders).toEqual([])
    })
  })
})
