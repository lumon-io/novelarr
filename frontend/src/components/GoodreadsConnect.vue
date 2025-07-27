<template>
  <div class="bg-white rounded-lg shadow p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-medium text-gray-900">Goodreads Integration</h3>
      <img 
        src="https://s.gr-assets.com/assets/home/header_logo-8d96d7078a3d63f9f31d92282fd67cf4.png"
        alt="Goodreads"
        class="h-6"
      >
    </div>

    <div v-if="!status.connected" class="space-y-4">
      <p class="text-sm text-gray-600">
        Connect your Goodreads account to sync your reading history and get personalized AI recommendations.
      </p>
      <button
        @click="connectGoodreads"
        :disabled="connecting"
        class="w-full bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700 disabled:opacity-50"
      >
        <span v-if="!connecting">Connect Goodreads Account</span>
        <span v-else>Redirecting...</span>
      </button>
    </div>

    <div v-else class="space-y-4">
      <div class="flex items-center space-x-3">
        <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
        <div>
          <p class="text-sm font-medium text-gray-900">Connected as {{ status.username }}</p>
          <p class="text-xs text-gray-500">Connected {{ formatDate(status.connectedAt) }}</p>
        </div>
      </div>

      <div v-if="status.stats" class="grid grid-cols-3 gap-4 py-4 border-t border-b">
        <div class="text-center">
          <p class="text-2xl font-semibold text-gray-900">{{ status.stats.total_books }}</p>
          <p class="text-xs text-gray-500">Books</p>
        </div>
        <div class="text-center">
          <p class="text-2xl font-semibold text-gray-900">{{ status.stats.rated_books }}</p>
          <p class="text-xs text-gray-500">Rated</p>
        </div>
        <div class="text-center">
          <p class="text-2xl font-semibold text-gray-900">{{ status.stats.shelf_count }}</p>
          <p class="text-xs text-gray-500">Shelves</p>
        </div>
      </div>

      <div class="flex space-x-3">
        <button
          @click="syncLibrary"
          :disabled="syncing"
          class="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          <span v-if="!syncing">Sync Library</span>
          <span v-else>Syncing...</span>
        </button>
        <button
          @click="disconnect"
          class="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
        >
          Disconnect
        </button>
      </div>

      <p v-if="status.lastSync" class="text-xs text-gray-500 text-center">
        Last synced {{ formatDate(status.lastSync) }}
      </p>
    </div>

    <div v-if="error" class="mt-4 p-3 bg-red-50 text-red-700 rounded text-sm">
      {{ error }}
    </div>

    <div v-if="success" class="mt-4 p-3 bg-green-50 text-green-700 rounded text-sm">
      {{ success }}
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import axios from 'axios'

export default {
  name: 'GoodreadsConnect',
  setup() {
    const authStore = useAuthStore()
    const status = ref({ connected: false })
    const connecting = ref(false)
    const syncing = ref(false)
    const error = ref('')
    const success = ref('')

    const fetchStatus = async () => {
      try {
        const response = await axios.get('/api/goodreads/status', {
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        status.value = response.data
      } catch (err) {
        console.error('Failed to fetch Goodreads status:', err)
      }
    }

    const connectGoodreads = async () => {
      try {
        connecting.value = true
        error.value = ''
        
        const response = await axios.get('/api/goodreads/connect', {
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        
        // Redirect to Goodreads authorization
        window.location.href = response.data.authUrl
      } catch (err) {
        error.value = 'Failed to initiate Goodreads connection'
        connecting.value = false
      }
    }

    const syncLibrary = async () => {
      try {
        syncing.value = true
        error.value = ''
        success.value = ''
        
        await axios.post('/api/goodreads/sync', {}, {
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        
        success.value = 'Library synced successfully!'
        await fetchStatus()
      } catch (err) {
        error.value = err.response?.data?.error || 'Failed to sync library'
      } finally {
        syncing.value = false
      }
    }

    const disconnect = async () => {
      if (!confirm('Are you sure you want to disconnect your Goodreads account? This will remove all synced data.')) {
        return
      }

      try {
        await axios.delete('/api/goodreads/disconnect', {
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        
        status.value = { connected: false }
        success.value = 'Goodreads account disconnected'
      } catch (err) {
        error.value = 'Failed to disconnect account'
      }
    }

    const formatDate = (dateString) => {
      if (!dateString) return 'Never'
      const date = new Date(dateString)
      const now = new Date()
      const diff = now - date
      
      if (diff < 60000) return 'Just now'
      if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`
      if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`
      
      return date.toLocaleDateString()
    }

    onMounted(() => {
      fetchStatus()
      
      // Check if returning from OAuth callback
      const params = new URLSearchParams(window.location.search)
      if (params.get('goodreads') === 'connected') {
        success.value = 'Goodreads account connected successfully!'
        window.history.replaceState({}, document.title, window.location.pathname)
      } else if (params.get('goodreads') === 'error') {
        error.value = 'Failed to connect Goodreads account'
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    })

    return {
      status,
      connecting,
      syncing,
      error,
      success,
      connectGoodreads,
      syncLibrary,
      disconnect,
      formatDate
    }
  }
}
</script>