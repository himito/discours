/**
 * Turning a caught error into a message.
 *
 * @packageDocumentation
 */

/**
 * The message of a caught error.
 *
 * @param error - What was thrown: usually an `Error`, but any value can be thrown.
 * @returns The error's message, or the value as text.
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
