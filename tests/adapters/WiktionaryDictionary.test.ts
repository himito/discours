// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WiktionaryDictionary } from '#adapters/wiktionary/WiktionaryDictionary'

/** A French section in the Wiktionnaire's HTML structure. */
function frenchPage(...sections: [title: string, definitions: string[]][]): string {
  const body = sections
    .map(
      ([title, definitions]) =>
        `<div class="mw-heading mw-heading3"><h3>${title}</h3></div>` +
        `<ol>${definitions.map((d) => `<li>${d}</li>`).join('')}</ol>`,
    )
    .join('')
  return (
    `<div class="mw-heading mw-heading2"><h2 id="Français">Français</h2></div>${body}` +
    `<div class="mw-heading mw-heading2"><h2 id="Anglais">Anglais</h2></div>` +
    `<div class="mw-heading mw-heading3"><h3>Nom commun</h3></div><ol><li>English meaning.</li></ol>`
  )
}

const example = (text: string) => `<ul><li><span class="example"><q>${text}</q></span></li></ul>`
const pluralOf = (lemma: string) => `<i>Pluriel de</i> <a title="${lemma}">${lemma}</a>.`

/** Pages by title; any other title does not exist. */
const PAGES: Record<string, string> = {
  jury: frenchPage(
    ['Étymologie', ['Du latin…']],
    ['Nom commun', [`Ensemble des jurés.${example('Le jury délibère.')}`, 'Commission d’examen.']],
  ),
  application: frenchPage(['Nom commun', ['Action d’appliquer.']]),
  recherches: frenchPage(['Forme de nom commun', [pluralOf('recherche')]]),
  recherche: frenchPage(['Nom commun', ['Action de rechercher.', 'Travaux de science.']]),
  liaisons: frenchPage([
    'Forme de nom commun',
    [pluralOf('liaison'), 'Relations, fréquentations.'],
  ]),
  liaison: frenchPage(['Nom commun', ['Union, jonction.']]),
  long: frenchPage(
    ['Nom commun', ['1', '2', '3', '4', '5', `6${example('mot '.repeat(60))}`]],
    ['Adjectif', ['a']],
    ['Adverbe', ['b']],
    ['Verbe', ['c']],
  ),
}

/** Answers like the MediaWiki API, from {@link PAGES}. */
function fakeFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const title = new URL(String(input)).searchParams.get('page') ?? ''
    const html = PAGES[title]
    const body = html
      ? { parse: { title, text: html } }
      : { error: { code: 'missingtitle', info: 'The page you specified does not exist.' } }
    return new Response(JSON.stringify(body), { status: 200 })
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('WiktionaryDictionary', () => {
  it('reads the French parts of speech, with an example, skipping other sections', async () => {
    vi.stubGlobal('fetch', fakeFetch())
    const definition = await new WiktionaryDictionary().lookup('Jury,')
    expect(definition).toEqual({
      title: 'jury',
      formOf: undefined,
      entries: [
        {
          pos: 'Nom commun',
          senses: [
            { text: 'Ensemble des jurés.', example: 'Le jury délibère.' },
            { text: 'Commission d’examen.', example: undefined },
          ],
        },
      ],
      url: 'https://fr.wiktionary.org/wiki/jury',
    })
  })

  it('looks the word up without its elided article', async () => {
    const fetch = fakeFetch()
    vi.stubGlobal('fetch', fetch)
    expect((await new WiktionaryDictionary().lookup("l'application"))?.title).toBe('application')
  })

  it('shows the base word of a page that only has inflected forms', async () => {
    vi.stubGlobal('fetch', fakeFetch())
    const definition = await new WiktionaryDictionary().lookup('recherches')
    expect(definition).toMatchObject({
      title: 'recherche',
      lemma: 'recherche',
      formOf: 'Pluriel de recherche',
      entries: [{ pos: 'Nom commun', senses: [{ text: 'Action de rechercher.' }, {}] }],
    })
  })

  it('keeps a page’s own meanings next to an inflected form', async () => {
    vi.stubGlobal('fetch', fakeFetch())
    const definition = await new WiktionaryDictionary().lookup('liaisons')
    expect(definition).toMatchObject({
      title: 'liaisons',
      formOf: 'Pluriel de liaison',
      entries: [{ pos: 'Forme de nom commun', senses: [{ text: 'Relations, fréquentations.' }] }],
    })
    expect(definition?.lemma).toBeUndefined()
  })

  it('keeps a short list, and shortens long examples', async () => {
    vi.stubGlobal('fetch', fakeFetch())
    const definition = await new WiktionaryDictionary().lookup('long')
    expect(definition?.entries.map((e) => [e.pos, e.senses.length])).toEqual([
      ['Nom commun', 4],
      ['Adjectif', 1],
      ['Adverbe', 1],
    ])
  })

  it('returns null for a word without a page', async () => {
    vi.stubGlobal('fetch', fakeFetch())
    expect(await new WiktionaryDictionary().lookup('xyzzy')).toBeNull()
  })

  it('caches answers, but not errors', async () => {
    const fetch = fakeFetch()
    vi.stubGlobal('fetch', fetch)
    const dictionary = new WiktionaryDictionary()
    await dictionary.lookup('jury')
    await dictionary.lookup('JURY')
    expect(fetch).toHaveBeenCalledTimes(1)

    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(dictionary.lookup('application')).rejects.toThrow('Failed to fetch')
    expect((await dictionary.lookup('application'))?.title).toBe('application')
  })

  it('reports HTTP errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 429 })),
    )
    await expect(new WiktionaryDictionary().lookup('jury')).rejects.toThrow('erreur 429')
  })

  it('links to the page to search by hand', () => {
    expect(new WiktionaryDictionary().searchUrl("l'école,")).toBe(
      'https://fr.wiktionary.org/wiki/%C3%A9cole',
    )
  })
})
