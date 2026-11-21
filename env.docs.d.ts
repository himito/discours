/**
 * Lets plain TypeScript (TypeDoc, via `tsconfig.docs.json`) import `.vue` files. The app's own
 * type-check uses `vue-tsc`, which reads the components themselves.
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent
  export default component
}
