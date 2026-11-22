/**
 * Writing a PDF made of full-page JPEG images.
 *
 * @remarks One image per A4 page needs only a few PDF objects, so the file is written here
 * directly, without a library. Pure: bytes in, bytes out.
 *
 * @packageDocumentation
 */

/** A4 in PDF points (72 per inch). */
const PAGE_PT = { width: 595.28, height: 841.89 }

/** Size of an image, in pixels. */
export interface ImageSize {
  /** Width, in pixels. */
  width: number
  /** Height, in pixels. */
  height: number
}

/** Reads the pixel size of a JPEG from its first SOF marker. */
export function jpegSize(bytes: Uint8Array): ImageSize {
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
  throw new Error('Unreadable JPEG image')
}

/**
 * Writes a PDF with one A4 page per JPEG, each image filling its page.
 *
 * @param pages - JPEG files, in page order.
 */
export function jpegsToPdf(pages: readonly Uint8Array[]): Uint8Array {
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
  return concat(parts, size)
}

/** Joins byte chunks of total length `size`. */
function concat(parts: readonly Uint8Array[], size: number): Uint8Array {
  const out = new Uint8Array(size)
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}
