import type { Task, TaskReminder } from '@/types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Validates and converts a single reminder candidate into a valid TaskReminder.
 * Returns null if the candidate is malformed or invalid.
 */
export function normalizeSingleReminder(raw: unknown): TaskReminder | null {
  if (!isRecord(raw)) return null

  // Explicit absolute reminder
  if (raw.mode === 'absolute') {
    if (typeof raw.at === 'string' && raw.at.trim().length > 0 && typeof raw.timeZone === 'string' && raw.timeZone.trim().length > 0) {
      return {
        mode: 'absolute',
        at: raw.at.trim(),
        timeZone: raw.timeZone.trim(),
      }
    }
    return null
  }

  // Explicit relative reminder
  if (raw.mode === 'relative') {
    const offset = typeof raw.offsetMinutes === 'number' ? raw.offsetMinutes : Number(raw.offsetMinutes)
    if (Number.isFinite(offset)) {
      return {
        mode: 'relative',
        offsetMinutes: offset,
      }
    }
    return null
  }

  // Legacy item without mode but with offsetMinutes
  if (typeof raw.offsetMinutes === 'number' || (typeof raw.offsetMinutes === 'string' && raw.offsetMinutes.trim() !== '')) {
    const offset = Number(raw.offsetMinutes)
    if (Number.isFinite(offset)) {
      return {
        mode: 'relative',
        offsetMinutes: offset,
      }
    }
  }

  return null
}

/**
 * Normalizes reminders from raw task data.
 * - If raw.reminders is an array, filters and returns valid TaskReminder objects.
 * - Otherwise, if raw.reminder is present, converts it to a single RelativeReminder.
 * - Defaults to an empty array.
 */
export function normalizeTaskReminders(raw: unknown): TaskReminder[] {
  if (!isRecord(raw)) return []

  if (Array.isArray(raw.reminders)) {
    const normalized: TaskReminder[] = []
    for (const item of raw.reminders) {
      const parsed = normalizeSingleReminder(item)
      if (parsed) normalized.push(parsed)
    }
    return normalized
  }

  if (raw.reminder !== undefined && raw.reminder !== null) {
    const parsed = normalizeSingleReminder(raw.reminder)
    if (parsed) return [parsed]
  }

  return []
}

/**
 * Ensures the task object has a normalized `reminders` array.
 */
export function normalizeTask<T extends Partial<Task>>(task: T): T & { reminders: TaskReminder[] } {
  return {
    ...task,
    reminders: normalizeTaskReminders(task),
  }
}
