/**
 * French definitions from the Wiktionnaire (fr.wiktionary.org).
 *
 * @remarks
 * The page is fetched through the MediaWiki API (`action=parse`, CORS allowed with `origin=*`) and
 * read in the browser: the French section, then for each part of speech (*Nom commun*, *Verbe*…)
 * its numbered definitions and their first example.
 *
 * Inflected forms only point to their base word ("Pluriel de *recherche*", "Première personne du
 * singulier… de *remercier*"): in that case the base word's page is fetched too, and the result
 * says which form it was.
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
/** Sections under "Français" that are not parts of speech. */
const NOT_POS =
  /^(étymologie|prononciation|voir aussi|références|anagrammes|traductions|homophones|paronymes|variantes|synonymes|antonymes|dérivés|apparentés|hyperonymes|hyponymes|vocabulaire|notes|attestations)/i
/** Parts of speech shown at most. */
const MAX_ENTRIES = 3
/** Meanings shown at most per part of speech. */
const MAX_SENSES = 4
/** Examples longer than this are shortened. */
const MAX_EXAMPLE = 160

/** Link to the Wiktionnaire page of `title`. */
const pageUrl = (title: string) => PAGE + encodeURIComponent(title.replace(/ /g, '_'))

/**
 * Page titles to try for a word as written in the speech: as is, without an elided article or
 * pronoun (*l'application* → *application*), and in lower case.
 */
function candidates(word: string): string[] {
  const w = word.replace(/'/g, '’').replace(/^[«“(]+|[»”).,;:!?…]+$/g, '')
  const bare = w.replace(/^(?:jusqu|lorsqu|puisqu|quoiqu|qu|[cdjlmnst])’(?=\p{L})/iu, '')
  const out = [bare.toLowerCase(), bare]
  // Pages use the typographic apostrophe (aujourd’hui); some also exist with the straight one.
  if (bare.includes('’')) out.push(bare.toLowerCase().replace(/’/g, "'"))
  return [...new Set(out)].filter((t) => /\p{L}/u.test(t))
}

/** The Wiktionnaire page rendered as HTML, or `null` if it doesn't exist. */
async function fetchPage(
  title: string,
  signal?: AbortSignal,
): Promise<Nullable<{ title: string; html: string }>> {
  const params = new URLSearchParams({
    action: 'parse',
    page: title,
    prop: 'text',
    format: 'json',
    formatversion: '2',
    redirects: '1',
    origin: '*',
  })
  const res = await fetch(`${API}?${params}`, { signal })
  if (!res.ok) throw new Error(`Wiktionnaire : erreur ${res.status}`)
  const data = (await res.json()) as {
    parse?: { title: string; text: string }
    error?: { code: string; info: string }
  }
  if (data.error?.code === 'missingtitle' || data.error?.code === 'invalidtitle') return null
  if (!data.parse) throw new Error(data.error?.info ?? 'Wiktionnaire : réponse inattendue')
  return { title: data.parse.title, html: data.parse.text }
}

/** Text of an element without its sub-lists (examples), footnotes and edit links. */
function ownText(li: Element): string {
  const copy = li.cloneNode(true) as Element
  copy.querySelectorAll('ul, ol, dl, sup.reference, .mw-editsection').forEach((n) => n.remove())
  return copy.textContent!.replace(/\s+/g, ' ').trim()
}

/**
 * If a definition only points to another word ("Pluriel de *recherche*"), returns that word and
 * the description.
 */
function formOf(li: Element): Nullable<{ lemma: string; label: string }> {
  const first = li.firstElementChild
  if (first?.tagName !== 'I' || !/\b(?:de|du|d’)\s*$/.test(first.textContent ?? '')) return null
  const link = first.nextElementSibling
  if (link?.tagName !== 'A') return null
  const lemma = link.getAttribute('title') ?? link.textContent ?? ''
  return lemma ? { lemma, label: ownText(li).replace(/\.$/, '') } : null
}

/** Reads the French parts of speech of a page. */
function parseFrench(html: string): {
  entries: Entry[]
  forms: { lemma: string; label: string }[]
} {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const heading = doc.getElementById('Français')
  const start = heading?.closest('.mw-heading') ?? heading
  const entries: Entry[] = []
  const forms: { lemma: string; label: string }[] = []
  const formSenses = new Set<Sense>()
  let pos: Nullable<string> = null
  for (let el = start?.nextElementSibling; el; el = el.nextElementSibling) {
    if (el.matches('.mw-heading2, h2')) break
    const h3 = el.matches('.mw-heading3') ? el.querySelector('h3') : el.matches('h3') ? el : null
    if (h3) {
      const title = (h3.textContent ?? '').replace(/\s*\d+$/, '').trim()
      pos = NOT_POS.test(title) ? null : title
      continue
    }
    // The first numbered list after a part-of-speech title holds its definitions.
    if (pos && el.tagName === 'OL') {
      const senses: Sense[] = []
      for (const li of el.querySelectorAll(':scope > li')) {
        const form = formOf(li)
        if (form) forms.push(form)
        const text = ownText(li)
        if (!text) continue
        const ex = li
          .querySelector('.example q, .example i')
          ?.textContent?.replace(/\s+/g, ' ')
          .trim()
        const sense: Sense = { text, example: ex ? shorten(ex) : undefined }
        if (form) formSenses.add(sense)
        senses.push(sense)
      }
      if (senses.length) entries.push({ pos, senses })
      pos = null
    }
  }
  return { entries: dropForms(entries, formSenses), forms }
}

/** Cuts an example after about {@link MAX_EXAMPLE} characters, at a word boundary. */
function shorten(text: string): string {
  if (text.length <= MAX_EXAMPLE) return text
  return text.slice(0, MAX_EXAMPLE).replace(/\s+\S*$/, '') + ' […]'
}

/**
 * Removes "form of …" definitions when the page also has real ones: on *recherche*, the
 * conjugated forms of *rechercher* are noise next to the noun's meanings.
 */
function dropForms(entries: Entry[], formSenses: Set<Sense>): Entry[] {
  const real = entries.some((e) => e.senses.some((s) => !formSenses.has(s)))
  if (!real) return entries
  return entries
    .map((e) => ({ ...e, senses: e.senses.filter((s) => !formSenses.has(s)) }))
    .filter((e) => e.senses.length)
}

/** Keeps the first entries and senses, enough for a quick look. */
const trim = (entries: Entry[]) =>
  entries.slice(0, MAX_ENTRIES).map((e) => ({ ...e, senses: e.senses.slice(0, MAX_SENSES) }))

/** Tries each candidate title, and follows inflected forms to their base word. */
async function find(word: string, signal?: AbortSignal): Promise<Nullable<Definition>> {
  for (const title of candidates(word)) {
    const page = await fetchPage(title, signal)
    if (!page) continue
    const { entries, forms } = parseFrench(page.html)
    if (!entries.length) continue
    // Every definition is "form of …" (none was dropped): show the base word instead.
    const total = entries.reduce((n, e) => n + e.senses.length, 0)
    const lemma = forms[0]
    if (lemma && forms.length === total && lemma.lemma !== page.title) {
      const base = await fetchPage(lemma.lemma, signal)
      const parsed = base && parseFrench(base.html)
      if (base && parsed?.entries.length)
        return {
          title: base.title,
          formOf: lemma.label,
          lemma: base.title,
          entries: trim(parsed.entries),
          url: pageUrl(base.title),
        }
    }
    return {
      title: page.title,
      formOf: lemma?.label,
      entries: trim(entries),
      url: pageUrl(page.title),
    }
  }
  return null
}

/** Looks words up in the French Wiktionary. */
export class WiktionaryDictionary implements Dictionary {
  /** Look-ups of the session, by lower-cased word. */
  private readonly cache = new Map<string, Promise<Nullable<Definition>>>()

  lookup(word: string, signal?: AbortSignal): Promise<Nullable<Definition>> {
    const key = word.toLowerCase()
    let hit = this.cache.get(key)
    if (!hit) {
      hit = find(word, signal)
      this.cache.set(key, hit)
      // Errors (offline, aborted) are not cached: the next look-up tries again.
      hit.catch(() => this.cache.delete(key))
    }
    return hit
  }

  searchUrl(word: string): string {
    return pageUrl(candidates(word)[0] ?? word)
  }
}
