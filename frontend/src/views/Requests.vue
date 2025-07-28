<template>
  <div class="container mx-auto p-4">
    <h1 class="text-3xl font-bold mb-6">My Requests</h1>
    
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>
    
    <div v-else-if="requests.length === 0" class="text-center py-12 text-gray-600">
      No requests yet
    </div>
    
    <div v-else class="bg-white shadow-md rounded-lg overflow-hidden">
      <table class="min-w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Content
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Requested
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="request in requests" :key="request.id">
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center">
                <img 
                  :src="request.cover_url || '/placeholder.jpg'" 
                  :alt="request.book_title"
                  class="h-10 w-10 rounded-full object-cover"
                >
                <div class="ml-4">
                  <div class="text-sm font-medium text-gray-900">
                    {{ request.book_title }}
                  </div>
                  <div class="text-sm text-gray-500">
                    {{ request.book_author }}
                  </div>
                </div>
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 capitalize">
                {{ request.content_type || 'books' }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span :class="getStatusClass(request.status)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                {{ request.status }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ formatDate(request.requested_at) }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
              <div class="flex space-x-2">
                <button
                  v-if="request.download_status === 'completed' && request.file_path"
                  @click="sendToKindle(request)"
                  :disabled="sendingToKindle[request.id]"
                  class="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                >
                  {{ sendingToKindle[request.id] ? 'Sending...' : 'Send to Kindle' }}
                </button>
                <span v-else-if="request.download_status === 'downloading'" class="text-gray-500">
                  Downloading... {{ request.download_progress }}%
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api'

const requests = ref([])
const loading = ref(true)
const sendingToKindle = ref({})

const getStatusClass = (status) => {
  switch (status) {
    case 'added':
      return 'bg-green-100 text-green-800'
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString()
}

const fetchRequests = async () => {
  try {
    const response = await api.get('/requests')
    requests.value = response.data.requests
  } catch (error) {
    console.error('Failed to fetch requests:', error)
  } finally {
    loading.value = false
  }
}

const sendToKindle = async (request) => {
  // First check if user has Kindle email configured
  try {
    const kindleResponse = await api.get('/kindle/email')
    if (!kindleResponse.data.kindle_email) {
      alert('Please configure your Kindle email in your Profile settings first.')
      return
    }
  } catch (error) {
    console.error('Failed to check Kindle email:', error)
    alert('Failed to check Kindle settings. Please try again.')
    return
  }

  sendingToKindle.value[request.id] = true
  
  try {
    // For now, we'll use the request ID to send the book
    // The backend will need to map this to the actual book file
    await api.post(`/kindle/send/${request.id}`)
    alert(`Book sent to your Kindle!`)
  } catch (error) {
    console.error('Failed to send to Kindle:', error)
    alert(error.response?.data?.error || 'Failed to send to Kindle. Please try again.')
  } finally {
    sendingToKindle.value[request.id] = false
  }
}

onMounted(fetchRequests)
</script>