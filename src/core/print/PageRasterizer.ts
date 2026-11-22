/**
 * Port: turning a laid-out page into an image, for the PDF export.
 *
 * @packageDocumentation
 */

/**
 * Renders pages as JPEG images.
 *
 * @remarks Implemented by `HtmlToImageRasterizer` for DOM elements. The core never sees the page
 * type: it only passes pages from the UI to the rasterizer.
 *
 * @typeParam Page - What a page is for this rasterizer (an `HTMLElement` in the browser).
 */
export interface PageRasterizer<Page> {
  /**
   * Renders an A4 page.
   *
   * @returns The JPEG file's bytes.
   */
  toJpeg(page: Page): Promise<Uint8Array>
}
