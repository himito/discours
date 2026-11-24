/**
 * French definitions from the Wiktionnaire (fr.wiktionary.org).
 *
 * @remarks
 * The page is fetched through the MediaWiki API (`action=parse`, CORS allowed with `origin=*`) and
 * read in the browser: the French section, then for each part of speech (*Nom commun*, *Verbe*…)
 * its numbered definitions and their first example.
 *
 * Inflected forms only point to their base word ("Pluriel de *recherche*", "Première personne du
 * singulier… de *remercier*"): when a page has nothing else, the base word's page is fetched too,
 * and the result says which form it was.
 *
 * Wiktionnaire content is under CC BY-SA: the panel links back to the page. Uses `fetch` and
 * `DOMParser`, so it runs in the browser.
 *
 * @packageDocumentation
 */
import type { Definition, Dictionary, Entry, Sense } from '#core/dictionary/Dictionary'
import type { Nullable } from '#core/types'

/** MediaWiki API of the French Wiktionary. */
const API = 'https://fr.wiktionary.org/w/api.php'
/** Base URL of its pages. */
const PAGE = 'https://fr.wiktionary.org/wiki/'
/** API errors meaning the page does not exist. */
const NO_SUCH_PAGE = new Set(['missingtitle', 'invalidtitle'])
/** Sections under "Français" that are not parts of speech. */
const NOT_PART_OF_SPEECH =
  /^(étymologie|prononciation|voir aussi|références|anagrammes|traductions|homophones|paronymes|variantes|synonymes|antonymes|dérivés|apparentés|hyperonymes|hyponymes|vocabulaire|notes|attestations)/i
/** Elided articles and pronouns before a word: *l'*, *qu'*, *jusqu'*… */
const ELIDED_PREFIX = /^(?:jusqu|lorsqu|puisqu|quoiqu|qu|[cdjlmnst])’(?=\p{L})/iu
/** Quotes and punctuation around a word as written in the speech. */
const SURROUNDING_PUNCTUATION = /^[«“(]+|[»”).,;:!?…]+$/g
/** Parts of speech shown at most. */
const MAX_ENTRIES = 3
/** Meanings shown at most per part of speech. */
const MAX_SENSES = 4
/** Examples longer than this are shortened. */
const MAX_EXAMPLE = 160

/** Looks words up in the French Wiktionary. */
export class WiktionaryDictionary implements Dictionary {
  /** Look-ups of the session, by lower-cased word. */
  private readonly cache = new Map<string, Promise<Nullable<Definition>>>()

  lookup(word: string, signal?: AbortSignal): Promise<Nullable<Definition>> {
    const key = word.toLowerCase()
    const cached = this.cache.get(key)
    if (cached) return cached
    const result = lookUp(word, signal)
    this.cache.set(key, result)
    // Errors (offline, aborted) are not cached: the next look-up tries again.
    result.catch(() => this.cache.delete(key))
    return result
  }

  searchUrl(word: string): string {
    return pageUrl(candidateTitles(word)[0] ?? word)
  }
}

// ---------------------------------------------------------------- titles

/**
 * Link to a Wiktionnaire page.
 *
 * @param title - The page's title.
 * @returns Its URL.
 */
function pageUrl(title: string): string {
  return PAGE + encodeURIComponent(title.replace(/ /g, '_'))
}

/**
 * Page titles to try for a word as written in the speech.
 *
 * @param word - The word, possibly with quotes, punctuation and an elided article.
 * @returns In order: the word in lower case and as written, without an elided article or pronoun
 *   (*l'application* → *application*); then with a straight apostrophe, as some pages are titled.
 */
function candidateTitles(word: string): string[] {
  const typographic = word.replace(/'/g, '’').replace(SURROUNDING_PUNCTUATION, '')
  const bare = typographic.replace(ELIDED_PREFIX, '')
  const titles = [bare.toLowerCase(), bare]
  // Pages use the typographic apostrophe (aujourd’hui); some also exist with the straight one.
  if (bare.includes('’')) titles.push(bare.toLowerCase().replace(/’/g, "'"))
  return [...new Set(titles)].filter((title) => /\p{L}/u.test(title))
}

// ---------------------------------------------------------------- API

/** A Wiktionnaire page, rendered as HTML. */
interface WikiPage {
  /** Its title, after redirects. */
  title: string
  html: string
}

/** What the MediaWiki `parse` action answers. */
interface ParseResponse {
  parse?: { title: string; text: string }
  error?: { code: string; info: string }
}

/**
 * Fetches a page from the MediaWiki API.
 *
 * @param title - The page's title.
 * @param signal - Cancels the request.
 * @returns The page, or `null` if it doesn't exist.
 * @throws On network and API errors, and when `signal` aborts.
 */
async function fetchPage(title: string, signal?: AbortSignal): Promise<Nullable<WikiPage>> {
  const params = new URLSearchParams({
    action: 'parse',
    page: title,
    prop: 'text',
    format: 'json',
    formatversion: '2',
    redirects: '1',
    origin: '*',
  })
  const response = await fetch(`${API}?${params}`, { signal })
  if (!response.ok) throw new Error(`Wiktionnaire : erreur ${response.status}`)
  const data = (await response.json()) as ParseResponse
  if (data.error && NO_SUCH_PAGE.has(data.error.code)) return null
  if (!data.parse) throw new Error(data.error?.info ?? 'Wiktionnaire : réponse inattendue')
  return { title: data.parse.title, html: data.parse.text }
}

// ---------------------------------------------------------------- reading a page

/** A definition that only points to another word: "Pluriel de *recherche*". */
interface Inflection {
  /** The base word: *recherche*. */
  lemma: string
  /** The definition's text: "Pluriel de recherche". */
  label: string
}

/** A meaning read from a page, and the base word it points to if it is an inflected form. */
interface ParsedSense {
  sense: Sense
  inflection: Nullable<Inflection>
}

/** The meanings of one part of speech, as read from a page. */
interface ParsedEntry {
  pos: string
  senses: ParsedSense[]
}

/**
 * Reads the French parts of speech of a page.
 *
 * @param html - The page, as returned by the API.
 * @returns Each part of speech with its meanings, in the page's order; empty if the page has no
 *   French section.
 */
function readFrenchEntries(html: string): ParsedEntry[] {
  const entries: ParsedEntry[] = []
  let partOfSpeech: Nullable<string> = null
  for (const element of frenchSection(html)) {
    const heading = subsectionTitle(element)
    if (heading !== null) {
      partOfSpeech = NOT_PART_OF_SPEECH.test(heading) ? null : heading
    } else if (partOfSpeech && element.tagName === 'OL') {
      // The first numbered list after a part-of-speech title holds its definitions.
      const senses = readSenses(element)
      if (senses.length) entries.push({ pos: partOfSpeech, senses })
      partOfSpeech = null
    }
  }
  return entries
}

/**
 * The elements of the French section of a page, after its heading.
 *
 * @param html - The page, as returned by the API.
 * @returns The section's elements in order, up to the next language's heading.
 */
function* frenchSection(html: string): Generator<Element> {
  const page = new DOMParser().parseFromString(html, 'text/html')
  const heading = page.getElementById('Français')
  const start = heading?.closest('.mw-heading') ?? heading
  for (let element = start?.nextElementSibling; element; element = element.nextElementSibling) {
    if (element.matches('.mw-heading2, h2')) return
    yield element
  }
}

/**
 * The title of a subsection heading (*Nom commun*, *Étymologie*…).
 *
 * @param element - An element of the French section.
 * @returns The title, without its number (*Nom commun 2* → *Nom commun*), or `null` if the
 *   element is not a subsection heading.
 */
function subsectionTitle(element: Element): Nullable<string> {
  const heading = element.matches('.mw-heading3')
    ? element.querySelector('h3')
    : element.matches('h3')
      ? element
      : null
  return heading ? (heading.textContent ?? '').replace(/\s*\d+$/, '').trim() : null
}

/**
 * Reads the meanings of a numbered list of definitions.
 *
 * @param list - The `<ol>` of a part of speech.
 * @returns Its meanings, in order, without empty ones.
 */
function readSenses(list: Element): ParsedSense[] {
  return [...list.querySelectorAll(':scope > li')]
    .map(readSense)
    .filter((parsed): parsed is ParsedSense => parsed !== null)
}

/**
 * Reads one definition and its first example.
 *
 * @param item - An `<li>` of the definitions.
 * @returns The meaning, or `null` if the item has no text.
 */
function readSense(item: Element): Nullable<ParsedSense> {
  const text = ownText(item)
  if (!text) return null
  const example = collapseSpaces(item.querySelector('.example q, .example i')?.textContent ?? '')
  return {
    sense: { text, example: example ? shorten(example) : undefined },
    inflection: inflectionOf(item),
  }
}

/**
 * The base word of a definition that only points to it ("Pluriel de *recherche*").
 *
 * @param item - An `<li>` of the definitions.
 * @returns The base word and the definition's text, or `null` for an ordinary definition.
 */
function inflectionOf(item: Element): Nullable<Inflection> {
  const lead = item.firstElementChild
  if (lead?.tagName !== 'I' || !/\b(?:de|du|d’)\s*$/.test(lead.textContent ?? '')) return null
  const link = lead.nextElementSibling
  if (link?.tagName !== 'A') return null
  const lemma = link.getAttribute('title') ?? link.textContent ?? ''
  return lemma ? { lemma, label: ownText(item).replace(/\.$/, '') } : null
}

/**
 * The text of a definition, without its examples, footnotes and edit links.
 *
 * @param item - An `<li>` of the definitions.
 * @returns The text on one line.
 */
function ownText(item: Element): string {
  const copy = item.cloneNode(true) as Element
  copy.querySelectorAll('ul, ol, dl, sup.reference, .mw-editsection').forEach((n) => n.remove())
  return collapseSpaces(copy.textContent ?? '')
}

/** Text on one line, with single spaces and no space around it. */
const collapseSpaces = (text: string): string => text.replace(/\s+/g, ' ').trim()

/**
 * Cuts an example after about {@link MAX_EXAMPLE} characters, at a word boundary.
 *
 * @param text - The example.
 * @returns It as is if short enough, else shortened and marked with *[…]*.
 */
function shorten(text: string): string {
  if (text.length <= MAX_EXAMPLE) return text
  return text.slice(0, MAX_EXAMPLE).replace(/\s+\S*$/, '') + ' […]'
}

// ---------------------------------------------------------------- definitions

/**
 * Looks a word up: tries each candidate title, and follows inflected forms to their base word.
 *
 * @param word - The word as written in the speech.
 * @param signal - Cancels the requests.
 * @returns The definitions of the first title with French definitions, or `null` if none has any.
 */
async function lookUp(word: string, signal?: AbortSignal): Promise<Nullable<Definition>> {
  for (const title of candidateTitles(word)) {
    const page = await fetchPage(title, signal)
    if (!page) continue
    const entries = readFrenchEntries(page.html)
    if (!entries.length) continue
    const inflection = firstInflection(entries)
    if (inflection && onlyInflections(entries) && inflection.lemma !== page.title) {
      const base = await baseWordDefinition(inflection, signal)
      if (base) return base
    }
    return {
      title: page.title,
      formOf: inflection?.label,
      entries: shortList(withoutInflections(entries)),
      url: pageUrl(page.title),
    }
  }
  return null
}

/**
 * The definitions of the base word an inflected form points to.
 *
 * @param inflection - The inflected form's reference to its base word.
 * @param signal - Cancels the request.
 * @returns The base word's definitions, noting the form, or `null` if its page has none.
 */
async function baseWordDefinition(
  inflection: Inflection,
  signal?: AbortSignal,
): Promise<Nullable<Definition>> {
  const page = await fetchPage(inflection.lemma, signal)
  const entries = page ? readFrenchEntries(page.html) : []
  if (!page || !entries.length) return null
  return {
    title: page.title,
    formOf: inflection.label,
    lemma: page.title,
    entries: shortList(withoutInflections(entries)),
    url: pageUrl(page.title),
  }
}

/** The base word the first inflected definition points to, if any. */
function firstInflection(entries: readonly ParsedEntry[]): Nullable<Inflection> {
  for (const entry of entries)
    for (const { inflection } of entry.senses) if (inflection) return inflection
  return null
}

/** Whether every definition of the page only points to another word. */
function onlyInflections(entries: readonly ParsedEntry[]): boolean {
  return entries.every((entry) => entry.senses.every(({ inflection }) => inflection !== null))
}

/**
 * The page's meanings, without the inflected forms when it also has real definitions: on
 * *recherche*, the conjugated forms of *rechercher* are noise next to the noun's meanings.
 *
 * @param entries - The parts of speech read from the page.
 * @returns The parts of speech with their meanings; those left empty are dropped.
 */
function withoutInflections(entries: readonly ParsedEntry[]): Entry[] {
  const keepAll = onlyInflections(entries)
  return entries
    .map(({ pos, senses }) => ({
      pos,
      senses: senses.filter(({ inflection }) => keepAll || !inflection).map(({ sense }) => sense),
    }))
    .filter((entry) => entry.senses.length)
}

/**
 * Keeps the first parts of speech and meanings, enough for a quick look.
 *
 * @param entries - All the parts of speech.
 * @returns At most {@link MAX_ENTRIES} parts of speech of at most {@link MAX_SENSES} meanings.
 */
function shortList(entries: readonly Entry[]): Entry[] {
  return entries.slice(0, MAX_ENTRIES).map((e) => ({ ...e, senses: e.senses.slice(0, MAX_SENSES) }))
}
