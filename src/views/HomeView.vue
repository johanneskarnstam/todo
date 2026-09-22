<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

const handleLogout = async () => {
  try {
    await authStore.logout()
    router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}
</script>

<template>
  <main class="center-content">
    <div class="glass-container">
      <h1>Welcome Home</h1>
      <p>
        You are authenticated as:
        <br />
        <strong>{{ authStore.user?.email }}</strong>
      </p>

      <button @click="handleLogout" class="btn btn-secondary">Logout</button>
    </div>
  </main>
</template>
