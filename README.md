# DeutschDaily

DeutschDaily is an offline-first daily German practice app focused on useful resident-life sentences for Germany. It is built as a small static web app, so it can run directly from `DEDaily.html` without a build step or server.

## Features

- Daily sentence queue with progress tracking
- Spaced repetition scheduling
- **Vocabulary**: a single 2,525-word German frequency dictionary with example sentences, searchable and filterable browsing
- **Practice**: dedicated tab with Anki-style flashcards for vocabulary — Again / Hard / Good / Easy ratings with next-interval previews, DE→EN and EN→DE directions, and decks for due reviews, today's new words, hard words, saved words, and everything learned
- **Daily review reminder**: shown once per day when reviews are due, and stays dismissed for the rest of the day
- **Sentences**: Browse and practice daily-life resident scenarios by topic with pattern learning and English-to-German translation exercises
- **Kursplan (Curriculum Syllabus)**: Comprehensive A1 → B1 study plan covering 48 units and 600 Unterrichtseinheiten structured according to BAMF Integrationskurs and telc/Goethe specifications
- Pattern learning and pattern practice
- German to English and English to German practice
- Text-to-speech support with browser speech synthesis plus optional desktop fallback voices when network audio is available
- Learn more panels with grammar, variants, reuse ideas, likely replies, and active practice tasks
- Formal and informal variants where `Sie` / `du` matters
- Vocabulary-focused progress tab with review forecast, retention, and a "needs attention" list of repeatedly forgotten words
- Offline local progress storage with export/import backups
- Responsive sidebar navigation with section grouping (Learn, Track)
- Minimal SVG app logo for browser tabs and bookmarks

## Run Locally

Open this file in a browser:

```text
DEDaily.html
```

The app loads these local files:

```text
src/content.js
src/learning.js
src/frequency-dictionary-data.js
src/storage.js
src/app.js
src/styles.css
```

No install step is required.

## Project Structure

```text
DEDaily.html              App shell and script/style includes
deutsch-a1-b1-kursplan.html  Interactive A1 → B1 Kursplan (48 units / 600 UE syllabus)
src/content.js            Topics, patterns, and sentence seed data
src/learning.js           Learn more generation and teaching metadata
src/frequency-dictionary-data.js  2,525-word frequency dictionary data
src/frequency-dictionary.json     Parsed frequency dictionary (JSON, generated)
src/storage.js            Local storage, daily queue, history, and SRS
src/app.js                Rendering, navigation, practice, TTS, import/export
src/assets/logo.svg       Minimal app logo and favicon
src/styles.css            CSS import index
src/styles/               Split CSS files by app area
scripts/validate.js       Static validation for content and app wiring
scripts/logic-tests.js    Storage, import, and SRS regression tests
scripts/parse_frequency_pdf.py  PDF parser for frequency dictionary
docs/german-frequency-dictionary.md  Frequency dictionary summary (generated)
```

## Progress Storage

Progress is stored in browser `localStorage` under:

```text
dd_v4
```

An older key may also exist:

```text
dd_clean_v1
```

## Validate

Run the static validation script from the project root:

```bash
node scripts/validate.js
```

Run storage/SRS regression tests:

```bash
node scripts/logic-tests.js
```

The validation checks:

- HTML includes the expected CSS and JS files
- sentence IDs are unique
- topics, levels, and pattern references are valid
- every sentence has learning metadata
- vocabulary cards have valid topics, source refs, noun gender/article data, and examples
- frequency dictionary has 2,525 unique, sequential entries with all required fields
- expected replies and practice prompts are not generic
- formal/informal coverage stays above the configured threshold
- misleading sentence-to-pattern links are blocked by contract checks
- A1 survival and emergency coverage stay above launch thresholds
- known reviewer fixes remain intact

## Frequency Dictionary

The frequency dictionary module uses 2,525 manually parsed entries from the *German Frequency Dictionary 1* PDF. To regenerate the data after updating the PDF:

```bash
pip install pdfplumber
python3 scripts/parse_frequency_pdf.py
```

This writes `src/frequency-dictionary.json`, `src/frequency-dictionary-data.js`, and `docs/german-frequency-dictionary.md`.

## Content Guidelines

When adding or editing sentences:

- Prefer practical resident-life situations over tourist phrases.
- Use `Sie` for offices, doctors, landlords, banks, service staff, transport staff, and unknown adults.
- Add `du` variants where a learner may realistically speak to friends, close colleagues, neighbors, or peers.
- Keep translations faithful and natural.
- Every sentence should either have at least one `patternId` or be marked `fixed: true`.
- Add sentence-specific learning notes when a pattern would be misleading.

## GitHub

Repository remote:

```text
https://github.com/Xanoster/deutschdaily.git
```
