import { defineComponent, h, ref, computed, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { useDragReorder } from '@/composables/useDragReorder'

const createPointerEvent = (type: string, clientY: number, pointerId = 1) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    clientY: { value: clientY },
    pointerId: { value: pointerId },
  })
  return event
}

const setItemRect = (element: Element, top: number) => {
  Object.defineProperty(element, 'getBoundingClientRect', {
    value: () => ({ top, bottom: top + 20, height: 20, left: 0, right: 100, width: 100 }),
  })
}

const mountReorderList = (enabledByDefault = true) => {
  const onReorder = vi.fn()
  const component = defineComponent({
    props: { enabled: { type: Boolean, default: enabledByDefault } },
    setup(props) {
      const containerRef = ref<HTMLElement | null>(null)
      const items = ref([{ id: 'step-1' }, { id: 'step-2' }])
      useDragReorder({
        containerRef,
        items,
        onReorder,
        enabled: computed(() => props.enabled),
        itemSelector: '[data-reorder-item]',
        handleSelector: '[data-reorder-handle]',
      })

      return () => h('div', { ref: containerRef }, items.value.map((item) => h(
        'div',
        { key: item.id, 'data-reorder-item': item.id },
        [h('button', { type: 'button', 'data-reorder-handle': '' })],
      )))
    },
  })

  return { wrapper: mount(component), onReorder }
}

describe('useDragReorder', () => {
  it('reorders items using configured item and handle selectors', async () => {
    const { wrapper, onReorder } = mountReorderList()
    await nextTick()
    const items = wrapper.findAll('[data-reorder-item]')
    setItemRect(items[0].element, 0)
    setItemRect(items[1].element, 30)

    items[0].get('button').element.dispatchEvent(createPointerEvent('pointerdown', 10))
    window.dispatchEvent(createPointerEvent('pointermove', 48))
    window.dispatchEvent(createPointerEvent('pointerup', 48))

    expect(onReorder).toHaveBeenCalledWith(['step-2', 'step-1'])
    expect(document.body.style.userSelect).toBe('')
    wrapper.unmount()
  })

  it('ignores other pointers and cancels an active drag cleanly', async () => {
    const { wrapper, onReorder } = mountReorderList()
    await nextTick()
    const items = wrapper.findAll('[data-reorder-item]')
    setItemRect(items[0].element, 0)
    setItemRect(items[1].element, 30)

    items[0].get('button').element.dispatchEvent(createPointerEvent('pointerdown', 10))
    window.dispatchEvent(createPointerEvent('pointermove', 48, 2))
    expect(items[0].element.getAttribute('style')).toBeNull()
    window.dispatchEvent(createPointerEvent('pointermove', 48))
    window.dispatchEvent(createPointerEvent('pointercancel', 48))

    expect(onReorder).not.toHaveBeenCalled()
    expect(document.body.style.userSelect).toBe('')
    wrapper.unmount()
  })

  it('does not listen for pointer input when disabled', async () => {
    const { wrapper, onReorder } = mountReorderList()
    await wrapper.setProps({ enabled: false })
    await nextTick()
    const handle = wrapper.get('[data-reorder-handle]')
    handle.element.dispatchEvent(createPointerEvent('pointerdown', 10))
    window.dispatchEvent(createPointerEvent('pointermove', 48))
    window.dispatchEvent(createPointerEvent('pointerup', 48))

    expect(onReorder).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
