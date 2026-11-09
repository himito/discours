import { createRouter, createWebHistory } from 'vue-router'
import PracticeView from '@/views/PracticeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'entrainement', component: PracticeView },
    { path: '/texte', name: 'texte', component: () => import('@/views/EditorView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
