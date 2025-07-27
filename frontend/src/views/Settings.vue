<template>
  <div class="container mx-auto p-4">
    <h1 class="text-3xl font-bold mb-6">Settings</h1>
    
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>
    
    <div v-else class="bg-white shadow-md rounded-lg p-6">
      <div class="space-y-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Application Name
          </label>
          <input
            v-model="settings.app_name.value"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
          <p class="text-sm text-gray-500 mt-1">{{ settings.app_name.description }}</p>
        </div>
        
        <div>
          <label class="flex items-center">
            <input
              v-model="registrationEnabled"
              type="checkbox"
              class="mr-2"
            >
            <span class="text-sm font-medium text-gray-700">
              Enable Registration
            </span>
          </label>
          <p class="text-sm text-gray-500 mt-1">{{ settings.registration_enabled?.description }}</p>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Default User Role
          </label>
          <select
            v-model="settings.default_user_role.value"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <p class="text-sm text-gray-500 mt-1">{{ settings.default_user_role.description }}</p>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Requests Per User Limit
          </label>
          <input
            v-model.number="settings.requests_per_user_limit.value"
            type="number"
            min="0"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
          <p class="text-sm text-gray-500 mt-1">{{ settings.requests_per_user_limit.description }}</p>
        </div>
        
        <div>
          <label class="flex items-center">
            <input
              v-model="autoApprove"
              type="checkbox"
              class="mr-2"
            >
            <span class="text-sm font-medium text-gray-700">
              Auto-approve Requests
            </span>
          </label>
          <p class="text-sm text-gray-500 mt-1">{{ settings.auto_approve_requests?.description }}</p>
        </div>
        
        <div>
          <label class="flex items-center">
            <input
              v-model="requireApproval"
              type="checkbox"
              class="mr-2"
            >
            <span class="text-sm font-medium text-gray-700">
              Require Admin Approval
            </span>
          </label>
          <p class="text-sm text-gray-500 mt-1">{{ settings.require_approval?.description }}</p>
        </div>
        
        <!-- Jackett Settings -->
        <div class="border-t pt-6 mt-6">
          <h3 class="text-lg font-semibold mb-4">Jackett Integration</h3>
          
          <div class="space-y-4">
            <div>
              <label class="flex items-center">
                <input
                  v-model="jackettEnabled"
                  type="checkbox"
                  class="mr-2"
                >
                <span class="text-sm font-medium text-gray-700">
                  Enable Jackett
                </span>
              </label>
              <p class="text-sm text-gray-500 mt-1">{{ settings.jackett_enabled?.description }}</p>
            </div>
            
            <div v-if="jackettEnabled">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Jackett URL
              </label>
              <input
                v-model="settings.jackett_url.value"
                type="text"
                placeholder="http://192.168.1.4:9117"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
            </div>
            
            <div v-if="jackettEnabled">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Jackett API Key
              </label>
              <input
                v-model="settings.jackett_api_key.value"
                type="password"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
            </div>
          </div>
        </div>
        
        <!-- Prowlarr Settings -->
        <div class="border-t pt-6 mt-6">
          <h3 class="text-lg font-semibold mb-4">Prowlarr Integration</h3>
          
          <div class="space-y-4">
            <div>
              <label class="flex items-center">
                <input
                  v-model="prowlarrEnabled"
                  type="checkbox"
                  class="mr-2"
                >
                <span class="text-sm font-medium text-gray-700">
                  Enable Prowlarr
                </span>
              </label>
              <p class="text-sm text-gray-500 mt-1">{{ settings.prowlarr_enabled?.description }}</p>
            </div>
            
            <div v-if="prowlarrEnabled">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Prowlarr URL
              </label>
              <input
                v-model="settings.prowlarr_url.value"
                type="text"
                placeholder="http://192.168.1.4:9696"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
            </div>
            
            <div v-if="prowlarrEnabled">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Prowlarr API Key
              </label>
              <input
                v-model="settings.prowlarr_api_key.value"
                type="password"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
            </div>
          </div>
        </div>
        
        <!-- Kavita Settings -->
        <div class="border-t pt-6 mt-6">
          <h3 class="text-lg font-semibold mb-4">Kavita Integration</h3>
          
          <div class="space-y-4">
            <div>
              <label class="flex items-center">
                <input
                  v-model="kavitaEnabled"
                  type="checkbox"
                  class="mr-2"
                >
                <span class="text-sm font-medium text-gray-700">
                  Enable Kavita Integration
                </span>
              </label>
              <p class="text-sm text-gray-500 mt-1">Check if books exist in your Kavita library</p>
            </div>
            
            <div v-if="kavitaEnabled">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Kavita URL
              </label>
              <input
                v-model="settings.kavita_url.value"
                type="text"
                placeholder="http://192.168.1.4:5000"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
              <p class="text-sm text-gray-500 mt-1">Your Kavita server URL</p>
            </div>
            
            <div v-if="kavitaEnabled">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Kavita API Key
              </label>
              <input
                v-model="settings.kavita_api_key.value"
                type="password"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
              <p class="text-sm text-gray-500 mt-1">Found in Kavita Settings → Security → API Keys</p>
            </div>
            
            <div v-if="kavitaEnabled">
              <button
                @click="testKavitaConnection"
                :disabled="testingKavita"
                class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
              >
                {{ testingKavita ? 'Testing...' : 'Test Connection' }}
              </button>
              <span v-if="kavitaTestResult" class="ml-3" :class="kavitaTestResult.success ? 'text-green-600' : 'text-red-600'">
                {{ kavitaTestResult.message }}
              </span>
            </div>
          </div>
        </div>
        
        <!-- Readarr Settings -->
        <div class="border-t pt-6 mt-6">
          <h3 class="text-lg font-semibold mb-4">Readarr Integration</h3>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Readarr URL
              </label>
              <input
                v-model="settings.readarr_url.value"
                type="text"
                placeholder="http://192.168.1.4:8787"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Readarr API Key
              </label>
              <input
                v-model="settings.readarr_api_key.value"
                type="password"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Quality Profile ID
              </label>
              <input
                v-model="settings.readarr_quality_profile.value"
                type="text"
                placeholder="1"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Root Folder Path
              </label>
              <input
                v-model="settings.readarr_root_folder.value"
                type="text"
                placeholder="/books"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
            </div>
          </div>
        </div>
      </div>
      
      <div class="mt-8 flex justify-end space-x-4">
        <button
          @click="resetSettings"
          class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
        >
          Reset
        </button>
        <button
          @click="saveSettings"
          :disabled="saving"
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {{ saving ? 'Saving...' : 'Save Settings' }}
        </button>
      </div>
      
      <div v-if="message" class="mt-4 p-3 rounded" :class="messageClass">
        {{ message }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api'

const settings = ref({})
const loading = ref(true)
const saving = ref(false)
const message = ref('')
const messageClass = ref('')

const registrationEnabled = computed({
  get: () => settings.value.registration_enabled?.value === 'true',
  set: (val) => {
    if (settings.value.registration_enabled) {
      settings.value.registration_enabled.value = val ? 'true' : 'false'
    }
  }
})

const autoApprove = computed({
  get: () => settings.value.auto_approve_requests?.value === 'true',
  set: (val) => {
    if (settings.value.auto_approve_requests) {
      settings.value.auto_approve_requests.value = val ? 'true' : 'false'
    }
  }
})

const requireApproval = computed({
  get: () => settings.value.require_approval?.value === 'true',
  set: (val) => {
    if (settings.value.require_approval) {
      settings.value.require_approval.value = val ? 'true' : 'false'
    }
  }
})

const jackettEnabled = computed({
  get: () => settings.value.jackett_enabled?.value === 'true',
  set: (val) => {
    if (settings.value.jackett_enabled) {
      settings.value.jackett_enabled.value = val ? 'true' : 'false'
    }
  }
})

const prowlarrEnabled = computed({
  get: () => settings.value.prowlarr_enabled?.value === 'true',
  set: (val) => {
    if (settings.value.prowlarr_enabled) {
      settings.value.prowlarr_enabled.value = val ? 'true' : 'false'
    }
  }
})

const kavitaEnabled = computed({
  get: () => settings.value.kavita_enabled?.value === 'true',
  set: (val) => {
    if (settings.value.kavita_enabled) {
      settings.value.kavita_enabled.value = val ? 'true' : 'false'
    }
  }
})

const testingKavita = ref(false)
const kavitaTestResult = ref(null)

const testKavitaConnection = async () => {
  testingKavita.value = true
  kavitaTestResult.value = null
  
  try {
    // Save current settings first
    await saveSettings()
    
    // Test connection
    const response = await api.get('/search/sources')
    if (response.data.kavita && response.data.kavita.connected) {
      kavitaTestResult.value = { success: true, message: 'Connection successful!' }
    } else {
      kavitaTestResult.value = { success: false, message: 'Connection failed' }
    }
  } catch (error) {
    kavitaTestResult.value = { success: false, message: 'Connection failed: ' + error.message }
  } finally {
    testingKavita.value = false
  }
}

const fetchSettings = async () => {
  try {
    const response = await api.get('/settings')
    settings.value = response.data
  } catch (error) {
    console.error('Failed to fetch settings:', error)
  } finally {
    loading.value = false
  }
}

const saveSettings = async () => {
  saving.value = true
  message.value = ''
  
  try {
    const updates = {}
    for (const [key, data] of Object.entries(settings.value)) {
      updates[key] = data.value
    }
    
    await api.put('/settings', updates)
    message.value = 'Settings saved successfully!'
    messageClass.value = 'bg-green-100 text-green-800'
  } catch (error) {
    message.value = error.response?.data?.error || 'Failed to save settings'
    messageClass.value = 'bg-red-100 text-red-800'
  } finally {
    saving.value = false
  }
}

const resetSettings = () => {
  fetchSettings()
  message.value = ''
}

onMounted(fetchSettings)
</script>