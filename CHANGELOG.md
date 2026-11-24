# Changelog

All notable changes to Discours are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-11-24

First public release.

### Added

- **IPA under each word**, split into syllables, from a hand-checked lexicon or from eSpeak-NG,
  which runs in the browser.
- **Liaisons and enchaînements** shown between words (`‿z`, `‿`).
- **Model voice**: each paragraph read in a single utterance by the best French voice of the
  browser, with the spoken word highlighted and an adjustable speed (0.6× to 1.1×).
- **Read aloud**: speech recognition colours the words green or red as you read, then gives a
  score, the reading time and the words per minute.
- **Whole speech** screen: listen to the speech from start to finish, or read it aloud in one go,
  with every paragraph reached scored on its own.
- **Words to work on**: missed words are collected, and a word panel lets you hear a word, hear it
  slowly and repeat it until it is recognized.
- **Definitions** from the French Wiktionary in the word panel, with inflected forms leading to
  their base word.
- **IPA corrections**, applied everywhere the word appears.
- **Progress saved in the browser**: best score per paragraph, words to work on, per-word results.
- **PDF download** of the whole speech or one section, as training cards or as an A4 document.
- **Text editor** with sections (`# Title`), short and long pauses (`/`, `//`) and slide changes
  (`[→]`).
- Layout for phones, with the paragraph list in a drawer.
- `npm run deploy` to install the app in a folder of static apps, under any public path.
- Documentation: a README to run and try the app, a contributing guide describing the
  architecture (ports and adapters), and API documentation generated with TypeDoc.

[Unreleased]: https://depot.lipn.univ-paris13.fr/teaching-apps/discours/-/compare/v1.0.0...main
[1.0.0]: https://depot.lipn.univ-paris13.fr/teaching-apps/discours/-/tags/v1.0.0
