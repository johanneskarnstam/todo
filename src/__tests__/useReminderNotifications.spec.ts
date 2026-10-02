import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const reminderMocks = vi.hoisted(() => ({
  enablePush: vi.fn<() => Promise<boolean>>(),
  notificationsEnabled: true,
}))

vi.mock('@/composables/usePreferences', () => ({
  usePreferences: () => ({ preferences: { value: { notifications: reminderMocks.notificationsEnabled } } }),
}))

vi.mock('@/composables/usePushNotifications', () => ({
  usePushNotifications: () => ({ enablePush: reminderMocks.enablePush }),
}))

import { useReminderNotifications } from '@/composables/useReminderNotifications'

describe('useReminderNotifications', () => {
  beforeEach(() => {
    reminderMocks.enablePush.mockReset().mockResolvedValue(true)
    reminderMocks.notificationsEnabled = true
    vi.stubGlobal('Notification', {
      permission: 'granted',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const mountReminderNotifications = () => {
    const api = ref<ReturnType<typeof useReminderNotifications> | null>(null)
    const wrapper = mount(defineComponent({
      setup() {
        api.value = useReminderNotifications()
        return () => h('div')
      },
    }))
    if (!api.value) throw new Error('Reminder composable did not initialize.')
    return { api: api.value, wrapper }
  }

  it('registers this device for push when notifications are enabled', async () => {
    const { api, wrapper } = mountReminderNotifications()

    await expect(api.enablePushForReminder()).resolves.toBe('enabled')
    expect(reminderMocks.enablePush).toHaveBeenCalledOnce()

    wrapper.unmount()
  })

  it('does not register this device when global notifications are disabled', async () => {
    reminderMocks.notificationsEnabled = false
    const { api, wrapper } = mountReminderNotifications()

    await expect(api.enablePushForReminder()).resolves.toBe('disabled')
    expect(reminderMocks.enablePush).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('reports an unavailable push registration', async () => {
    reminderMocks.enablePush.mockResolvedValue(false)
    const { api, wrapper } = mountReminderNotifications()

    await expect(api.enablePushForReminder()).resolves.toBe('unavailable')

    wrapper.unmount()
  })

  it('does not register a push token when notification permission is denied', async () => {
    vi.stubGlobal('Notification', {
      permission: 'denied',
      requestPermission: vi.fn().mockResolvedValue('denied'),
    })
    const { api, wrapper } = mountReminderNotifications()

    await expect(api.enablePushForReminder()).resolves.toBe('unavailable')
    expect(reminderMocks.enablePush).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('includes the task title in the reminder notification body', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-02T12:00:00'))
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    const notificationConstructor = Object.assign(vi.fn(), {
      permission: 'granted',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    })
    vi.stubGlobal('Notification', notificationConstructor)
    const { api, wrapper } = mountReminderNotifications()
    const title = 'Review release notes'

    api.scheduleTaskReminder({
      id: 'task-reminder',
      title,
      dueDate: new Date(Date.now() + 1_000).toISOString(),
      reminder: { offsetMinutes: 0 },
    })
    await vi.advanceTimersByTimeAsync(1_000)

    expect(notificationConstructor).toHaveBeenCalledWith(`Påminnelse: ${title}`, {
      body: title,
      tag: 'todo-task-task-reminder',
    })
    wrapper.unmount()
  })
})
