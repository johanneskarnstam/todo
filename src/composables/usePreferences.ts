import { ref, watch } from 'vue'

export type ThemePreference = 'light' | 'dark' | 'system'
export type TaskSortPreference = 'manual' | 'created' | 'dueDate' | 'priority'

const storageKey = 'todo-preferences'

interface Preferences {
  theme: ThemePreference
  notifications: boolean
  taskSort: TaskSortPreference
  confirmDeletes: boolean
}

const defaults: Preferences = {
  theme: 'light',
  notifications: true,
  taskSort: 'manual',
  confirmDeletes: true,
}

const readPreferences = (): Preferences => {
  if (typeof localStorage === 'undefined') return { ...defaults }

  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Partial<Preferences>
    return {
      theme: stored.theme === 'dark' || stored.theme === 'system' ? stored.theme : defaults.theme,
      notifications: stored.notifications ?? defaults.notifications,
      taskSort: stored.taskSort === 'created' || stored.taskSort === 'dueDate' || stored.taskSort === 'priority'
        ? stored.taskSort
        : defaults.taskSort,
      confirmDeletes: stored.confirmDeletes ?? defaults.confirmDeletes,
    }
  } catch {
    return { ...defaults }
  }
}

const preferences = ref<Preferences>(readPreferences())

watch(preferences, (value) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(storageKey, JSON.stringify(value))
}, { deep: true })

export const usePreferences = () => ({
  preferences,
  resetPreferences: () => { preferences.value = { ...defaults } },
})