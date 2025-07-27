import { defineStore } from 'pinia'
import api from '../api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: localStorage.getItem('token')
  }),
  
  getters: {
    isAuthenticated: (state) => !!state.token
  },
  
  actions: {
    async login(username, password) {
      const response = await api.post('/auth/login', { username, password })
      this.token = response.data.token
      this.user = response.data.user
      localStorage.setItem('token', this.token)
    },
    
    async register(username, password) {
      const response = await api.post('/auth/register', { username, password })
      this.token = response.data.token
      this.user = response.data.user
      localStorage.setItem('token', this.token)
    },
    
    logout() {
      this.user = null
      this.token = null
      localStorage.removeItem('token')
    }
  }
})