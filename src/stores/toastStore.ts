import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface Toast {
  id: number
  message: string
  actionLabel?: string
  action?: () => void
}

export const useToastStore = defineStore('toasts', () => {
  const toasts = ref<Toast[]>([])
  let nextId = 0

  const show = (message: string) => {
    const id = nextId++
    toasts.value.push({ id, message })
    window.setTimeout(() => dismiss(id), 5000)
  }

  const showAction = (message: string, actionLabel: string, action: () => void) => {
    const id = nextId++
    toasts.value.push({ id, message, actionLabel, action })
    window.setTimeout(() => dismiss(id), 5000)
  }

  const dismiss = (id: number) => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  return { toasts, show, showAction, dismiss }
})
