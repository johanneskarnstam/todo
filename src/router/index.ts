import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import SettingsView from '../views/SettingsView.vue'
import { useAuthStore } from '@/stores/authStore'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/my-day',
      name: 'my-day',
      component: HomeView,
      meta: { smartView: 'myDay' },
    },
    {
      path: '/important',
      name: 'important',
      component: HomeView,
      meta: { smartView: 'important' },
    },
    {
      path: '/planned',
      name: 'planned',
      component: HomeView,
      meta: { smartView: 'planned' },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
    },
  ],
})

// Navigation Guard
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  // Wait for auth to init if not already
  if (authStore.loading) {
    await authStore.initAuth()
  }

  const isPublic = to.name === 'login' || to.name === 'register'
  const isAuthenticated = authStore.isAuthenticated

  if (!isPublic && !isAuthenticated) {
    next('/login')
  } else if (isPublic && isAuthenticated) {
    next('/')
  } else {
    next()
  }
})

export default router
