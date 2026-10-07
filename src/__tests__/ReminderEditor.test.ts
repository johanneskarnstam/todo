import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ReminderEditor from '@/components/ReminderEditor.vue'

describe('ReminderEditor.vue', () => {
  it('renders only absolute mode when dueDate is missing', () => {
    const wrapper = mount(ReminderEditor, {
      props: { dueDate: '' },
    })

    expect(wrapper.find('button[role="tab"]').exists()).toBe(false)
    expect(wrapper.find('#reminder-date').exists()).toBe(true)
    expect(wrapper.find('#reminder-time').exists()).toBe(true)
    expect(wrapper.find('#relative-reminder-offset').exists()).toBe(false)
  })

  it('allows switching between relative and absolute mode when dueDate exists', async () => {
    const wrapper = mount(ReminderEditor, {
      props: { dueDate: '2026-10-15' },
    })

    const tabs = wrapper.findAll('button[role="tab"]')
    expect(tabs.length).toBe(2)

    // Starts in relative mode
    expect(wrapper.find('#relative-reminder-offset').exists()).toBe(true)

    // Switch to absolute
    await tabs[1].trigger('click')
    expect(wrapper.find('#reminder-date').exists()).toBe(true)
    expect(wrapper.find('#reminder-time').exists()).toBe(true)
  })

  it('disables save button if absolute date/time is in the past', async () => {
    const wrapper = mount(ReminderEditor, {
      props: { dueDate: '' },
    })

    await wrapper.find('#reminder-date').setValue('2020-01-01')
    await wrapper.find('#reminder-time').setValue('10:00')

    const saveButton = wrapper.findAll('button').find((btn) => btn.text().includes('Spara påminnelse'))
    expect(saveButton?.attributes('disabled')).toBeDefined()
  })

  it('emits update:modelValue with relative reminder when valid', async () => {
    const wrapper = mount(ReminderEditor, {
      props: { dueDate: '2026-10-15' },
    })

    await wrapper.find('#relative-reminder-offset').setValue('60')
    const saveButton = wrapper.findAll('button').find((btn) => btn.text().includes('Spara påminnelse'))
    await saveButton?.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([
      [{ mode: 'relative', offsetMinutes: 60 }],
    ])
  })

  it('emits update:modelValue with absolute reminder when valid', async () => {
    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const wrapper = mount(ReminderEditor, {
      props: { dueDate: '' },
    })

    await wrapper.find('#reminder-date').setValue(futureDate)
    await wrapper.find('#reminder-time').setValue('14:30')

    const saveButton = wrapper.findAll('button').find((btn) => btn.text().includes('Spara påminnelse'))
    expect(saveButton?.attributes('disabled')).toBeUndefined()
    await saveButton?.trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toMatchObject({
      mode: 'absolute',
      at: `${futureDate}T14:30`,
    })
  })

  it('emits cancel when cancel button is clicked', async () => {
    const wrapper = mount(ReminderEditor, {
      props: { dueDate: '' },
    })

    const cancelButton = wrapper.findAll('button').find((btn) => btn.text().includes('Avbryt'))
    await cancelButton?.trigger('click')

    expect(wrapper.emitted('cancel')).toBeTruthy()
  })
})
