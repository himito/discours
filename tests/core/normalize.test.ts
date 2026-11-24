import { describe, expect, it } from 'vitest'
import {
  normalizeSentence,
  normalizeWord,
  parseText,
  SEPARATOR,
  splitSentences,
  tokenizeParagraph,
} from '#core/text/normalize'

describe('parseText', () => {
  it('splits paragraphs and assigns sections from title lines', () => {
    const paragraphs = parseText('# Intro\nBonjour à tous.\n\n# Fin\nMerci.')
    expect(paragraphs.map((p) => [p.section, p.text])).toEqual([
      ['Intro', 'Bonjour à tous.'],
      ['Fin', 'Merci.'],
    ])
  })

  it('accepts Windows and old Mac line endings, and empty titles', () => {
    const paragraphs = parseText('# A\r\nUn.\r\rDeux.\n#\nTrois.')
    expect(paragraphs.map((p) => [p.section, p.text])).toEqual([
      ['A', 'Un.'],
      ['A', 'Deux.'],
      ['', 'Trois.'],
    ])
  })

  it('keeps reading marks as tokens', () => {
    const [p] = parseText('Bonjour / à tous //')
    const kinds = p!.sentences.flatMap((s) => s.tokens).map((t) => t.kind)
    expect(kinds).toEqual(['word', 'mark', 'word', 'word', 'mark'])
  })
})

describe('normalizeWord', () => {
  it('spells out abbreviations and ordinals', () => {
    expect(normalizeWord('M.')).toBe('Monsieur')
    expect(normalizeWord('XXIe')).toMatch(/vingt-et-unième/)
    expect(normalizeWord('1er')).toBe('premier')
    expect(normalizeWord('1re')).toBe('première')
  })

  it('joins numbers and aujourd’hui so eSpeak reads them whole', () => {
    expect(normalizeWord('1 200 000')).toBe('1200000')
    expect(normalizeWord('qu’aujourd’hui')).toBe("qu'aujourdhui")
  })

  it('reads capitals as Roman numerals, words or letters', () => {
    expect(normalizeWord('XIV')).toBe('14')
    expect(normalizeWord('CDI')).toBe('cé-dé-i')
    expect(normalizeWord('OTAN')).toBe('otan')
    expect(normalizeWord('INSEE')).toBe('insé')
    expect(normalizeWord('PIB')).toBe('pé-i-bé')
    expect(normalizeWord('P.I.B.')).toBe('pé-i-bé')
  })

  it('normalizes the word after an elided prefix', () => {
    expect(normalizeWord("l'INSEE")).toBe("l'insé")
    expect(normalizeWord("l'équipe")).toBe("l'équipe")
  })

  it('leaves ordinary words, and Le / De, alone', () => {
    expect(normalizeWord('Le')).toBe('Le')
    expect(normalizeWord('Paris')).toBe('Paris')
    expect(normalizeWord('constructor')).toBe('constructor')
  })
})

describe('splitSentences', () => {
  it('keeps closing quotes and extra punctuation with the sentence they end', () => {
    const sentences = splitSentences(tokenizeParagraph('Il dit « Non. » Puis ?! Fin'))
    expect(sentences.map((s) => s.tokens.map((t) => t.text).join(' '))).toEqual([
      'Il dit « Non . »',
      'Puis ? !',
      'Fin',
    ])
  })

  it('does not end a sentence at an abbreviation', () => {
    expect(splitSentences(tokenizeParagraph('M. Dupont arrive.'))).toHaveLength(1)
  })
})

describe('normalizeSentence', () => {
  it('turns reading marks into pauses and maps characters back to words', () => {
    const { text, owner } = normalizeSentence(tokenizeParagraph('M. Dupont / arrive [→] //'))
    expect(text).toBe('Monsieur Dupont , arrive  .')
    expect(owner[0]).toBe(0)
    expect(owner[text.indexOf('Dupont')]).toBe(1)
    expect(owner[text.indexOf(',')]).toBe(SEPARATOR)
    expect(owner[text.indexOf('arrive')]).toBe(3)
    expect(owner).toHaveLength(text.length)
  })
})

describe('tokenizeParagraph', () => {
  it('tells words, punctuation and reading marks apart', () => {
    const tokens = tokenizeParagraph("M. Dupont, / l'équipe : 12 % [→]")
    expect(tokens.map((t) => [t.text, t.kind])).toEqual([
      ['M.', 'word'],
      ['Dupont', 'word'],
      [',', 'punct'],
      ['/', 'mark'],
      ["l'équipe", 'word'],
      [':', 'punct'],
      ['12', 'word'],
      ['%', 'word'],
      ['[→]', 'mark'],
    ])
  })

  it('keeps the spacing, so the text can be rebuilt exactly', () => {
    const text = '  Bonjour ,  à\ttous !  '
    const tokens = tokenizeParagraph(text)
    expect(text.slice(0, tokens[0]!.start) + tokens.map((t) => t.text + t.space).join('')).toBe(
      text,
    )
    expect(tokens.at(-1)!.space).toBe('  ')
  })

  it('gives no token for an empty or blank paragraph', () => {
    expect(tokenizeParagraph('')).toEqual([])
    expect(tokenizeParagraph('   ')).toEqual([])
  })
})
