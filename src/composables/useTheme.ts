import { computed } from 'vue'
import { usePreferences } from '@/composables/usePreferences'

export const useTheme = () => {
  const { preferences } = usePreferences()
  const isDark = computed(() => {
    if (preferences.value.theme === 'dark') return true
    if (preferences.value.theme === 'light') return false
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const toggleTheme = () => {
    preferences.value.theme = isDark.value ? 'light' : 'dark'
  }

  return { isDark, toggleTheme }
}
