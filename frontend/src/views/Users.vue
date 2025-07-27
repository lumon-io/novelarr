<template>
  <div class="container mx-auto p-4">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">Users</h1>
      <button
        @click="showAddUser = true"
        class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Add User
      </button>
    </div>
    
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>
    
    <div v-else class="bg-white shadow-md rounded-lg overflow-hidden">
      <table class="min-w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Username
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Role
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Created
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="user in users" :key="user.id">
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm font-medium text-gray-900">
                {{ user.username }}
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span :class="getRoleClass(user.role)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                {{ user.role }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ formatDate(user.created_at) }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
              <button
                @click="editUser(user)"
                class="text-indigo-600 hover:text-indigo-900 mr-4"
              >
                Edit
              </button>
              <button
                @click="deleteUser(user)"
                :disabled="user.username === authStore.user?.username"
                class="text-red-600 hover:text-red-900 disabled:text-gray-400"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- User Stats -->
    <div v-if="stats" class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-white p-6 rounded-lg shadow">
        <h3 class="text-lg font-semibold mb-2">Total Users</h3>
        <p class="text-3xl font-bold">{{ stats.totalUsers }}</p>
      </div>
      <div class="bg-white p-6 rounded-lg shadow">
        <h3 class="text-lg font-semibold mb-2">Admin Users</h3>
        <p class="text-3xl font-bold">{{ stats.adminUsers }}</p>
      </div>
      <div class="bg-white p-6 rounded-lg shadow">
        <h3 class="text-lg font-semibold mb-2">Total Requests</h3>
        <p class="text-3xl font-bold">{{ stats.totalRequests }}</p>
      </div>
    </div>
    
    <!-- Add/Edit User Modal -->
    <div v-if="showAddUser || editingUser" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div class="bg-white p-6 rounded-lg w-96">
        <h2 class="text-xl font-bold mb-4">
          {{ editingUser ? 'Edit User' : 'Add User' }}
        </h2>
        
        <form @submit.prevent="saveUser">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              v-model="userForm.username"
              type="text"
              required
              :disabled="!!editingUser"
              class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
          </div>
          
          <div v-if="!editingUser" class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              v-model="userForm.password"
              type="password"
              required
              minlength="6"
              class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
          </div>
          
          <div v-else class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              New Password (leave empty to keep current)
            </label>
            <input
              v-model="userForm.password"
              type="password"
              minlength="6"
              class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
          </div>
          
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <select
              v-model="userForm.role"
              class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          
          <div v-if="formError" class="mb-4 text-red-600 text-sm">
            {{ formError }}
          </div>
          
          <div class="flex justify-end space-x-4">
            <button
              type="button"
              @click="closeModal"
              class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="savingUser"
              class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
            >
              {{ savingUser ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const users = ref([])
const stats = ref(null)
const loading = ref(true)
const showAddUser = ref(false)
const editingUser = ref(null)
const savingUser = ref(false)
const formError = ref('')

const userForm = ref({
  username: '',
  password: '',
  role: 'user'
})

const getRoleClass = (role) => {
  return role === 'admin' 
    ? 'bg-purple-100 text-purple-800' 
    : 'bg-gray-100 text-gray-800'
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString()
}

const fetchUsers = async () => {
  try {
    const [usersResponse, statsResponse] = await Promise.all([
      api.get('/users'),
      api.get('/users/stats')
    ])
    users.value = usersResponse.data.users
    stats.value = statsResponse.data
  } catch (error) {
    console.error('Failed to fetch users:', error)
  } finally {
    loading.value = false
  }
}

const editUser = (user) => {
  editingUser.value = user
  userForm.value = {
    username: user.username,
    password: '',
    role: user.role
  }
}

const closeModal = () => {
  showAddUser.value = false
  editingUser.value = null
  userForm.value = {
    username: '',
    password: '',
    role: 'user'
  }
  formError.value = ''
}

const saveUser = async () => {
  savingUser.value = true
  formError.value = ''
  
  try {
    if (editingUser.value) {
      // Update user
      const updates = { role: userForm.value.role }
      if (userForm.value.password) {
        updates.password = userForm.value.password
      }
      
      await api.put(`/users/${editingUser.value.id}`, updates)
    } else {
      // Create user
      await api.post('/users', userForm.value)
    }
    
    await fetchUsers()
    closeModal()
  } catch (error) {
    formError.value = error.response?.data?.error || 'Failed to save user'
  } finally {
    savingUser.value = false
  }
}

const deleteUser = async (user) => {
  if (!confirm(`Are you sure you want to delete user "${user.username}"?`)) {
    return
  }
  
  try {
    await api.delete(`/users/${user.id}`)
    await fetchUsers()
  } catch (error) {
    alert(error.response?.data?.error || 'Failed to delete user')
  }
}

onMounted(fetchUsers)
</script>