import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from './stores/auth'

const routes = [
  {
    path: '/',
    redirect: '/search'
  },
  {
    path: '/login',
    component: () => import('./views/Login.vue')
  },
  {
    path: '/search',
    component: () => import('./views/Search.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/requests',
    component: () => import('./views/Requests.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    component: () => import('./views/Settings.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/users',
    component: () => import('./views/Users.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/recommendations',
    component: () => import('./views/RecommendationsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/library',
    component: () => import('./views/Library.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else if (to.path === '/login' && authStore.isAuthenticated) {
    next('/search')
  } else if (to.meta.requiresAdmin && authStore.user?.role !== 'admin') {
    next('/search')
  } else {
    next()
  }
})

export default router