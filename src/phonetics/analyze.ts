/**
 * Phonetic analysis of a French speech.
 *
 * @remarks
 * {@link analyzeText} turns raw text into paragraphs of {@link Item | items}. Each word carries its
 * IPA transcription split into syllables, how it links to the next word (liaison or enchaînement),
 * and the keys used to compare it with speech recognition output.
 *
 * Pipeline:
 *
 * 1. {@link parseText} splits the text into paragraphs, sentences and tokens.
 * 2. {@link normalizeSentence} rewrites what eSpeak-NG reads badly and keeps a character map.
 * 3. The eSpeak worker returns, for every phoneme, the position of the word that produced it.
 *    Phonemes are grouped per token through that map.
 * 4. The IPA comes from the hand-checked lexicon ({@link lexiconIpa}) when it knows the word, and from
 *    eSpeak otherwise ({@link syllabify}).
 * 5. Liaisons are found by comparing each word in context with the same word pronounced alone.
 *
 * @packageDocumentation
 */
import type { PhonemeTrace, PhonemizeRequest, PhonemizeResponse } from './espeak'
import { lexiconIpa } from './lexicon'
import { normalizeSentence, normalizeWord, parseText, type Token } from './normalize'

/**
 * How a word is linked to the next one when spoken.
 *
 * - `liaison`: a normally silent final consonant is pronounced before the next vowel
 *   (*les‿z enfants*, *sont‿t arrivés*).
 * - `enchainement`: a pronounced final consonant moves to the next vowel (*avec‿elle*).
 */
export type LinkType = 'liaison' | 'enchainement'

/** A word of the speech, with its pronunciation. */
export interface WordItem {
  kind: 'word'
  /** Original text of the word, as written in the speech. */
  text: string
  /** Whitespace that follows the word in the original text. */
  space: string
  /**
   * IPA transcription split into syllables with dots (`a.bɔʁ`), without slashes.
   *
   * @remarks The liaison consonant is not included: it is in {@link WordItem.liaison}.
   */
  ipa: string
  /** How this word links to the next one, or `null`. */
  link: LinkType | null
  /** The consonant added by a liaison (`z`, `t`, `n`, `p`, `ʁ`…), or `''`. */
  liaison: string
  /** Key of the user's IPA corrections for this word (see {@link wordKey}). */
  key: string
  /** Forms compared with speech recognition output (see {@link matchKeys}). */
  match: string[]
  /**
   * `true` for acronyms and alphanumeric terms (CNRS, FAIR4RS). They are shown and checked, but
   * not counted in the reading score: recognizers transcribe them unpredictably.
   */
  tech: boolean
  /** Where {@link WordItem.ipa} comes from: the hand-checked lexicon or eSpeak-NG. */
  source: 'lexique' | 'espeak'
}

/** Punctuation (`punct`) or a reading mark written in the speech (`mark`: `/`, `//`, `[→]`). */
export interface OtherItem {
  kind: 'punct' | 'mark'
  /** Original text of the token. */
  text: string
  /** Whitespace that follows the token in the original text. */
  space: string
}

/** One token of a paragraph. */
export type Item = WordItem | OtherItem

/** A paragraph of the speech, ready to be displayed and practised. */
export interface AnalyzedParagraph {
  /**
   * Id derived from a hash of the paragraph text.
   *
   * @remarks Stays the same across sessions as long as the text doesn't change. Best scores are
   * remembered under this id.
   */
  id: string
  /** Title of the section the paragraph belongs to (a `# Title` line above it), or `''`. */
  section: string
  /** Original text of the paragraph. */
  text: string
  /** Words, punctuation and reading marks, in order. */
  items: Item[]
}

// ---------------------------------------------------------------- worker plumbing

/** Sends a request to eSpeak and returns its answer. */
type Engine = (req: PhonemizeRequest) => Promise<PhonemizeResponse>

let engine: Promise<Engine> | undefined

/**
 * Starts eSpeak: in a web worker normally, directly in the page in the offline build (Chrome won't
 * start a worker from a page opened from disk, and fails silently).
 */
async function createEngine(): Promise<Engine> {
  if (import.meta.env.MODE === 'offline') {
    const { handleRequest } = await import('./espeak')
    return handleRequest
  }
  const worker = new Worker(new URL('./espeak.worker.ts', import.meta.url), { type: 'module' })
  const pending = new Map<number, (r: PhonemizeResponse) => void>()
  worker.onmessage = (e: MessageEvent<PhonemizeResponse>) => {
    pending.get(e.data.id)?.(e.data)
    pending.delete(e.data.id)
  }
  return (req) =>
    new Promise((resolve) => {
      pending.set(req.id, resolve)
      worker.postMessage(req)
    })
}

let nextId = 1

/**
 * Phonemizes several texts with eSpeak.
 *
 * @param texts - Texts to phonemize (already normalized).
 * @returns One phoneme trace per text, in the same order.
 */
async function phonemize(texts: string[]): Promise<PhonemeTrace[]> {
  engine ??= createEngine()
  const res = await (await engine)({ id: nextId++, texts })
  if ('error' in res) throw new Error(res.error)
  return res.results
}

/**
 * Starts loading eSpeak-NG in the background.
 *
 * @remarks Call it when the app starts: the first analysis then doesn't wait for the ~700 KB
 * data package.
 */
export function warmUp(): void {
  void phonemize([''])
}

// ---------------------------------------------------------------- phoneme helpers

const VOWEL_RE = /[aeiouyøœəɛɔɑɪʊ]/

/** Whether an IPA phoneme is a vowel (nasal vowels included, glides excluded). */
const isVowel = (p: string) => VOWEL_RE.test(p)

/** Removes eSpeak's stress marks (`ˈ ˌ`), reduction marks (`-`) and language switches (`(en)`). */
function cleanPhoneme(p: string): string {
  return p
    .replace(/\([^)]*\)/g, '')
    .replace(/[ˈˌ\-_]/g, '')
    .trim()
}

/** Cleans a whole trace into a list of IPA phonemes. */
function cleanTrace(trace: PhonemeTrace): string[] {
  return fixGlides(trace.map(([, p]) => cleanPhoneme(p)).filter(Boolean))
}

/**
 * Restores the glide ɥ.
 *
 * @remarks eSpeak writes the glide of *suis*, *nuit* as the vowel `y` followed by `i`. Before
 * another vowel, `y` is really ɥ: `s y i` → `s ɥ i`.
 */
function fixGlides(ph: string[]): string[] {
  return ph.map((p, i) => (p === 'y' && ph[i + 1] && isVowel(ph[i + 1]!) ? 'ɥ' : p))
}

/**
 * Restores the palatal nasal ɲ.
 *
 * @remarks eSpeak writes the "gn" of *accompagné*, *soignez* as `n j`. That sequence is also a
 * real one (*panier* /pa.nje/), so it is only rewritten when the word is spelled with "gn", once
 * per "gn".
 *
 * @param ph - Phonemes of one word.
 * @param spelling - The word as written.
 */
function fixPalatal(ph: string[], spelling: string): string[] {
  let left = (spelling.toLowerCase().match(/gn/g) ?? []).length
  if (!left) return ph
  const out: string[] = []
  for (let i = 0; i < ph.length; i++) {
    if (left && ph[i] === 'n' && ph[i + 1] === 'j') {
      out.push('ɲ')
      i++
      left--
    } else out.push(ph[i]!)
  }
  return out
}

/** Phonemes of words pronounced alone, by normalized word. Shared across analyses. */
const isolatedCache = new Map<string, string[]>()

// ---------------------------------------------------------------- analysis

/**
 * Analyzes a French speech: IPA for each word, liaisons and enchaînements.
 *
 * @param text - The speech: one paragraph per line, `# Title` lines for sections, `/`, `//` and
 *   `[→]` as reading marks.
 * @param run - Phonemizer to use. Defaults to the eSpeak web worker; tests can pass an eSpeak
 *   instance running in Node.
 * @returns The paragraphs, in order. Title lines are not paragraphs: they set
 *   {@link AnalyzedParagraph.section}.
 *
 * @example
 * ```ts
 * const [p] = await analyzeText('Les enfants sont arrivés.')
 * // p.items[0] → { text: 'Les', ipa: 'le', link: 'liaison', liaison: 'z', … }
 * ```
 */
export async function analyzeText(
  text: string,
  run: (texts: string[]) => Promise<PhonemeTrace[]> = phonemize,
): Promise<AnalyzedParagraph[]> {
  const paragraphs = parseText(text)
  const sentences = paragraphs.flatMap((p) => p.sentences)
  const normalized = sentences.map((s) => normalizeSentence(s.tokens))

  // Each distinct word, pronounced on its own, tells us which final consonants are liaisons.
  const missing = new Set<string>()
  for (const s of sentences) {
    for (const t of s.tokens) {
      if (t.kind === 'word') {
        const n = normalizeWord(t.text)
        if (!isolatedCache.has(n)) missing.add(n)
      }
    }
  }
  const missingList = [...missing]
  const [contextTraces, isolatedTraces] = await Promise.all([
    run(normalized.map((n) => n.text)),
    run(missingList),
  ])
  missingList.forEach((w, i) => isolatedCache.set(w, cleanTrace(isolatedTraces[i] ?? [])))

  let sentenceIndex = 0
  return paragraphs.map((p) => {
    const items: Item[] = []
    for (const sentence of p.sentences) {
      const norm = normalized[sentenceIndex]!
      const trace = contextTraces[sentenceIndex]!
      sentenceIndex++

      // Group phonemes by token, using the character position eSpeak reports.
      const phonemes: string[][] = sentence.tokens.map(() => [])
      for (const [pos, raw] of trace) {
        const ph = cleanPhoneme(raw)
        if (!ph) continue
        const owner = ownerAt(norm.owner, pos - 1)
        if (owner >= 0) phonemes[owner]!.push(ph)
      }
      phonemes.forEach(
        (ph, i) => (phonemes[i] = fixPalatal(fixGlides(ph), sentence.tokens[i]!.text)),
      )

      const sentenceItems: Item[] = sentence.tokens.map((tok, i) => {
        if (tok.kind !== 'word') return { kind: tok.kind, text: tok.text, space: tok.space }
        const lex = lexiconIpa(tok.text)
        return {
          kind: 'word',
          text: tok.text,
          space: tok.space,
          ipa: lex || syllabify(phonemes[i]!),
          link: null,
          liaison: '',
          key: wordKey(tok.text),
          match: matchKeys(tok.text),
          tech: isTech(tok.text),
          source: lex ? 'lexique' : 'espeak',
        }
      })
      detectLinks(sentence.tokens, sentenceItems, phonemes)
      items.push(...sentenceItems)
    }
    return { id: hash(p.text), section: p.section, text: p.text, items }
  })
}

/**
 * Finds the token that owns a character of the normalized text.
 *
 * @remarks eSpeak sometimes reports a position on a separator, for example the pause after a
 * comma. The closest preceding word is used then, or the next one at the start of a sentence.
 *
 * @param owner - Character → token map from {@link normalizeSentence}.
 * @param index - 0-based character index.
 * @returns A token index, or -1 if the sentence has no word.
 */
function ownerAt(owner: Int32Array, index: number): number {
  for (let i = Math.min(index, owner.length - 1); i >= 0; i--) if (owner[i]! >= 0) return owner[i]!
  for (let i = Math.max(index, 0); i < owner.length; i++) if (owner[i]! >= 0) return owner[i]!
  return -1
}

/**
 * Key under which the user's IPA corrections and practice statistics are stored.
 *
 * @returns The word in lower case, without surrounding punctuation and with straight apostrophes.
 *
 * @example
 * ```ts
 * wordKey('« L’équipe,') // → "l'équipe"
 * ```
 */
export function wordKey(text: string): string {
  return stripPunct(text).replace(/’/g, "'").toLowerCase()
}

/** Removes quotes, brackets and punctuation attached to a word. */
const stripPunct = (t: string) => t.replace(/[«»"“”().,;:!?]/g, '')

/**
 * Normalizes a word to compare it with speech recognition output.
 *
 * @returns The word in lower case, without accents, keeping only letters, digits, apostrophes and
 *   inner hyphens.
 *
 * @example
 * ```ts
 * normForMatch('Été,') // → 'ete'
 * ```
 */
export function normForMatch(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'-]/g, '')
    .replace(/^-+|-+$/g, '')
}

/**
 * Splits a word on its elisions, so each part can be matched separately.
 *
 * @remarks Recognizers split elisions inconsistently (`l'équipe`, `l équipe`, `léquipe`), so each
 * part is matched separately.
 *
 * @example
 * ```ts
 * matchKeys("l'équipe") // → ['l', 'equipe']
 * ```
 */
export function matchKeys(text: string): string[] {
  return normForMatch(text).split("'").filter(Boolean)
}

/** Acronyms (CNRS, l'ONU) and alphanumeric terms (FAIR4RS, 3D) are not counted in the score. */
function isTech(t: string): boolean {
  const w = stripPunct(t)
  return (/[0-9]/.test(w) && /[a-z]/i.test(w)) || /^\p{Lu}{2,}/u.test(w.replace(/^\p{L}'/u, ''))
}

/** djb2 hash of a string, in base 36: a short, stable paragraph id. */
function hash(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

const OBSTRUENTS = new Set(['p', 'b', 't', 'd', 'k', 'ɡ', 'g', 'f', 'v'])
const LIQUIDS = new Set(['ʁ', 'l'])
const GLIDES = new Set(['j', 'w', 'ɥ'])

/**
 * Splits a word's phonemes into syllables, separated by dots.
 *
 * @remarks
 * The usual French rules, applied between two vowels:
 *
 * - one consonant starts the next syllable (`a.mi`);
 * - an obstruent + liquid cluster stays together (`a.pʁɑ̃.ti`);
 * - a consonant + glide stays together (`na.sjɔ̃`, `kɔ̃.ti.nɥi.te`);
 * - otherwise the cluster is split before its last consonant (`ɛks.ple.ʁi.mɑ̃`).
 *
 * @param ph - The word's phonemes, one IPA symbol (possibly with diacritics) per entry.
 * @returns The IPA string with `.` between syllables.
 *
 * @example
 * ```ts
 * syllabify(['a', 'p', 'ʁ', 'ɑ̃', 't', 'i']) // → 'a.pʁɑ̃.ti'
 * ```
 */
export function syllabify(ph: string[]): string {
  const nuclei = ph.map((p, i) => (isVowel(p) ? i : -1)).filter((i) => i >= 0)
  if (nuclei.length < 2) return ph.join('')
  const breaks = new Set<number>()
  for (let k = 0; k < nuclei.length - 1; k++) {
    const from = nuclei[k]! + 1
    const to = nuclei[k + 1]! // consonants between the two vowels: ph[from..to-1]
    const n = to - from
    if (n === 0) {
      breaks.add(to)
      continue
    }
    // The onset of the next syllable takes as many consonants as French allows.
    let onset = 1
    let i = to - 1
    if (GLIDES.has(ph[i]!) && n >= 2) {
      onset++
      i--
    }
    if (n > onset && LIQUIDS.has(ph[i]!) && OBSTRUENTS.has(ph[i - 1]!)) onset++
    breaks.add(to - Math.min(onset, n))
  }
  return ph.map((p, i) => (breaks.has(i) ? '.' : '') + p).join('')
}

/**
 * Marks liaisons and enchaînements between consecutive words of a sentence.
 *
 * @remarks
 * A word ending in a consonant before another word is:
 *
 * - a **liaison** if that consonant is absent when the word is pronounced alone (*les* /le/ but
 *   *les enfants* /lez‿ɑ̃fɑ̃/), or if eSpeak doubled it (*comptent un* /kɔ̃tt/). The consonant moves
 *   to {@link WordItem.liaison}.
 * - an **enchaînement** if the consonant is always pronounced and the next word starts with a vowel.
 *
 * Punctuation between two words blocks the link.
 *
 * @param tokens - Tokens of the sentence.
 * @param items - Items built from those tokens; modified in place.
 * @param phonemes - Phonemes of each token, in context.
 */
function detectLinks(tokens: Token[], items: Item[], phonemes: string[][]): void {
  for (let i = 0; i < items.length - 1; i++) {
    const item = items[i]!
    const next = items[i + 1]!
    if (item.kind !== 'word' || next.kind !== 'word') continue
    const ph = phonemes[i]!
    const nextPh = phonemes[i + 1]!
    const last = ph[ph.length - 1]
    if (!last || isVowel(last) || !nextPh[0]) continue

    const isolated = isolatedCache.get(normalizeWord(tokens[i]!.text)) ?? []
    const isolatedLast = isolated[isolated.length - 1]
    const doubled = ph.length > 2 && ph[ph.length - 2] === last
    if ((isolatedLast !== last || doubled) && ph.length > 1) {
      item.link = 'liaison'
      item.liaison = last
      if (item.source === 'espeak') item.ipa = syllabify(ph.slice(0, -1))
    } else if (isVowel(nextPh[0])) {
      item.link = 'enchainement'
    }
  }
}
