import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import PracticeView from '@/views/PracticeView.vue'

const router = createRouter({
  // A file opened from disk has no server to rewrite paths: the offline build routes by hash.
  history:
    import.meta.env.MODE === 'offline'
      ? createWebHashHistory()
      : createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'entrainement', component: PracticeView },
    { path: '/texte', name: 'texte', component: () => import('@/views/EditorView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
