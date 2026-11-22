/**
 * Exporting laid-out pages as a PDF.
 *
 * @packageDocumentation
 */
import type { PageRasterizer } from './PageRasterizer'
import { jpegsToPdf } from './pdfWriter'

/**
 * Renders A4 pages as images and assembles them into a PDF.
 *
 * @remarks The PDF looks exactly like the pages, but its text can't be selected.
 *
 * @param pages - The pages, in order, as the rasterizer understands them.
 * @param onProgress - Called after each page with the number of pages done.
 * @returns The PDF file's bytes.
 */
export async function exportPdf<Page>(
  pages: readonly Page[],
  rasterizer: PageRasterizer<Page>,
  onProgress?: (done: number) => void,
): Promise<Uint8Array> {
  const jpegs: Uint8Array[] = []
  for (const page of pages) {
    jpegs.push(await rasterizer.toJpeg(page))
    onProgress?.(jpegs.length)
  }
  return jpegsToPdf(jpegs)
}
