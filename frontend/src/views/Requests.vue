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
              Book
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Requested
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
              <span :class="getStatusClass(request.status)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                {{ request.status }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ formatDate(request.requested_at) }}
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

onMounted(fetchRequests)
</script>