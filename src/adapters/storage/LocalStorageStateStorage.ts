/**
 * {@link StateStorage} in the browser's `localStorage`.
 *
 * @packageDocumentation
 */
import type { StateStorage } from '@/core/state/StateStorage'

/**
 * Saves a state as JSON under one `localStorage` key.
 *
 * @typeParam T - The state's shape.
 */
export class LocalStorageStateStorage<T> implements StateStorage<T> {
  /** @param key - The `localStorage` key. */
  constructor(private readonly key: string) {}

  load(): Partial<T> {
    try {
      const raw = localStorage.getItem(this.key)
      return raw ? (JSON.parse(raw) as Partial<T>) : {}
    } catch {
      return {}
    }
  }

  save(state: T): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(state))
    } catch {
      /* storage unavailable or full: progress just won't persist */
    }
  }
}
