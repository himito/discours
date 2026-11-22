/**
 * Names of the exported files.
 *
 * @packageDocumentation
 */

/** A title as a file-name part: lower case, no accents, dashes between words. */
export function slug(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Name of the PDF: `discours.pdf`, `discours-fiches.pdf`, `discours-2-conclusion-fiches.pdf`…
 *
 * @param section - The single section exported, if not the whole speech.
 * @param cards - Whether the cards template is used.
 */
export function pdfFileName(section: { number: number; title: string } | null, cards: boolean) {
  const parts = ['discours']
  if (section) parts.push(String(section.number), slug(section.title))
  if (cards) parts.push('fiches')
  return parts.filter(Boolean).join('-') + '.pdf'
}
