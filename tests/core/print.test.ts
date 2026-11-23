import { describe, expect, it } from 'vitest'
import type { PageRasterizer } from '#core/print/PageRasterizer'
import { exportPdf } from '#core/print/exportPdf'
import { pdfFileName, slug } from '#core/print/fileName'
import { fillPages, pairs } from '#core/print/pagination'
import { jpegSize, jpegsToPdf } from '#core/print/pdfWriter'

/** The smallest byte sequence `jpegSize` can read: SOI, then a SOF0 segment. */
function fakeJpeg(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
  ])
}

describe('pagination', () => {
  const box = { height: 100, gap: 10 }

  it('fills pages in order', () => {
    expect(fillPages(['a', 'b', 'c'], [40, 40, 40], box)).toEqual([['a', 'b'], ['c']])
  })

  it('gives an oversized block its own page', () => {
    expect(fillPages(['a', 'big', 'b'], [20, 150, 20], box)).toEqual([['a'], ['big'], ['b']])
  })

  it('keeps a title with the next block', () => {
    const blocks = ['p1', 'title', 'p2']
    expect(fillPages(blocks, [60, 20, 40], box, (b) => b === 'title')).toEqual([
      ['p1'],
      ['title', 'p2'],
    ])
  })

  it('pairs cards for sheets', () => {
    expect(pairs([1, 2, 3])).toEqual([[1, 2], [3]])
  })
})

describe('file names', () => {
  it('slugs titles', () => {
    expect(slug('Résultats & perspectives !')).toBe('resultats-perspectives')
  })

  it('names the PDF after its content', () => {
    expect(pdfFileName(null, false)).toBe('discours.pdf')
    expect(pdfFileName({ number: 2, title: 'Conclusion' }, true)).toBe(
      'discours-2-conclusion-fiches.pdf',
    )
  })
})

describe('PDF', () => {
  it('reads JPEG sizes', () => {
    expect(jpegSize(fakeJpeg(640, 480))).toEqual({ width: 640, height: 480 })
    expect(() => jpegSize(new Uint8Array([0xff, 0xd8]))).toThrow()
  })

  it('writes one page per image', () => {
    const pdf = new TextDecoder('latin1').decode(jpegsToPdf([fakeJpeg(10, 10), fakeJpeg(10, 10)]))
    expect(pdf.startsWith('%PDF-1.4')).toBe(true)
    expect(pdf).toContain('/Count 2')
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true)
  })

  it('exports pages through the rasterizer, reporting progress', async () => {
    const rasterizer: PageRasterizer<string> = { toJpeg: async () => fakeJpeg(10, 10) }
    const progress: number[] = []
    const pdf = await exportPdf(['a', 'b', 'c'], rasterizer, (done) => progress.push(done))
    expect(progress).toEqual([1, 2, 3])
    expect(new TextDecoder('latin1').decode(pdf)).toContain('/Count 3')
  })
})
