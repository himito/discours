/// <reference types="vite/client" />

/** French eSpeak data package as base64 in the offline build, `null` otherwise (see vite.config.ts). */
declare module 'virtual:espeak-data' {
  const data: string | null
  export default data
}

interface Window {
  /** State embedded in a downloaded offline copy (see src/offline.ts). */
  __DISCOURS_SEED__?: unknown
}
