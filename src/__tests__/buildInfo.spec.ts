import { describe, expect, it } from 'vitest'
import { appVersion, formatBuildTime, formattedBuildTime } from '@/buildInfo'

describe('buildInfo', () => {
  it('exposes a valid semantic version', () => {
    expect(appVersion).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('formats custom dates correctly in Swedish format', () => {
    const fixedDate = new Date(2026, 8, 25, 14, 43) // month 8 is September
    expect(formatBuildTime(fixedDate)).toBe('25sep 14:43')

    const morningDate = new Date(2026, 0, 5, 8, 7) // 5 jan 08:07
    expect(formatBuildTime(morningDate)).toBe('5jan 08:07')
  })

  it('formats the runtime build time', () => {
    expect(formattedBuildTime).toMatch(/^\d{1,2}[a-z]{3} \d{2}:\d{2}$/)
  })
})
