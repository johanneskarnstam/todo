import { describe, expect, it } from 'vitest'
import { formatNotificationBody } from '@/utils/notificationFormat'

describe('formatNotificationBody', () => {
  it('formats list name, step count, and note together', () => {
    const body = formatNotificationBody({
      listName: 'Inköp',
      stepCount: { completed: 2, total: 3 },
      note: 'Mjölk och bröd',
    })
    expect(body).toBe('Inköp · Deluppgifter 2/3 klara\nMjölk och bröd')
  })

  it('formats list name and step count when no note is present', () => {
    const body = formatNotificationBody({
      listName: 'Projekt',
      stepCount: { completed: 1, total: 4 },
      note: null,
    })
    expect(body).toBe('Projekt · Deluppgifter 1/4 klara')
  })

  it('formats list name and note when no steps are present', () => {
    const body = formatNotificationBody({
      listName: 'Jobb',
      stepCount: { completed: 0, total: 0 },
      note: 'Ring Anna angående kontraktet',
    })
    expect(body).toBe('Jobb\nRing Anna angående kontraktet')
  })

  it('formats step count and note when list name is absent', () => {
    const body = formatNotificationBody({
      listName: undefined,
      stepCount: { completed: 3, total: 5 },
      note: 'Kom ihåg biljetter',
    })
    expect(body).toBe('Deluppgifter 3/5 klara\nKom ihåg biljetter')
  })

  it('formats only note when list name and step count are absent', () => {
    const body = formatNotificationBody({
      listName: null,
      stepCount: null,
      note: 'Enkel kom-ihåg-lapp',
    })
    expect(body).toBe('Enkel kom-ihåg-lapp')
  })

  it('returns empty string when all inputs are empty or missing', () => {
    const body = formatNotificationBody({})
    expect(body).toBe('')
  })

  it('trims whitespace appropriately', () => {
    const body = formatNotificationBody({
      listName: '  Mina uppgifter  ',
      stepCount: { completed: 0, total: 2 },
      note: '   Fixa cykeln   ',
      priority: 'urgent',
    })
    expect(body).toBe('Mina uppgifter · Deluppgifter 0/2 klara · Prioritet: Brådskande\nFixa cykeln')
  })

  it('omits the default normal priority', () => {
    const body = formatNotificationBody({ priority: 'normal', note: 'Ring Anna' })
    expect(body).toBe('Ring Anna')
  })
})
