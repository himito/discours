/**
 * Paper and image sizes.
 *
 * @remarks The templates, their capture and the PDF all use A4. It is defined once, in
 * millimetres, and converted to the unit each step needs.
 *
 * @packageDocumentation
 */

/** A width and a height, in some unit. */
export interface Size {
  /** Horizontal extent. */
  width: number
  /** Vertical extent. */
  height: number
}

/** Millimetres in an inch. */
const MM_PER_INCH = 25.4

/** A4 paper, in millimetres. */
export const A4_MM: Size = { width: 210, height: 297 }

/**
 * A4 in a unit defined by its number per inch.
 *
 * @param unitsPerInch - 72 for PDF points, 96 for CSS pixels.
 * @param decimals - Digits kept after rounding.
 * @returns The A4 size in that unit.
 */
function a4In(unitsPerInch: number, decimals: number): Size {
  const convert = (mm: number) => {
    const exact = (mm / MM_PER_INCH) * unitsPerInch
    return Math.round(exact * 10 ** decimals) / 10 ** decimals
  }
  return { width: convert(A4_MM.width), height: convert(A4_MM.height) }
}

/** A4 in PDF points (72 per inch): 595.28 × 841.89. */
export const A4_POINTS: Size = a4In(72, 2)

/** A4 in CSS pixels (96 per inch), rounded to whole pixels: 794 × 1123. */
export const A4_CSS_PIXELS: Size = a4In(96, 0)
