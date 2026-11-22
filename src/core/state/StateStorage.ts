/**
 * Port: keeping the user's state between visits.
 *
 * @packageDocumentation
 */

/**
 * Loads and saves a state object.
 *
 * @remarks Implemented by `LocalStorageStateStorage`. Saving may silently fail (storage full or
 * disabled): the app then works without persistence.
 *
 * @typeParam T - The state's shape.
 */
export interface StateStorage<T> {
  /** The saved state; missing or unreadable data gives `{}`. */
  load(): Partial<T>
  /** Saves the state, replacing the previous one. */
  save(state: T): void
}
