/**
 * Composition root: creates the browser adapters, then the Vue app with its store (Pinia), router
 * and ports, and mounts it on `#app`.
 *
 * @remarks The only place that chooses adapters (`createBrowserPorts`). To run the app on other
 * engines, pass other implementations of the ports to `providePorts`.
 *
 * @packageDocumentation
 */
import './ui/assets/main.css'

import { createPinia } from 'pinia'
import { createApp } from 'vue'

import { createBrowserPorts } from './adapters'
import App from './ui/App.vue'
import { providePorts } from './ui/ports'
import router from './ui/router'

const ports = createBrowserPorts()
// Loads the phonetic engine in the background, so the first analysis doesn't wait for it.
ports.phonemizer.warmUp()

const app = createApp(App)
providePorts(app, ports)
app.use(createPinia())
app.use(router)
app.mount('#app')
