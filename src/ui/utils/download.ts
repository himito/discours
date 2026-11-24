/**
 * Saving a file generated in the page.
 *
 * @packageDocumentation
 */

/** Makes the browser download `data` under the name `filename`. */
export function saveFile(data: Blob, filename: string): void {
  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // Revoked later: some browsers read the URL after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
