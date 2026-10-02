import { describe, expect, it } from 'vitest'
import { safeRedirectPath } from '@/utils/authRedirect'

describe('safeRedirectPath', () => {
  it('preserves internal routes and rejects external destinations', () => {
    expect(safeRedirectPath('/tasks/task-1?source=shared')).toBe('/tasks/task-1?source=shared')
    expect(safeRedirectPath('//example.com')).toBe('/')
    expect(safeRedirectPath('https://example.com')).toBe('/')
    expect(safeRedirectPath(null)).toBe('/')
  })
})
