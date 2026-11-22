/**
 * Port: French definitions of a word.
 *
 * @packageDocumentation
 */

/** A meaning of the word. */
export interface Sense {
  /** The definition, with its labels: "(Informatique) Programme…". */
  text: string
  /** An example sentence, if any. */
  example?: string
}

/** The meanings for one part of speech. */
export interface Entry {
  /** Part of speech, as titled by the source: "Nom commun", "Verbe", "Adjectif"… */
  pos: string
  /** Meanings, in the source's order. */
  senses: Sense[]
}

/** What the dictionary knows about a word. */
export interface Definition {
  /** Headword the definitions come from (the base word for an inflected form). */
  title: string
  /** For an inflected form: how the source describes it, e.g. "Pluriel de recherche". */
  formOf?: string
  /** Set when the definitions are those of the base word. */
  lemma?: string
  /** Definitions grouped by part of speech. */
  entries: Entry[]
  /** Where to read the full entry. */
  url: string
}

/**
 * Looks up French words.
 *
 * @remarks Implemented by `WiktionaryDictionary` (fr.wiktionary.org).
 */
export interface Dictionary {
  /**
   * Looks up a word as written in the speech (with elisions, capitals…).
   *
   * @returns The definitions, or `null` if the word has no entry.
   * @throws On network errors, and when `signal` aborts.
   */
  lookup(word: string, signal?: AbortSignal): Promise<Definition | null>
  /** Where to search for the word by hand. */
  searchUrl(word: string): string
}
