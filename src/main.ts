/**
 * Entry point: creates the Vue app with its store (Pinia) and router, and mounts it on `#app`.
 *
 * @packageDocumentation
 */
import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
