import { ref } from 'vue'

const themeStorageKey = 'todo-theme'

const readStoredTheme = () => {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(themeStorageKey) === 'dark'
}

export const useTheme = () => {
  const isDark = ref(readStoredTheme())

  const toggleTheme = () => {
    isDark.value = !isDark.value
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(themeStorageKey, isDark.value ? 'dark' : 'light')
    }
  }

  return { isDark, toggleTheme }
}
