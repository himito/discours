/**
 * PDF export of the print templates: each page is captured as an image and the images are
 * assembled into an A4 PDF.
 *
 * @remarks The PDF looks exactly like the preview, but its text can't be selected. Pages are
 * captured with `html-to-image` (the browser renders the page into an SVG, then a canvas), so
 * every CSS feature of the templates is kept, vertical text included. The PDF itself is written
 * here: one JPEG per page needs only a few objects, no library.
 *
 * @packageDocumentation
 */
import { getFontEmbedCSS, toJpeg } from 'html-to-image'

/** A4 in CSS pixels (96 per inch): 210 × 297 mm. */
const PAGE_PX = { width: 794, height: 1123 }
/** A4 in PDF points (72 per inch). */
const PAGE_PT = { width: 595.28, height: 841.89 }
/** Capture resolution: 2.5 × 96 = 240 dpi, sharp in print and about 300 KB per page. */
const PIXEL_RATIO = 2.5

/** Decodes a `data:` URL into its bytes. */
function dataUrlBytes(url: string): Uint8Array {
  const bin = atob(url.slice(url.indexOf(',') + 1))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/** Reads the pixel size of a JPEG from its first SOF marker. */
function jpegSize(bytes: Uint8Array): { width: number; height: number } {
  let i = 2
  while (i < bytes.length) {
    const marker = bytes[i + 1]!
    const length = (bytes[i + 2]! << 8) | bytes[i + 3]!
    // SOF0–SOF15, except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
      return {
        height: (bytes[i + 5]! << 8) | bytes[i + 6]!,
        width: (bytes[i + 7]! << 8) | bytes[i + 8]!,
      }
    i += 2 + length
  }
  throw new Error('Image JPEG illisible')
}

/**
 * Writes a PDF with one A4 page per JPEG, each image filling its page.
 *
 * @param pages - JPEG files, in page order.
 */
export function jpegsToPdf(pages: Uint8Array[]): Blob {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let size = 0
  const write = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === 'string' ? enc.encode(chunk) : chunk
    parts.push(bytes)
    size += bytes.length
  }
  /** Starts object `n`, remembering where it is for the cross-reference table. */
  const obj = (n: number, body: string) => {
    offsets[n] = size
    write(`${n} 0 obj\n${body}\nendobj\n`)
  }

  // Objects: 1 catalog, 2 page tree, then per page: page, content stream, image.
  const pageIds = pages.map((_, i) => 3 + i * 3)
  write('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  obj(
    2,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  )
  const { width: W, height: H } = PAGE_PT
  pages.forEach((jpeg, i) => {
    const [page, content, image] = [pageIds[i]!, pageIds[i]! + 1, pageIds[i]! + 2]
    const { width, height } = jpegSize(jpeg)
    obj(
      page,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] ` +
        `/Resources << /XObject << /Im0 ${image} 0 R >> >> /Contents ${content} 0 R >>`,
    )
    const draw = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`
    obj(content, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`)
    offsets[image] = size
    write(
      `${image} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    )
    write(jpeg)
    write('\nendstream\nendobj\n')
  })

  const count = 3 + pages.length * 3
  const xref = size
  write(`xref\n0 ${count}\n0000000000 65535 f \n`)
  for (let n = 1; n < count; n++) write(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`)
  write(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return new Blob(parts as BlobPart[], { type: 'application/pdf' })
}

/**
 * Captures A4 page elements and returns them as a PDF.
 *
 * @param pages - Elements of exactly 210 × 297 mm, in order.
 * @param onProgress - Called after each page with the number of pages done.
 */
export async function pagesToPdf(
  pages: HTMLElement[],
  onProgress?: (done: number) => void,
): Promise<Blob> {
  // Fonts are embedded once for all pages. Without a connection (offline copy) the web fonts
  // can't be fetched: the system fonts the page already falls back to are used.
  let fontEmbedCSS = ''
  try {
    if (pages[0]) fontEmbedCSS = await getFontEmbedCSS(pages[0])
  } catch {
    /* keep system fonts */
  }
  const jpegs: Uint8Array[] = []
  for (const [i, el] of pages.entries()) {
    const url = await toJpeg(el, {
      ...PAGE_PX,
      pixelRatio: PIXEL_RATIO,
      quality: 0.9,
      backgroundColor: '#ffffff',
      fontEmbedCSS,
      skipFonts: !fontEmbedCSS,
      // The preview is scaled down and has shadows; the capture must not.
      style: { zoom: '1', boxShadow: 'none', margin: '0' },
    })
    jpegs.push(dataUrlBytes(url))
    onProgress?.(i + 1)
  }
  return jpegsToPdf(jpegs)
}
