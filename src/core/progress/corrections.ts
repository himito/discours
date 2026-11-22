/**
 * The user's IPA corrections.
 *
 * @packageDocumentation
 */
import type { WordItem } from '../model'

/** Corrected IPA by word key; a correction applies to every occurrence of the word. */
export type Corrections = Record<string, string>

/** IPA to display for a word: the user's correction if any, else the analyzed IPA. */
export const ipaOf = (word: WordItem, corrections: Corrections): string =>
  corrections[word.key] ?? word.ipa

/**
 * Sets or removes the correction of a word.
 *
 * @param ipa - New IPA; `null`, blank, or the analyzed IPA itself (`analyzed`) removes the
 *   correction.
 */
export function withCorrection(
  corrections: Corrections,
  key: string,
  ipa: string | null,
  analyzed?: string,
): Corrections {
  const next = { ...corrections }
  const value = ipa?.trim() ?? ''
  if (!value || value === analyzed) delete next[key]
  else next[key] = value
  return next
}
