/**
 * Filling fixed-size pages with blocks of known heights.
 *
 * @packageDocumentation
 */

/** The room on a page. */
export interface PageBox {
  /** Height available for blocks. */
  height: number
  /** Space between two blocks. */
  gap: number
}

/**
 * Splits blocks into pages, keeping their order: each page takes as many blocks as fit.
 *
 * @remarks A block taller than a page gets a page of its own (it will overflow). A block marked by
 * `keepWithNext` (a title) is never the last of a page: it moves to the next page with the block
 * after it.
 *
 * @param heights - Height of each block, in the same unit as `box`.
 * @returns The blocks of each page; at least one page, possibly empty.
 */
export function fillPages<T>(
  blocks: readonly T[],
  heights: readonly number[],
  box: PageBox,
  keepWithNext: (block: T) => boolean = () => false,
): T[][] {
  const pages: T[][] = [[]]
  let used = 0
  blocks.forEach((block, i) => {
    const height = heights[i] ?? 0
    const companion = keepWithNext(block) ? box.gap + (heights[i + 1] ?? 0) : 0
    const page = pages.at(-1)!
    const needed = page.length ? used + box.gap + height : height
    if (page.length && needed + companion > box.height) {
      pages.push([block])
      used = height
    } else {
      page.push(block)
      used = needed
    }
  })
  return pages
}

/** Groups items two by two (two cards per sheet). */
export function pairs<T>(items: readonly T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2))
  return out
}
