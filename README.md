<p align="center"><img src="public/logo.svg" alt="Discours" width="300"></p>

# Discours

A web app for practising French pronunciation of a speech. Paste your text and each word is shown
with its pronunciation in the International Phonetic Alphabet (IPA, _API_ in French), plus the
liaisons to make. You can listen to a model voice, read aloud and see which words were understood,
then work on the difficult ones one by one.

It runs entirely in the browser: no server, no account. Your text and progress stay in your
browser.

## Contents

- [Features](#features)
- [Running it locally](#running-it-locally)
- [A first try](#a-first-try)
- [Writing a speech](#writing-a-speech)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Limitations](#limitations)
- [Contributing](#contributing)
- [Licence](#licence)

## Features

- **IPA under each word**, split into syllables (`/a.pʁɑ̃.ti.saʒ/`). It comes from a hand-checked
  lexicon when the word is in it, otherwise from eSpeak-NG.
- **Liaisons and enchaînements**: `‿z` after _les_ in _les enfants_, `‿` after _avec_ in
  _avec elle_.
- **Model voice**: the paragraph is read in a single utterance by the best French voice in the
  browser, and the word being spoken is highlighted. The rate is adjustable (0.6× to 1.1×).
- **Read aloud**: speech recognition follows your reading. Words turn green when understood and
  red when missed, live. At the end you get a score, the reading time and your words per minute
  (target ≈ 135).
- **Whole speech**: _Discours entier_ shows every paragraph on one page. Listen to it from start
  to finish, or read it aloud in one go: the page follows you, and each paragraph you reach is
  scored.
- **Words to work on**: missed words are collected in a list. Click one (or any word in the text)
  to hear it, hear it slowly, and repeat it until it's recognized.
- **Definitions**: the word panel also shows the word's French meanings, from the
  [Wiktionnaire](https://fr.wiktionary.org). Inflected forms lead to their base word
  (_recherches_ → _recherche_, _remercie_ → _remercier_).
- **IPA corrections**: if a transcription is wrong, click the word and correct it. The correction
  applies everywhere the word appears.
- **Progress is saved** in the browser: best score per paragraph, words to work on, per-word
  success rate.
- **PDF**: the whole speech or one section, as training cards (two A5 cards per A4 page, to cut
  out) or as a numbered A4 document, with the IPA, liaisons and pauses.

## Running it locally

Requirements: [Node.js](https://nodejs.org) 22.18+ or 24.12+, and Google Chrome or Microsoft Edge
for speech recognition.

```sh
npm install
npm run dev
```

Open the URL Vite prints (usually <http://localhost:5173>) **in Chrome or Edge**. Speech
recognition isn't available in Safari or Firefox; the IPA and the model voice still work there.

The first `npm run dev` also builds the French eSpeak-NG data (a few seconds). To try the
production build instead:

```sh
npm run build
npm run preview
```

## A first try

The app opens on an example speech, so you can try everything before writing your own.

1. **Read the IPA.** Each word of the first paragraph has its pronunciation underneath, with the
   liaisons in colour.
2. **Listen.** Click **▶ Écouter le modèle**: the paragraph is read aloud and the word being
   spoken is highlighted. Adjust **Vitesse** in the top bar if it's too fast.
3. **Read aloud.** Click **● Lire à voix haute** (or press Space), allow the microphone, read the
   paragraph, then click **■ J'ai fini**. Words turn green or red, and you get a score, a time and
   your words per minute.
4. **Practise a word.** Click any word, or one under _Mots à travailler_: hear it, hear it slowly
   (**Lentement**), then click **Répéter** and say it. The panel also shows its definitions.
5. **Move on.** Use ← → (keys or buttons) or the list on the left. Each paragraph keeps its best
   score.
6. **Use your own text.** Click **✎ Modifier le texte** and paste your speech (see below).

## Writing a speech

Click **Modifier le texte** in the sidebar. The format is plain text:

```text
# Introduction
Mesdames et Messieurs les membres du jury, / je vous remercie de m'accueillir. //
Je vais d'abord vous présenter mon parcours. [→]
# Parcours
Depuis mon arrivée au laboratoire, / mes travaux portent sur…
```

- **One paragraph per line.** A paragraph is the unit you listen to, read and get scored on.
- **`# Title`** starts a section. Paragraphs are grouped under it in the sidebar.
- **`/`** marks a short pause and **`//`** a long one. The model voice respects them.
- **`[→]`** marks a slide change. It is shown but not read.

The text is saved as you type. Editing a paragraph resets its score.

## Configuration

**In the app** (saved in the browser):

| Setting                         | Where                                         |
| ------------------------------- | --------------------------------------------- |
| IPA and liaisons shown or not   | _Affichage_, top bar (⚙ _Réglages_ on phones) |
| Speed of the model voice        | _Vitesse_, top bar                            |
| Voice                           | _Voix_, top bar, when the browser has several |
| A word's IPA                    | click the word, then _Corriger l'API_         |
| PDF template, size and contents | _Télécharger en PDF_, in the sidebar          |

**When building and deploying** (environment variables):

| Variable     | Default                                         | What it sets                                                  |
| ------------ | ----------------------------------------------- | ------------------------------------------------------------- |
| `BASE_PATH`  | `/` (`npm run dev`), `/apps/discours/` (deploy) | The public path the app is served from                        |
| `DEPLOY_DIR` | none                                            | The folder `npm run deploy` installs into; or `.deploy.local` |

Everything the app saves is in the browser's `localStorage` (key `discours:v2`). Clearing the
site's data resets the text, the settings and the progress.

## Deployment

The app is a set of static files: any web server can host it.

`npm run deploy` builds the app for the public path `/apps/discours/` and copies it into
`<folder>/discours/`:

```sh
npm run deploy -- /path/to/apps        # installs into /path/to/apps/discours
DEPLOY_DIR=/path/to/apps npm run deploy
```

To avoid typing the path, set it once in a `.deploy.local` file at the project root (git-ignored):

```sh
DEPLOY_DIR=/path/to/apps
```

To serve it from another path, set `BASE_PATH` (for example `BASE_PATH=/discours/ npm run
deploy`). Each deployment removes the files of the previous one. Publishing the folder is up to
you.

Links to inner pages (such as `/apps/discours/texte`) work on Apache, thanks to the `.htaccess`
the script writes, and on static hosts without rewrite rules, such as GitHub Pages, thanks to a
`404.html` redirect.

To host it somewhere else, run `BASE_PATH=/your/path/ npm run build` and copy `dist/`.

## Limitations

- **Speech recognition** only works in Chrome and Edge, and sends the audio to the browser
  vendor's servers. It judges whether a word was _understood_, not whether it was perfectly
  pronounced.
- **Definitions** are fetched from Wikimedia when the word panel opens, so the word is sent there.
  Without a connection, they are unavailable.
- **The lexicon ignores context.** It gives _tous_ /tu/ even in _à tous_ (/tus/), and only covers
  the vocabulary of the speech it was written for.
- **eSpeak-NG makes occasional mistakes** (_fils_ /fil/ instead of /fis/) and makes some optional
  liaisons (_arrivés‿z en_). Click a word to correct it.
- **The model voice depends on the browser and the system.** Chrome's _Google français_ and
  macOS's Thomas or Amélie sound best.
- **The PDF** is made of page images: it looks exactly like the preview, but its text can't be
  selected or searched.
- **Fonts** (IBM Plex, Charis SIL) load from Google Fonts. Offline, system fonts are used.

## Contributing

Contributions are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) explains how the code is organized
and how it works, and what a change needs before it is merged.

## Licence

The licence can be found in the file [LICENSE](LICENSE).
