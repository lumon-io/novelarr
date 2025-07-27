<template>
  <nav class="bg-white shadow-lg">
    <div class="container mx-auto px-4">
      <div class="flex justify-between items-center py-4">
        <router-link to="/" class="text-xl font-bold text-gray-800">
          Novelarr
        </router-link>
        
        <div v-if="authStore.isAuthenticated" class="flex space-x-4">
          <router-link to="/search" class="text-gray-600 hover:text-gray-800">
            Search
          </router-link>
          <router-link to="/requests" class="text-gray-600 hover:text-gray-800">
            My Requests
          </router-link>
          
          <template v-if="authStore.user?.role === 'admin'">
            <router-link to="/users" class="text-gray-600 hover:text-gray-800">
              Users
            </router-link>
            <router-link to="/settings" class="text-gray-600 hover:text-gray-800">
              Settings
            </router-link>
          </template>
          
          <div class="flex items-center space-x-2">
            <span class="text-sm text-gray-500">{{ authStore.user?.username }}</span>
            <button @click="logout" class="text-gray-600 hover:text-gray-800">
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

const logout = () => {
  authStore.logout()
  router.push('/login')
}
</script>