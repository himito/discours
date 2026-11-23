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

/** Marker at the start of every JPEG file (SOI). */
const START_OF_IMAGE = 0xffd8
/** First byte of every segment marker. */
const MARKER_PREFIX = 0xff
/** Markers in the frame header range (SOF0–SOF15) that are not frame headers. */
const NOT_FRAME_HEADERS = new Set([0xc4 /* DHT */, 0xc8 /* JPG */, 0xcc /* DAC */])
/**
 * Byte offsets in a frame header segment: marker (2 bytes), length (2), sample precision (1),
 * height (2), width (2).
 */
const FRAME_HEADER = { height: 5, width: 7, size: 9 }

/** A segment of a JPEG file: its marker, and where it starts. */
interface Segment {
  marker: number
  offset: number
}

/**
 * Reads the pixel size of a JPEG from its frame header.
 *
 * @throws If the bytes are not a JPEG file, or are damaged or truncated before the frame header.
 */
export function jpegSize(bytes: Uint8Array): ImageSize {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (const segment of segments(data))
    if (isFrameHeader(segment.marker)) return frameSize(data, segment.offset)
  throw unreadable('no frame header')
}

/**
 * The segments of a JPEG file, after its start-of-image marker.
 *
 * @remarks Each segment is `0xFF`, a marker byte, then its length on 2 bytes (big-endian, counting
 * the length itself but not the marker).
 */
function* segments(data: DataView): Generator<Segment> {
  if (data.byteLength < 2 || data.getUint16(0) !== START_OF_IMAGE)
    throw unreadable('not a JPEG file')
  let offset = 2
  while (offset + 4 <= data.byteLength) {
    if (data.getUint8(offset) !== MARKER_PREFIX) throw unreadable('damaged segment')
    yield { marker: data.getUint8(offset + 1), offset }
    offset += 2 + data.getUint16(offset + 2)
  }
}

/** Whether a marker starts a frame header (SOF), which holds the image size. */
function isFrameHeader(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && !NOT_FRAME_HEADERS.has(marker)
}

/** Reads the size from the frame header segment at `offset`. */
function frameSize(data: DataView, offset: number): ImageSize {
  if (offset + FRAME_HEADER.size > data.byteLength) throw unreadable('truncated frame header')
  return {
    width: data.getUint16(offset + FRAME_HEADER.width),
    height: data.getUint16(offset + FRAME_HEADER.height),
  }
}

/** The error for a file whose size can't be read. */
const unreadable = (reason: string) => new Error(`Unreadable JPEG image: ${reason}`)

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
