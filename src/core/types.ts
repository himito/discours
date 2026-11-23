/**
 * Small type utilities shared by every layer.
 *
 * @packageDocumentation
 */

/**
 * A value that may be absent: `T`, or `null`.
 *
 * @example
 * ```ts
 * function locate(index: number): Nullable<ParagraphLocation>
 * ```
 */
export type Nullable<T> = T | null
