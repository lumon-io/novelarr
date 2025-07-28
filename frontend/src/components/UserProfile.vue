<template>
  <div class="bg-white shadow-md rounded-lg p-6">
    <h2 class="text-2xl font-bold mb-6">User Profile</h2>
    
    <div class="space-y-6">
      <!-- User Info -->
      <div class="border-b pb-4">
        <h3 class="text-lg font-semibold mb-3">Account Information</h3>
        <p class="text-gray-600">Username: <span class="font-medium">{{ username }}</span></p>
        <p class="text-gray-600">Role: <span class="font-medium capitalize">{{ role }}</span></p>
      </div>
      
      <!-- Kindle Settings -->
      <div class="border-b pb-4">
        <h3 class="text-lg font-semibold mb-3">Kindle Settings</h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Kindle Email Address
            </label>
            <div class="flex space-x-2">
              <input
                v-model="kindleEmail"
                type="text"
                placeholder="your-kindle-email"
                class="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
              <select
                v-model="kindleDomain"
                class="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="@kindle.com">@kindle.com</option>
                <option value="@free.kindle.com">@free.kindle.com</option>
              </select>
            </div>
            <p class="text-sm text-gray-500 mt-1">
              Enter your Kindle email address to enable Send to Kindle functionality
            </p>
          </div>
          
          <div v-if="kindleEnabled" class="bg-blue-50 p-3 rounded">
            <p class="text-sm text-blue-800">
              <strong>Important:</strong> Make sure to add <strong>{{ fromEmail }}</strong> to your 
              <a href="https://www.amazon.com/hz/mycd/myx#/home/settings/payment" target="_blank" class="underline">
                Amazon Approved Personal Document E-mail List
              </a>
            </p>
          </div>
        </div>
      </div>
      
      <!-- Save Button -->
      <div class="flex justify-end">
        <button
          @click="saveProfile"
          :disabled="saving"
          class="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {{ saving ? 'Saving...' : 'Save Profile' }}
        </button>
      </div>
    </div>
    
    <!-- Success/Error Messages -->
    <div v-if="message" :class="messageClass" class="mt-4 p-3 rounded">
      {{ message }}
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import api from '../api';

export default {
  name: 'UserProfile',
  setup() {
    const authStore = useAuthStore();
    const kindleEmail = ref('');
    const kindleDomain = ref('@kindle.com');
    const saving = ref(false);
    const message = ref('');
    const messageType = ref('');
    const kindleEnabled = ref(false);
    const fromEmail = ref('');
    
    const username = computed(() => authStore.user?.username || '');
    const role = computed(() => authStore.user?.role || 'user');
    
    const messageClass = computed(() => {
      return messageType.value === 'success' 
        ? 'bg-green-100 text-green-700'
        : 'bg-red-100 text-red-700';
    });
    
    const loadProfile = async () => {
      try {
        // Get Kindle email
        const kindleResponse = await api.get('/kindle/email');
        if (kindleResponse.data.kindle_email) {
          const email = kindleResponse.data.kindle_email;
          if (email.includes('@')) {
            const [user, domain] = email.split('@');
            kindleEmail.value = user;
            kindleDomain.value = '@' + domain;
          } else {
            kindleEmail.value = email;
          }
        }
        
        // Check if Kindle is enabled
        const settingsResponse = await api.get('/settings');
        kindleEnabled.value = settingsResponse.data.kindle_enabled?.value === 'true';
        fromEmail.value = settingsResponse.data.smtp_from_email?.value || 'noreply@novelarr.com';
      } catch (error) {
        console.error('Failed to load profile:', error);
      }
    };
    
    const saveProfile = async () => {
      saving.value = true;
      message.value = '';
      
      try {
        const fullKindleEmail = kindleEmail.value ? 
          (kindleEmail.value.includes('@') ? kindleEmail.value : kindleEmail.value + kindleDomain.value) 
          : '';
        
        await api.put('/kindle/email', { 
          kindle_email: fullKindleEmail 
        });
        
        message.value = 'Profile saved successfully!';
        messageType.value = 'success';
        
        setTimeout(() => {
          message.value = '';
        }, 3000);
      } catch (error) {
        message.value = error.response?.data?.error || 'Failed to save profile';
        messageType.value = 'error';
      } finally {
        saving.value = false;
      }
    };
    
    onMounted(() => {
      loadProfile();
    });
    
    return {
      username,
      role,
      kindleEmail,
      kindleDomain,
      saving,
      message,
      messageClass,
      kindleEnabled,
      fromEmail,
      saveProfile
    };
  }
};
</script>