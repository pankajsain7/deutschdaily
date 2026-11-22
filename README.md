# DeutschDaily

DeutschDaily opens to **Leben in Deutschland**, with BAMF practice for Baden-Württemberg and a timed mock test. The earlier vocabulary, sentence, and course tools are still available through the [archive URL](DEDaily.html?view=archiv), along with their saved progress. The app runs directly from `DEDaily.html` without a build step or server.

## Features

- Daily sentence queue with progress tracking
- Spaced repetition scheduling
- **Vocabulary**: a single 2,525-word German frequency dictionary with example sentences, searchable and filterable browsing
- **Practice**: dedicated tab with Anki-style flashcards for vocabulary — Again / Hard / Good / Easy ratings with next-interval previews, DE→EN and EN→DE directions, and decks for due reviews, today's new words, hard words, saved words, and everything learned
- **Daily review reminder**: shown once per day when reviews are due, and stays dismissed for the rest of the day
- **Sentences**: Browse and practice daily-life resident scenarios by topic with English-to-German translation exercises
- **Kursplan (Curriculum Syllabus)**: Comprehensive A1 → B1 study plan covering 48 units and 600 Unterrichtseinheiten structured according to BAMF Integrationskurs and telc/Goethe specifications
- German to English and English to German practice
- Text-to-speech support with browser speech synthesis plus optional desktop fallback voices when network audio is available
- Learn more panels with grammar, variants, reuse ideas, likely replies, and active practice tasks
- Formal and informal variants where `Sie` / `du` matters
- Vocabulary-focused progress tab with review forecast, retention, and a "needs attention" list of repeatedly forgotten words
- **Leben in Deutschland**: 310 official BAMF questions for Baden-Württemberg, adaptive practice, and a 60-minute mock test
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
resources/
  deutsch-a1-b1-kursplan.html  Interactive A1 → B1 Kursplan (48 units / 600 UE syllabus)
src/content.js            Topics and sentence seed data
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

The Leben-in-Deutschland section saves progress in `dd_lid_v1`. The DeutschDaily JSON export includes its practice and test history. Active rounds resume in the same browser.

## Installieren und offline üben

- **iPhone und iPad**. In Safari **Teilen** und **Zu Home-Bildschirm hinzufügen** wählen. Falls angezeigt, **Als Web-App öffnen** aktivieren und **Hinzufügen** antippen.
- **Android**. **App installieren** auf der Startseite öffnet die Installationsabfrage von Chrome, sobald sie verfügbar ist. Bestätige die Abfrage, um das Symbol zum Startbildschirm hinzuzufügen.
- Die installierte App einmal mit Internet öffnen. Unter **Offline-App** zeigt **Offline bereit**, dass alle 310 Fragen, Abbildungen und Übungsmodi einschließlich Probetest heruntergeladen wurden. Für Audio im Archiv braucht das Gerät offline eine installierte deutsche Systemstimme.
- Mit aktivierter Synchronisierung verbindet **Zum Home-Bildschirm** den Lernstand in Safari mit einer anschließend hinzugefügten Web-App auf iOS oder iPadOS ab Version 17.2. Übungen, Lesezeichen und Probetests werden beim Öffnen und bei wiederhergestellter Verbindung synchronisiert. Änderungen werden zuerst lokal gespeichert.
- Unter **Offline-App** lässt sich jederzeit eine Sicherungsdatei speichern oder wiederherstellen. Sie enthält auch pausierte Übungen und laufende Probetests mit ihrer ursprünglichen Frist.

Zum Testen der Installation oder des Offline-Modus die App über HTTPS oder `http://localhost` öffnen, beispielsweise mit `python3 -m http.server 8000` und `http://localhost:8000/DEDaily.html`.

Die Synchronisierung von „Leben in Deutschland“ benötigt eine Upstash-kompatible Redis-Datenbank. Setze serverseitig `KV_REST_API_URL`, `KV_REST_API_TOKEN` und `DEUTSCHDAILY_PROGRESS_SYNC=1`. Safari kopiert beim Anlegen der Web-App das Cookie des anonymen Profils. Bereits installierte iOS-Web-Apps haben ihr eigenes Profil. Synchronisierte Lernstände werden nach einem Jahr ohne Änderung aus Redis entfernt. Die lokal gespeicherten Lernstände bleiben verfügbar.

## Leben in Deutschland

- **Alle Fragen üben** führt mit sofortiger Rückmeldung durch alle 310 Katalogfragen. Unter **Nach Themen üben** stehen die drei Bereiche des Orientierungskurses und die zehn Landesfragen für Baden-Württemberg zur Auswahl. Die Übersicht zeigt beantwortete Fragen und offene Fehler. Beim Wechsel bleibt die Position in jeder Runde gespeichert.
- **Fehlertraining** wiederholt bis zu zehn offene Fehler aus Übungen und Probetests. In der Auswertung führt **Nur Fehler üben** zu den falschen Antworten des jeweiligen Tests, sofern keine Fehlerrunde läuft.
- In jeder Übungsrunde erscheint jede Frage einmal. Falsche Antworten bleiben für spätere Fehlerrunden gespeichert.
- **Probetest** zieht 30 allgemeine Aufgaben und drei Landesfragen. Für jede Aufgabe gibt es vier Optionen und eine richtige Antwort. Die Uhr läuft ab dem Start und der Test endet mit der Abgabe oder nach 60 Minuten. Die Auswertung zeigt falsche und offene Aufgaben mit Lösungen.
- **Lernstand** zeigt Katalogabdeckung, Übungsgenauigkeit und bisherige Probetests mit Punktzahlen, Testergebnissen und Bearbeitungszeit, soweit sie gespeichert wurde.
- Das Lesezeichen an einer Frage legt sie unter **Gespeichert** ab. Dort lassen sich die Antwortmöglichkeiten und die Lösung nachlesen.

### Quellen und Katalogpflege

- Die Fragen und Antwortoptionen folgen dem [BAMF-Gesamtfragenkatalog](https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/gesamtfragenkatalog-lebenindeutschland.pdf?__blob=publicationFile&v=22) vom 07.05.2025. Alle 310 Lösungen wurden am 20.11.2026 in der Antwortanzeige des [BAMF Online-Testcenters](https://oet.bamf.de/ords/oetut/f?p=534:1:0:::::) geprüft.
- DeutschDaily ordnet jede allgemeine Frage für das Üben einem Themenbereich des [BAMF-Orientierungskurses](https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Integrationskurse/Kurstraeger/KonzepteLeitfaeden/curriculum-orientierungskurs-pdf.pdf?__blob=publicationFile) zu. Die Zuordnung in `src/lid-learning.js` bei einer Katalogänderung prüfen.
- Die farbigen Schaubilder stammen aus dem BAMF-Katalog. Die fünf Fotoaufgaben (55, 70, 181, 216 und 235) verwenden die entsprechenden amtlichen Abbildungen aus [Anlage 1 der Einbürgerungstestverordnung](https://www.gesetze-im-internet.de/einbtestv/anlage_1.html). Die dort veröffentlichten Aufnahmen zeigen die Motive der jeweiligen Aufgaben.
- Das Prüfungsformat folgt [§ 3 IntTestV](https://www.gesetze-im-internet.de/inttestv/__3.html) und [§ 1 EinbTestV](https://www.gesetze-im-internet.de/einbtestv/__1.html). Die zwei Punkteschwellen stehen in [§ 10 IntTestV](https://www.gesetze-im-internet.de/inttestv/__10.html).

Für eine Aktualisierung den aktuellen BAMF-Katalog herunterladen, Playwright mit Chromium für die Antwortprüfung sowie Poppler und `pdfplumber` für den Import verwenden. `LID_BROWSER_PATH` kann auf einen installierten Chromium-Browser zeigen.

```sh
node scripts/read-lid-answers.js /tmp/lid-antworten.jsonl
python3 scripts/import-lid-catalog.py /tmp/lid-katalog.pdf /tmp/lid-antworten.jsonl --verified YYYY-MM-DD
node scripts/validate.js
node scripts/logic-tests.js
```

Die Änderungen am Katalog, alle neu zugeordneten Lösungen und die Abbildungen vor der Veröffentlichung prüfen. Bei einem neuen Katalogstand die URL und Cache-Versionen in der App und im Service Worker aktualisieren. Aufgaben-IDs bleiben bestehen. Ändert sich der Inhalt, wird die Aufgabe erneut fällig.

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
- topics and levels are valid
- every sentence has learning metadata
- vocabulary cards have valid topics, source refs, noun gender/article data, and examples
- frequency dictionary has 2,525 unique, sequential entries with all required fields
- expected replies and practice prompts are not generic
- formal/informal coverage stays above the configured threshold
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

## GitHub

Repository remote:

```text
https://github.com/Xanoster/deutschdaily.git
```
