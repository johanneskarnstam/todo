import { onUnmounted, ref, watch, type Ref } from 'vue'

interface DragReorderOptions {
  containerRef: Ref<HTMLElement | null>
  items: Ref<{ id: string }[]>
  onReorder: (orderedIds: string[]) => void
  enabled: Ref<boolean>
}

export function useDragReorder(options: DragReorderOptions) {
  const { containerRef, items, onReorder, enabled } = options

  const isDragging = ref(false)
  const dragIndex = ref(-1)

  let dragElement: HTMLElement | null = null
  let activeHandle: HTMLElement | null = null
  let startY = 0
  let currentY = 0
  let itemElements: HTMLElement[] = []
  let itemRects: DOMRect[] = []
  let dragStartOrder: string[] = []
  let currentDropIndex = -1
  let activePointerId: number | null = null

  const DRAG_THRESHOLD = 6

  const getItemElements = (): HTMLElement[] => {
    const container = containerRef.value
    if (!container) return []
    return Array.from(container.querySelectorAll<HTMLElement>('[data-task-id]'))
  }

  const calculateDropIndex = (clientY: number): number => {
    for (let i = 0; i < itemRects.length; i++) {
      const rect = itemRects[i]
      const midY = rect.top + rect.height / 2
      if (clientY < midY) return i
    }
    return itemRects.length - 1
  }

  const updateVisualPositions = (dropIdx: number) => {
    const dragIdx = dragIndex.value
    if (dragIdx < 0 || !itemRects[dragIdx]) return

    const dragHeight = itemRects[dragIdx].height

    for (let i = 0; i < itemElements.length; i++) {
      const el = itemElements[i]
      if (i === dragIdx) continue

      let offset = 0
      if (dragIdx < dropIdx && i > dragIdx && i <= dropIdx) {
        offset = -dragHeight
      } else if (dragIdx > dropIdx && i >= dropIdx && i < dragIdx) {
        offset = dragHeight
      }

      el.style.transition = 'transform 150ms ease'
      el.style.transform = offset ? `translateY(${offset}px)` : ''
    }
  }

  const cleanupVisuals = () => {
    for (const el of itemElements) {
      el.style.transition = ''
      el.style.transform = ''
      el.style.opacity = ''
      el.style.zIndex = ''
      el.style.position = ''
      el.style.boxShadow = ''
    }
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }

  const removeWindowDragListeners = () => {
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    window.removeEventListener('pointercancel', handlePointerCancel)
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (!enabled.value) return
    const handle = (event.target as HTMLElement).closest('[data-drag-handle]') as HTMLElement | null
    if (!handle) return

    const taskEl = handle.closest('[data-task-id]') as HTMLElement | null
    if (!taskEl) return

    const els = getItemElements()
    const idx = els.indexOf(taskEl)
    if (idx < 0) return

    event.preventDefault()

    activePointerId = event.pointerId
    activeHandle = handle
    try {
      handle.setPointerCapture(event.pointerId)
    } catch {
      // Ignore if setPointerCapture fails in certain headless environments
    }

    dragElement = taskEl
    dragIndex.value = idx
    startY = event.clientY
    currentY = event.clientY
    itemElements = els
    itemRects = els.map((el) => el.getBoundingClientRect())
    dragStartOrder = items.value.map((item) => item.id)
    currentDropIndex = idx

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (dragIndex.value < 0 || (activePointerId !== null && event.pointerId !== activePointerId)) return

    currentY = event.clientY
    const deltaY = currentY - startY

    if (!isDragging.value && Math.abs(deltaY) < DRAG_THRESHOLD) return

    if (!isDragging.value) {
      isDragging.value = true
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'grabbing'
      if (dragElement) {
        dragElement.style.position = 'relative'
        dragElement.style.zIndex = '50'
        dragElement.style.opacity = '0.9'
        dragElement.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.2)'
      }
    }

    if (dragElement) {
      dragElement.style.transform = `translateY(${deltaY}px) scale(1.02)`
      dragElement.style.transition = 'box-shadow 150ms ease, opacity 150ms ease'
    }

    const newDropIndex = calculateDropIndex(currentY)
    if (newDropIndex !== currentDropIndex) {
      currentDropIndex = newDropIndex
      updateVisualPositions(newDropIndex)
    }
  }

  const handlePointerUp = (event: PointerEvent) => {
    if (dragIndex.value < 0 || (activePointerId !== null && event.pointerId !== activePointerId)) return

    removeWindowDragListeners()

    if (activePointerId !== null && activeHandle) {
      try {
        if (activeHandle.hasPointerCapture(activePointerId)) {
          activeHandle.releasePointerCapture(activePointerId)
        }
      } catch {
        // Ignore
      }
    }

    const wasDragging = isDragging.value
    const fromIndex = dragIndex.value
    const toIndex = currentDropIndex

    isDragging.value = false
    dragIndex.value = -1
    activePointerId = null
    activeHandle = null
    cleanupVisuals()
    dragElement = null

    if (wasDragging) {
      // Suppress any follow-up click event resulting from the pointer release
      const suppressClick = (e: MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
      }
      window.addEventListener('click', suppressClick, { capture: true, once: true })

      if (fromIndex !== toIndex && fromIndex >= 0 && toIndex >= 0) {
        const newOrder = [...dragStartOrder]
        const [moved] = newOrder.splice(fromIndex, 1)
        newOrder.splice(toIndex, 0, moved)
        onReorder(newOrder)
      }
    }

    dragStartOrder = []
    itemElements = []
    itemRects = []
    currentDropIndex = -1
  }

  const handlePointerCancel = (event: PointerEvent) => {
    if (activePointerId !== null && event.pointerId !== activePointerId) return

    removeWindowDragListeners()

    if (activePointerId !== null && activeHandle) {
      try {
        if (activeHandle.hasPointerCapture(activePointerId)) {
          activeHandle.releasePointerCapture(activePointerId)
        }
      } catch {
        // Ignore
      }
    }

    isDragging.value = false
    dragIndex.value = -1
    activePointerId = null
    activeHandle = null
    cleanupVisuals()
    dragElement = null
    dragStartOrder = []
    itemElements = []
    itemRects = []
    currentDropIndex = -1
  }

  const bindContainerListener = () => {
    const container = containerRef.value
    if (!container) return
    container.addEventListener('pointerdown', handlePointerDown)
  }

  const unbindContainerListener = () => {
    const container = containerRef.value
    if (!container) return
    container.removeEventListener('pointerdown', handlePointerDown)
  }

  watch(containerRef, (newContainer, oldContainer) => {
    if (oldContainer) {
      oldContainer.removeEventListener('pointerdown', handlePointerDown)
    }
    if (newContainer && enabled.value) {
      newContainer.addEventListener('pointerdown', handlePointerDown)
    }
  })

  watch(enabled, (isEnabled) => {
    if (isEnabled) {
      bindContainerListener()
    } else {
      unbindContainerListener()
      if (isDragging.value) {
        handlePointerCancel(new PointerEvent('pointercancel'))
      }
    }
  })

  onUnmounted(() => {
    unbindContainerListener()
    removeWindowDragListeners()
    cleanupVisuals()
  })

  return { isDragging, dragIndex }
}
