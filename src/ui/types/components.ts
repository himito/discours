/**
 * The contracts of the components: their props and the events they emit.
 *
 * @remarks Defined here rather than in each component, so a parent and its child share the same
 * types: a screen handling `SpeechText`'s `word` event knows it receives a {@link SelectedWord}.
 *
 * @packageDocumentation
 */
import type { AnalyzedParagraph, Item } from '#core/model'
import type { BestScores, Overview } from '#core/progress/progress'
import type { Voice } from '#core/reading/SpeechSynthesizer'
import type { WordVerdict } from '#core/reading/session'
import type { Section } from '#core/speech/sections'
import type { ReadingResult } from '#ui/composables/useReadingSession'
import type { DisplayOptions, DocBlock } from './print'
import type { SelectedWord } from './word'

/** Props of `SpeechText`: a paragraph's words with their IPA and reading colours. */
export interface SpeechTextProps {
  /** The paragraph's items. */
  items: Item[]
  /** Index of the item being spoken, or -1. */
  sayIndex: number
  /** How the word at item `index` fared in the reading, for its colour. */
  verdict: (index: number) => WordVerdict
  /** Larger type, for a single paragraph. */
  large?: boolean
}

/** Events of `SpeechText`. */
export interface SpeechTextEmits {
  /** A word was clicked or activated with Enter. */
  word: [word: SelectedWord]
}

/** Events of `HardWordsPanel`. */
export interface HardWordsPanelEmits {
  /** A word to work on was chosen. */
  open: [word: SelectedWord]
}

/** Props of `WordPractice`: the single-word practice panel. */
export interface WordPracticeProps {
  /** The word to practise. */
  word: SelectedWord
}

/** Events of `WordPractice`. */
export interface WordPracticeEmits {
  /** The panel is closed (× or Escape). */
  close: []
}

/** Props of `IpaEditor`. */
export interface IpaEditorProps {
  /** The IPA to start from. */
  ipa: string
}

/** Events of `IpaEditor`. */
export interface IpaEditorEmits {
  /** The edited IPA, to store. */
  save: [ipa: string]
  /** Editing was abandoned. */
  cancel: []
}

/** Props of `WordDefinition`. */
export interface WordDefinitionProps {
  /** The word as written in the speech. */
  word: string
}

/** Props of `PrintParagraph`: a paragraph in the PDF. */
export interface PrintParagraphProps extends DisplayOptions {
  /** The paragraph to show. */
  paragraph: AnalyzedParagraph
  /** Number of the paragraph in its section, as in the sidebar. */
  n: number
}

/** Props of `PrintDocBlock`: a block of the document template. */
export interface PrintDocBlockProps extends DisplayOptions {
  /** The block to show. */
  block: DocBlock
  /** Reading speed shown in the header, in words per minute. */
  wpm: number
}

/** Props of `ToggleSwitch`, besides its `v-model` (whether it is on). */
export interface ToggleSwitchProps {
  /** Greys the switch out and ignores clicks. */
  disabled?: boolean
}

/** Props of `OverallProgress`. */
export interface OverallProgressProps {
  /** How far the learner is through the speech. */
  progress: Overview
}

/** Props of `ParagraphList`: the paragraphs grouped by section, with their best scores. */
export interface ParagraphListProps {
  /** The speech's sections. */
  sections: Section[]
  /** Best reading score per paragraph id, in %. */
  best: BestScores
  /** Index of the paragraph being practised. */
  current: number
}

/** Events of `ParagraphList`. */
export interface ParagraphListEmits {
  /** A paragraph was chosen, by its index in the speech. */
  select: [index: number]
}

/** Props of `ParagraphSidebar`: the paragraph list, the progress and the links to other screens. */
export interface ParagraphSidebarProps extends ParagraphListProps {
  /** Whether the drawer is open, on phones. */
  open: boolean
  /** How far the learner is through the speech. */
  progress: Overview
}

/** Events of `ParagraphSidebar`. */
export interface ParagraphSidebarEmits extends ParagraphListEmits {
  /** The drawer is to be closed (×, backdrop), on phones. */
  close: []
}

/** Props of `MobileHeader`: the phone header with the drawer and settings buttons. */
export interface MobileHeaderProps {
  /** Whether the paragraph drawer is open. */
  drawerOpen: boolean
  /** Whether the settings are unfolded. */
  settingsOpen: boolean
  /** Where the learner is, such as *§ 2 · 5/18*. */
  title: string
}

/** Events of `MobileHeader`. */
export interface MobileHeaderEmits {
  /** The paragraph drawer is to be opened. */
  openDrawer: []
  /** The settings are to be unfolded or folded. */
  toggleSettings: []
}

/** Props of `PracticeSettings`, besides its `v-model`s (the display and voice settings). */
export interface PracticeSettingsProps {
  /** Whether the settings are unfolded, on phones. */
  open: boolean
  /** The voices to choose from. */
  voices: readonly Voice[]
}

/** Props of `ReadingControls`: listen, read aloud, previous and next paragraph. */
export interface ReadingControlsProps {
  /** Whether the model voice is playing. */
  playing: boolean
  /** Whether the microphone is listening. */
  recording: boolean
  /** Whether the browser can speak. */
  canListen: boolean
  /** Whether the browser can recognize speech. */
  canRead: boolean
  /** Whether there is a paragraph before. */
  hasPrevious: boolean
  /** Whether there is a paragraph after. */
  hasNext: boolean
}

/** Events of `ReadingControls`. */
export interface ReadingControlsEmits {
  /** Play or stop the model voice. */
  listen: []
  /** Start reading aloud, or finish. */
  read: []
  /** Go to the previous paragraph. */
  previous: []
  /** Go to the next paragraph. */
  next: []
}

/** Props of `ReadingSummary`. */
export interface ReadingSummaryProps {
  /** The finished reading to show. */
  result: ReadingResult
}

/** Props of `HeardTranscript`: what the recognizer heard. */
export interface HeardTranscriptProps {
  /** Whether the microphone is listening. */
  listening: boolean
  /** What was recognized for sure. */
  transcript: string
  /** What is still being recognized. */
  interim: string
}
