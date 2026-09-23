<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { ref } from 'vue'

const authStore = useAuthStore()
const router = useRouter()
const isSigningIn = ref(false)
const loginError = ref('')

const handleLogin = async () => {
  if (isSigningIn.value) return

  isSigningIn.value = true
  loginError.value = ''
  try {
    await authStore.loginWithGoogle()
    router.push('/')
  } catch (error) {
    console.error('Login failed:', error)
    loginError.value = 'Sign-in was cancelled or could not be completed. Please try again.'
  } finally {
    isSigningIn.value = false
  }
}
</script>

<template>
  <main class="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f7fb] px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6">
    <div class="pointer-events-none absolute inset-0" aria-hidden="true">
      <div class="absolute -left-24 -top-24 size-72 rounded-full bg-blue-200/50 blur-3xl dark:bg-blue-900/20" />
      <div class="absolute -bottom-32 -right-20 size-96 rounded-full bg-cyan-100/70 blur-3xl dark:bg-cyan-950/20" />
      <div class="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(37,100,207,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(37,100,207,0.06)_1px,transparent_1px)] [background-size:32px_32px] dark:opacity-20" />
    </div>

    <section class="relative grid w-full max-w-5xl overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-[0_24px_80px_rgba(15,46,88,0.14)] backdrop-blur sm:grid-cols-[1.05fr_0.95fr] dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-black/30" aria-labelledby="login-title">
      <div class="hidden flex-col justify-between bg-[#2564cf] p-10 text-white sm:flex lg:p-14">
        <div>
          <div class="flex items-center gap-3">
            <span class="grid size-11 place-items-center rounded-xl bg-white text-xl font-bold text-[#2564cf] shadow-lg" aria-hidden="true">✓</span>
            <span class="text-lg font-semibold tracking-tight">Todo</span>
          </div>
          <div class="mt-24 max-w-sm">
            <p class="text-sm font-semibold uppercase tracking-[0.2em] text-blue-100">Your day, in focus</p>
            <h1 class="mt-4 text-4xl font-semibold leading-tight lg:text-5xl">Make room for what matters.</h1>
            <p class="mt-5 text-base leading-7 text-blue-100">Keep tasks, lists, and small next steps together in one calm workspace.</p>
          </div>
        </div>
        <p class="text-sm text-blue-100">Simple planning for busy days.</p>
      </div>

      <div class="flex min-h-[520px] flex-col justify-center p-7 sm:p-10 lg:p-14">
        <div class="mb-10 sm:hidden">
          <div class="flex items-center gap-3">
            <span class="grid size-10 place-items-center rounded-xl bg-[#2564cf] text-lg font-bold text-white shadow-md" aria-hidden="true">✓</span>
            <span class="text-lg font-semibold tracking-tight">Todo</span>
          </div>
        </div>

        <div class="max-w-sm">
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-[#2564cf] dark:text-blue-400">Welcome back</p>
          <h1 id="login-title" class="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Sign in to Todo</h1>
          <p class="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400">Your lists and tasks are waiting for you.</p>

          <p v-if="loginError" class="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-5 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300" role="alert">
            {{ loginError }}
          </p>

          <button
            class="mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus:ring-offset-slate-900"
            type="button"
            :disabled="isSigningIn"
            @click="handleLogin"
          >
            <span class="grid size-6 place-items-center rounded-full bg-white text-sm font-bold shadow-sm" aria-hidden="true">G</span>
            <span>{{ isSigningIn ? 'Signing in...' : 'Continue with Google' }}</span>
          </button>

          <p class="mt-8 text-center text-xs leading-5 text-slate-400 dark:text-slate-500">By continuing, you agree to use Todo for your personal task planning.</p>
        </div>
      </div>
    </section>
  </main>
</template>
