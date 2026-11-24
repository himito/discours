/**
 * {@link PageRasterizer} for DOM elements, with `html-to-image`.
 *
 * @remarks The browser renders the element into an SVG, then a canvas, so every CSS feature of the
 * templates is kept, vertical text included.
 *
 * @packageDocumentation
 */
import { getFontEmbedCSS, toJpeg } from 'html-to-image'
import type { PageRasterizer } from '#core/print/PageRasterizer'
import { A4_CSS_PIXELS } from '#core/print/paper'

/** Capture resolution: 2.5 × 96 = 240 dpi, sharp in print and about 300 KB per page. */
const PIXEL_RATIO = 2.5

/** Captures A4 page elements as JPEG images. */
export class HtmlToImageRasterizer implements PageRasterizer<HTMLElement> {
  /** Web fonts as CSS, embedded once for all pages; `''` to use system fonts. */
  private fonts: Promise<string> | undefined

  async toJpeg(page: HTMLElement): Promise<Uint8Array> {
    this.fonts ??= embeddableFonts(page)
    const fontEmbedCSS = await this.fonts
    const url = await toJpeg(page, {
      ...A4_CSS_PIXELS,
      pixelRatio: PIXEL_RATIO,
      quality: 0.9,
      backgroundColor: '#ffffff',
      fontEmbedCSS,
      skipFonts: !fontEmbedCSS,
      // The preview is scaled down and has shadows; the capture must not.
      style: { zoom: '1', boxShadow: 'none', margin: '0' },
    })
    return dataUrlBytes(url)
  }
}

/**
 * The page's web fonts as embeddable CSS.
 *
 * @remarks Without a connection the web fonts can't be fetched: `''` then, and the system fonts
 * the page already falls back to are used.
 */
async function embeddableFonts(page: HTMLElement): Promise<string> {
  try {
    return await getFontEmbedCSS(page)
  } catch {
    return ''
  }
}

/** Decodes a `data:` URL into its bytes. */
function dataUrlBytes(url: string): Uint8Array {
  const bin = atob(url.slice(url.indexOf(',') + 1))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}
