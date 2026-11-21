/**
 * The app's routes.
 *
 * | Path        | Screen                                                           |
 * | ----------- | ---------------------------------------------------------------- |
 * | `/`         | Training, paragraph by paragraph (`PracticeView`)                |
 * | `/discours` | The whole speech: continuous listening and reading (`DocumentView`) |
 * | `/texte`    | Editing the speech (`EditorView`)                                |
 * | `/pdf`      | PDF of the speech, as cards or a document (`PrintView`)          |
 *
 * `/imprimer` redirects to `/pdf`, and any other path to `/`. URLs are relative to the app's
 * public path (`BASE_URL`), so the app works from a sub-path.
 *
 * @packageDocumentation
 */
import { createRouter, createWebHistory } from 'vue-router'
import PracticeView from '@/views/PracticeView.vue'

/** The router, installed in `main.ts`. */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'entrainement', component: PracticeView },
    { path: '/texte', name: 'texte', component: () => import('@/views/EditorView.vue') },
    { path: '/discours', name: 'discours', component: () => import('@/views/DocumentView.vue') },
    { path: '/pdf', name: 'pdf', component: () => import('@/views/PrintView.vue') },
    { path: '/imprimer', redirect: (to) => ({ name: 'pdf', query: to.query }) },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
