const LID_VIEW = 'leben-in-deutschland';

const LiDView = (() => {
  const { examRules, examSize } = LiDLearning;
  const titles = {
    all: 'Alle Fragen üben',
    daily: 'Alle Fragen üben',
    errors: 'Fehlertraining',
  };
  /** @type {ReadonlyMap<LiDMode, string>} */
  const topicLabels = new Map(LiDLearning.topics.map(({ mode, label }) => [mode, label]));
  const testDate = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
  const numbers = new Intl.NumberFormat('de-DE');
  const scores = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

  let root;
  let active = false;
  let screen = 'home';
  let resultId = null;
  let timer = null;
  let finishing = false;
  let pending = false;

  function newRoundId() {
    return crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function button(label, action, { primary = false, disabled = false, value = '', variant = '' } = {}) {
    const style = primary ? ' lid-button-primary' : variant === 'text' ? ' lid-button-text' : '';
    return `<button type="button" class="lid-button${style}" data-lid-action="${action}" data-value="${escapeHtml(value)}"${disabled ? ' disabled' : ''}>${escapeHtml(label)}</button>`;
  }

  const bookmarkTitle = saved => saved ? 'Aus gespeicherten Fragen entfernen' : 'Frage speichern';

  /** @param {string} questionId @param {boolean} saved */
  function bookmarkButton(questionId, saved) {
    return `<button type="button" class="lid-bookmark" data-lid-action="toggle-bookmark" data-value="${questionId}"
      aria-label="Frage speichern" aria-pressed="${saved}" title="${bookmarkTitle(saved)}">
      ${svg('<path d="M6 4h12v16l-6-4-6 4z" stroke-linejoin="round"/>')}
    </button>`;
  }

  /** @param {{ label: string, note: string, icon: string, action: string, value?: string, primary?: boolean }} mode */
  function modeTile({ label, note, icon, action, value = '', primary = false }) {
    const style = primary ? ' lid-mode-primary' : icon === 'repeat' ? ' lid-mode-errors' : '';
    const noteId = `lid-note-${value || action}`;
    const content = `
      <span class="lid-mode-icon">${ICO[icon]}</span>
      <span><strong>${escapeHtml(label)}</strong><span id="${noteId}" class="lid-mode-note">${escapeHtml(note)}</span></span>`;
    return `<button type="button" class="lid-mode${style}" data-lid-action="${action}" data-value="${escapeHtml(value)}"
      aria-label="${escapeHtml(label)}" aria-describedby="${noteId}">${content}</button>`;
  }

  /** @param {LiDData} data @param {'all' | 'errors'} mode */
  function practiceTile(data, mode, note, icon, primary = false) {
    const round = LiDLearning.findPractice(data, mode);
    const answered = round?.attempts.filter(item => !item.retry).length;
    return modeTile({ label: titles[mode], action: 'start-practice', value: mode, icon, primary,
      note: round ? `Fortsetzen · ${answered} beantwortet` : note });
  }

  function metric(value, label) {
    return `<div class="lid-metric"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
  }

  const percent = (numerator, denominator) => denominator ? `${Math.round(numerator / denominator * 100)} %` : '–';

  function mainNav(current) {
    return `<nav class="lid-tabs" aria-label="Leben in Deutschland">
      <button type="button" data-lid-action="home" data-value=""${current === 'home' ? ' aria-current="page"' : ''}>Üben</button>
      <button type="button" data-lid-action="saved" data-value=""${current === 'saved' ? ' aria-current="page"' : ''}>Gespeichert</button>
      <button type="button" data-lid-action="profile" data-value=""${current === 'profile' ? ' aria-current="page"' : ''}>Lernstand</button>
    </nav>`;
  }

  function renderHome(data) {
    const stats = LiDLearning.progress(data);
    const total = LiDLearning.questions.length;
    const errorCount = stats.openErrors.length;
    const exam = data.exam;
    return `
      <div class="lid-home">
        ${mainNav('home')}
        <header class="lid-intro">
          <h1 id="lid-heading" tabindex="-1">Leben in Deutschland</h1>
          <p>Mit dem offiziellen BAMF-Fragenkatalog für Baden-Württemberg üben.</p>
        </header>
        <div class="lid-home-grid">
          ${practiceTile(data, 'all', `${total} Fragen mit sofortiger Rückmeldung`, 'book', true)}
          ${modeTile({ label: 'Nach Themen üben', note: 'Politik, Geschichte, Gesellschaft und Landesfragen', icon: 'layers', action: 'topics' })}
          ${modeTile({
            label: exam ? 'Probetest fortsetzen' : 'Probetest',
            action: exam ? 'resume-exam' : 'exam-intro',
            note: exam ? `${countAnswers(exam)}/${examSize} beantwortet` : `${examSize} zufällige Fragen · ${examRules.minutes} Minuten`,
            icon: 'clock',
          })}
          ${practiceTile(data, 'errors', errorCount ? `${errorCount} ${errorCount === 1 ? 'offene Frage' : 'offene Fragen'}` : 'Keine offenen Fehler', 'repeat')}
        </div>
      </div>`;
  }

  /** @param {LiDData} data */
  function renderTopics(data) {
    return `
      <div class="lid-topics">
        <div class="lid-workbar">${button('Zur Übersicht', 'home')}</div>
        <header class="lid-intro"><h1 id="lid-heading" tabindex="-1">Nach Themen üben</h1></header>
        <ul class="lid-topic-list">
          ${LiDLearning.topicProgress(data).map(({ mode, label, total, answered, errors }) => {
            const attempts = answered ? `${answered} von ${total} beantwortet` : `${total} Fragen`;
            const resume = LiDLearning.findPractice(data, mode) ? 'Fortsetzen · ' : '';
            const mistakes = errors ? ` · ${errors} ${errors === 1 ? 'offener Fehler' : 'offene Fehler'}` : '';
            return `<li>
              <button type="button" class="lid-mode lid-topic-button" data-lid-action="start-practice" data-value="${mode}"
                aria-labelledby="lid-topic-${mode}" aria-describedby="lid-note-${mode}">
                <span>
                  <strong id="lid-topic-${mode}">${escapeHtml(label)}</strong>
                  <span id="lid-note-${mode}" class="lid-mode-note">${resume}${attempts}${mistakes}</span>
                </span>
                ${svg('<path d="m9 6 6 6-6 6" stroke-linejoin="round"/>')}
              </button>
            </li>`;
          }).join('')}
        </ul>
      </div>`;
  }

  /** @param {LiDMode} mode */
  function practiceBack(mode) {
    return topicLabels.has(mode) ? button('Zu den Themen', 'topics') : button('Zur Übersicht', 'home');
  }

  function renderProfile(data) {
    const { perQuestion, stateSeen, firstPass, firstPassCorrect, openErrors } = LiDLearning.progress(data);
    const total = LiDLearning.questions.length;
    const exams = data.rounds.filter(round => round.mode === 'exam' && round.completion)
      .sort((a, b) => b.completion.at - a.completion.at)
      .map(round => ({ round, report: LiDLearning.examResult(round) }));
    const best = exams.reduce((max, { report }) => Math.max(max, report.correct), 0);
    const totalCorrect = exams.reduce((sum, { report }) => sum + report.correct, 0);

    return `<div class="lid-profile">
      ${mainNav('profile')}
      <header class="lid-intro"><h1 id="lid-heading" tabindex="-1">Lernstand</h1></header>
      <div class="lid-profile-grid">
        <section class="lid-profile-card" aria-labelledby="lid-progress-heading">
          <h2 id="lid-progress-heading">Lernfortschritt</h2>
          <p class="lid-progress-count"><strong>${perQuestion.size}</strong> von ${total} Fragen beantwortet</p>
          <progress class="lid-coverage" aria-label="Beantwortete Katalogfragen" value="${perQuestion.size}" max="${total}"></progress>
          <dl class="lid-metrics lid-profile-metrics">
            ${metric(`${stateSeen}/10`, 'Landesfragen beantwortet')}
            ${metric(percent(firstPassCorrect, firstPass), 'Beim ersten Versuch richtig')}
            ${metric(numbers.format(openErrors.length), 'Offene Fehler')}
          </dl>
        </section>
        <section class="lid-profile-card" aria-labelledby="lid-test-stats-heading">
          <h2 id="lid-test-stats-heading">Testergebnisse</h2>
          <dl class="lid-metrics lid-profile-metrics">
            ${metric(numbers.format(exams.length), 'Abgeschlossene Probetests')}
            ${metric(exams.length ? `${best}/${examSize}` : '–', 'Bestes Ergebnis')}
            ${metric(exams.length ? `${scores.format(totalCorrect / exams.length)}/${examSize}` : '–', 'Durchschnitt')}
            ${metric(percent(exams.filter(({ report }) => report.citizenship).length, exams.length), 'Einbürgerungsschwelle erreicht')}
          </dl>
        </section>
      </div>
      <section class="lid-section lid-profile-card" aria-labelledby="lid-test-history-heading">
        <h2 id="lid-test-history-heading">Bisherige Probetests</h2>
        ${exams.length ? `<ol class="lid-test-history">${exams.map(({ round, report }) => {
          const { at, elapsedMs } = round.completion;
          const date = new Date(at);
          const status = report.citizenship ? 'Einbürgerungsschwelle erreicht'
            : report.orientation ? 'Orientierungskurs bestanden' : 'Orientierungskurs nicht bestanden';
          return `<li>
            <div><time datetime="${date.toISOString()}">${testDate.format(date)}</time><span>${status}${elapsedMs === undefined ? '' : ` · ${formatClock(Math.ceil(elapsedMs / 1000))} Min.`}</span></div>
            ${button(`${report.correct}/${examSize} · Ergebnis ansehen`, 'show-result', { value: round.id })}
          </li>`;
        }).join('')}</ol>` : '<p class="lid-profile-empty">Hier erscheinen deine abgeschlossenen Probetests.</p>'}
      </section>
    </div>`;
  }

  /** @param {LiDData} data */
  function renderSaved(data) {
    const questions = data.savedQuestionIds.map(id => LiDLearning.byId.get(id)).filter(Boolean);
    return `<div class="lid-saved">
      ${mainNav('saved')}
      <header class="lid-intro"><h1 id="lid-heading" tabindex="-1">Gespeicherte Fragen</h1></header>
      ${questions.length ? `<ul class="lid-saved-list lid-profile-card">${questions.map(question => `
        <li class="lid-bookmark-row">
          <details>
            <summary>${escapeHtml(question.prompt)}</summary>
            ${figures(question)}
            ${options(question, null, 'checked')}
          </details>
          ${bookmarkButton(question.id, true)}
        </li>`).join('')}</ul>`
        : '<div class="lid-profile-card lid-saved-list"><p>Tippe bei einer Frage auf das Lesezeichen, um sie hier zu speichern.</p></div>'}
    </div>`;
  }

  function figures(question) {
    if (!question.figures?.length) return '';
    const numbered = question.figures.length > 1;
    return `<div class="lid-figures${numbered ? ' lid-figures-numbered' : ''}">${question.figures.map((figure, index) => {
      const src = `src/assets/lid/${figure.file}`;
      return `<figure>
        <a href="${src}" target="_blank" rel="noopener" aria-label="${numbered ? `Bild ${index + 1} vergrößern: ` : 'Abbildung vergrößern: '}${escapeHtml(figure.alt)}">
          <img src="${src}" alt="${escapeHtml(figure.alt)}" decoding="async">
        </a>
        ${numbered ? `<figcaption>Bild ${index + 1}</figcaption>` : ''}
      </figure>`;
    }).join('')}</div>`;
  }

  /** @param {'practice' | 'checked' | 'exam'} mode */
  function options(question, choice, mode) {
    const checked = mode === 'checked';
    return `<div class="lid-options">${question.options.map((label, index) => {
      if (mode === 'practice') return `<button type="submit" class="lid-option" name="lid-choice" value="${index}">
        <span class="lid-option-marker" aria-hidden="true"></span>
        <span>${escapeHtml(label)}</span>
      </button>`;
      const correct = checked && index === question.answer;
      const wrong = checked && index === choice && index !== question.answer;
      const status = correct ? ' lid-option-correct' : wrong ? ' lid-option-wrong' : '';
      return `<label class="lid-option${status}">
        <input type="radio" name="lid-choice" value="${index}"${index === choice ? ' checked' : ''}${checked ? ' disabled' : ' required'}>
        <span>${escapeHtml(label)}</span>
        ${correct ? `<span class="lid-choice-icon">${ICO.check}<span class="sr-only">Richtige Antwort</span></span>` : ''}
      </label>`;
    }).join('')}</div>`;
  }

  /** @param {'practice' | 'checked' | 'exam'} mode */
  function questionContent(question, choice = null, mode = 'exam') {
    return `<fieldset class="lid-question-fieldset">
      <legend id="lid-heading" tabindex="-1">${escapeHtml(question.prompt)}</legend>
      ${figures(question)}
      ${options(question, choice, mode)}
    </fieldset>`;
  }

  function renderPractice(data) {
    const { id, index, items } = data.practice;
    const round = data.rounds.find(item => item.id === id);
    const item = items[index];
    const question = LiDLearning.byId.get(item.questionId);
    const answer = round.attempts[index];
    const isLast = index + 1 === items.length;
    const total = items.filter(entry => !entry.retry).length;
    const position = items.slice(0, index + 1).filter(entry => !entry.retry).length;
    return `
      <div class="lid-workbar">
        ${practiceBack(round.mode)}
        <span>${escapeHtml(topicLabels.get(round.mode) || titles[round.mode])}</span>
      </div>
      <article class="lid-quiz">
        <header class="lid-quiz-meta">
          <span>${item.retry ? 'Wiederholung' : `Aufgabe ${position} von ${total}`}</span>
          <div class="lid-quiz-tools">
            <span>${item.questionId.startsWith('bw-') ? 'Baden-Württemberg' : 'Allgemein'}</span>
            ${bookmarkButton(question.id, data.savedQuestionIds.includes(question.id))}
          </div>
        </header>
        <form class="lid-exercise-form" data-lid-round="${id}" data-index="${index}">
          ${questionContent(question, answer?.choice, answer ? 'checked' : 'practice')}
          ${answer ? `<div id="lid-feedback" class="lid-feedback ${answer.correct ? 'lid-positive' : 'lid-negative'}" role="status" tabindex="-1">
            <strong>${answer.correct ? 'Richtig' : 'Falsch'}</strong>
            ${answer.correct ? '' : `<span>Richtige Antwort: ${escapeHtml(question.options[question.answer])}</span>`}
          </div>` : ''}
          <div class="lid-quiz-actions">
            ${answer ? button(isLast ? 'Ergebnis ansehen' : 'Weiter', 'next-practice', { primary: true }) : ''}
            ${button('Runde beenden', 'stop-practice', { variant: 'text' })}
          </div>
        </form>
      </article>`;
  }

  function formatClock(seconds) {
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  const secondsLeft = deadline => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  const countAnswers = exam => exam.selections.filter(choice => choice !== null).length;
  const answerCountText = exam => `${countAnswers(exam)}/${examSize} beantwortet`;

  function renderExamIntro() {
    return `
      <div class="lid-workbar">${button('Zur Übersicht', 'home')}</div>
      <section class="lid-quiz lid-results lid-exam-intro">
        <h1 id="lid-heading" tabindex="-1">Probetest</h1>
        <dl class="lid-metrics lid-result-metrics">
          ${metric(examSize, 'Fragen')}
          ${metric(examRules.minutes, 'Minuten')}
          ${metric(examRules.state, 'Landesfragen')}
        </dl>
        <h2>So läuft der Test ab</h2>
        <ol class="lid-exam-instructions">
          <li>Jeder Test enthält ${examRules.general} allgemeine Fragen und ${examRules.state} Fragen zu Baden-Württemberg. Die Fragen werden neu aus dem BAMF-Katalog gezogen.</li>
          <li>Wähle pro Frage eine der vier Antworten. Über die Aufgabenübersicht kannst du Fragen überspringen und deine Antworten ändern.</li>
          <li>Die Zeit läuft ab dem Start durch. Gib den Test vorher ab oder warte bis zum Zeitablauf. Danach siehst du die Auswertung und die Lösungen.</li>
        </ol>
        <div class="lid-quiz-actions">${button('Probetest starten', 'start-exam', { primary: true })}</div>
        <p class="lid-exam-source"><a href="https://oet.bamf.de/ords/oetut/f?p=532%3A2%3A%3A%3A%3A%3A%3A" target="_blank" rel="noopener">Bedienungshinweise des BAMF</a></p>
      </section>`;
  }

  function renderExam({ exam, savedQuestionIds }) {
    const question = LiDLearning.byId.get(exam.questionIds[exam.index]);
    const choice = exam.selections[exam.index];
    const remaining = secondsLeft(exam.deadline);
    const last = exam.index === examSize - 1;
    return `
      <div class="lid-exam" data-lid-round="${exam.id}" data-index="${exam.index}">
        <header class="lid-workbar lid-exam-toolbar">
          ${button('Zur Übersicht', 'home', { variant: 'text' })}
          <span class="lid-time${remaining <= 300 ? ' lid-time-urgent' : ''}" role="timer" aria-live="off" aria-label="Verbleibende Zeit">
            <span aria-hidden="true">${ICO.clock}</span><span id="lid-timer">${formatClock(remaining)}</span>
          </span>
        </header>
        <nav class="lid-exam-navigator" aria-label="Aufgabenübersicht">
          <div class="lid-exam-navigator-heading">
            <strong>Aufgabenübersicht</strong><span id="lid-exam-count" role="status">${answerCountText(exam)}</span>
          </div>
          <div class="lid-exam-grid">${exam.selections.map((choice, index) => `
            <button type="button" class="lid-exam-number${choice !== null ? ' lid-number-answered' : ''}" data-lid-action="move-exam" data-value="${index}"
              aria-label="Aufgabe ${index + 1}, ${choice !== null ? 'beantwortet' : 'offen'}"${exam.index === index ? ' aria-current="step"' : ''}>${index + 1}</button>`).join('')}</div>
        </nav>
        <article class="lid-quiz lid-exam-paper">
          <header class="lid-quiz-meta">
            <span>Probetest · Aufgabe ${exam.index + 1} von ${examSize}</span>
            ${bookmarkButton(question.id, savedQuestionIds.includes(question.id))}
          </header>
          ${questionContent(question, choice)}
          <div class="lid-quiz-actions lid-exam-actions">
            ${button('Zurück', 'move-exam', { value: exam.index - 1, disabled: exam.index === 0 })}
            ${last ? '' : button('Weiter', 'move-exam', { primary: true, value: exam.index + 1 })}
            ${button('Antwort entfernen', 'clear-exam-answer', { disabled: choice === null, variant: 'text' })}
            ${button('Test abgeben', 'ask-exam', { primary: last })}
          </div>
          <div class="lid-confirm" id="lid-confirm" hidden>
            <p id="lid-confirm-text" tabindex="-1"></p>
            <div class="lid-quiz-actions">
              ${button('Jetzt abgeben', 'finish-exam', { primary: true })}
              ${button('Weiter bearbeiten', 'cancel-exam')}
            </div>
          </div>
        </article>
      </div>`;
  }

  function corrections(round, savedQuestionIds) {
    const items = [...round.attempts.filter(item => !item.correct),
      ...round.completion.unanswered.map(questionId => ({ questionId, choice: null }))];
    if (!items.length) return '';
    const positions = new Map(round.completion.questionIds?.map((id, index) => [id, index + 1]));
    items.sort((a, b) => (positions.get(a.questionId) ?? 0) - (positions.get(b.questionId) ?? 0));
    return `<section class="lid-section lid-corrections" aria-labelledby="lid-corrections-heading">
      <h2 id="lid-corrections-heading">Falsche und offene Antworten</h2>
      ${items.map(item => {
        const question = LiDLearning.byId.get(item.questionId);
        if (!question) return '';
        const position = positions.get(item.questionId);
        const wrong = item.choice !== null;
        const old = item.revision && item.revision !== question.revision;
        return `<div class="lid-bookmark-row">
          <details${wrong ? ' open' : ''}>
            <summary><span class="${wrong ? 'lid-result-missed' : ''}">${wrong ? 'Falsch' : 'Offen'}</span> ${position ? `${position}. ` : ''}${escapeHtml(question.prompt)}</summary>
            ${old ? '<p>Die Frage wurde seit diesem Test im Katalog geändert.</p>' : `
              ${figures(question)}
              ${wrong ? `<p><strong>Deine Antwort</strong> ${escapeHtml(question.options[item.choice])}</p>` : ''}`}
            <p><strong>${old ? 'Aktuell richtige Antwort' : 'Richtige Antwort'}</strong> ${escapeHtml(question.options[question.answer])}</p>
          </details>
          ${bookmarkButton(question.id, savedQuestionIds.includes(question.id))}
        </div>`;
      }).join('')}
    </section>`;
  }

  function renderResult(round, data) {
    const isExam = round.mode === 'exam';
    const first = round.attempts.filter(item => !item.retry);
    const firstCorrect = first.filter(item => item.correct).length;
    const retried = round.attempts.length - first.length;
    const report = isExam ? LiDLearning.examResult(round) : null;
    const missedCount = LiDLearning.missedQuestionIds(round).length;
    const review = LiDLearning.findPractice(data, 'errors');
    const { elapsedMs } = round.completion;
    return `
      <div class="lid-workbar">${practiceBack(round.mode)}${button('Lernstand', 'profile', { variant: 'text' })}</div>
      <section class="lid-quiz lid-results">
        <h1 id="lid-heading" tabindex="-1">${isExam ? 'Ergebnis des Probetests' : 'Übungsrunde abgeschlossen'}</h1>
        ${report ? `
          <p>${round.completion.reason === 'expired' ? 'Die Zeit ist abgelaufen.' : 'Dein Test wurde ausgewertet.'}${elapsedMs === undefined ? '' : ` · ${formatClock(Math.ceil(elapsedMs / 1000))} Min. Bearbeitungszeit`}</p>
          <dl class="lid-metrics lid-result-metrics">
            ${metric(`${report.correct}/${examSize}`, 'Richtig')}
            ${metric(report.wrong, 'Falsch')}
            ${metric(report.unanswered, 'Offen')}
          </dl>
          <ul class="lid-thresholds">
            <li><strong>Orientierungskurs ab ${examRules.orientation}/${examSize}</strong><span>${report.orientation ? 'Schwelle erreicht' : 'Schwelle nicht erreicht'}</span></li>
            <li><strong>Kenntnisnachweis zur Einbürgerung ab ${examRules.citizenship}/${examSize}</strong><span>${report.citizenship ? 'Schwelle erreicht' : 'Schwelle nicht erreicht'}</span></li>
          </ul>` : `
          <p>${firstCorrect} von ${first.length} Aufgaben beim ersten Versuch richtig.</p>
          ${retried ? `<p>${retried} ${retried === 1 ? 'Aufgabe erneut geübt' : 'Aufgaben erneut geübt'}.</p>` : ''}`}
        ${missedCount ? `<div class="lid-result-review">
          ${review ? button('Fehlertraining fortsetzen', 'start-practice', { value: 'errors' })
            : button(`Nur Fehler üben (${missedCount})`, 'review-result', { primary: true, value: round.id })}
        </div>` : ''}
      </section>
      ${isExam ? corrections(round, data.savedQuestionIds) : ''}`;
  }

  function paint(focus = '') {
    if (!active) return;
    const data = LiDStore.read();
    const warning = LiDStore.warning();
    let content;
    if (!LiDLearning.ready) content = '<h1 id="lid-heading" tabindex="-1">Leben in Deutschland</h1><p>Der Fragenkatalog konnte nicht geladen werden.</p>';
    else if (screen === 'practice' && data.practice) content = renderPractice(data);
    else if (screen === 'topics') content = renderTopics(data);
    else if (screen === 'exam' && data.exam) content = renderExam(data);
    else if (screen === 'exam-intro') content = renderExamIntro();
    else if (screen === 'profile') content = renderProfile(data);
    else if (screen === 'saved') content = renderSaved(data);
    else if (screen === 'no-errors') content = `
      <div class="lid-workbar">${button('Zur Übersicht', 'home')}</div>
      <section class="lid-quiz lid-results">
        <h1 id="lid-heading" tabindex="-1">Fehlertraining</h1>
        <p>Du hast keine offenen Fehler. Falsch beantwortete Fragen aus Übungen und ausgewerteten Probetests erscheinen hier.</p>
      </section>`;
    else {
      const result = screen === 'result' && data.rounds.find(round => round.id === resultId && round.completion);
      content = result ? renderResult(result, data) : renderHome(data);
    }
    root.innerHTML = `<div class="lid">
      ${warning ? `<p class="lid-warning" role="status">${escapeHtml(warning)}</p>` : ''}
      <p id="lid-action-error" class="lid-warning" role="alert" hidden></p>
      ${content}
    </div>`;
    syncTimer(data.exam);
    if (focus) root.querySelector(focus)?.focus();
  }

  function showError(message) {
    const element = root?.querySelector('#lid-action-error');
    if (!active || !element) return;
    element.textContent = message;
    element.hidden = false;
    element.scrollIntoView({ block: 'nearest' });
  }

  function display(next, id = null, focus = '#lid-heading') {
    screen = next;
    resultId = id;
    if (focus === '#lid-heading') window.scrollTo(0, 0);
    paint(focus);
  }

  async function finishExam(id, timed = false) {
    if (finishing) return;
    finishing = true;
    try {
      const data = await LiDStore.update(current => LiDLearning.finishExam(current, id));
      if (data.rounds.some(round => round.id === id && round.completion)) {
        if (screen === 'exam' || (timed && screen === 'home')) display('result', id);
        else if (screen === 'profile' || screen === 'topics') paint();
      }
    } finally {
      finishing = false;
    }
  }

  function tick() {
    if (!active) return;
    const { exam } = LiDStore.read();
    if (!exam) return syncTimer(null);
    const clock = root.querySelector('#lid-timer');
    if (clock) {
      const remaining = secondsLeft(exam.deadline);
      clock.textContent = formatClock(remaining);
      clock.parentElement.classList.toggle('lid-time-urgent', remaining <= 300);
    }
    if (Date.now() >= exam.deadline) {
      void finishExam(exam.id, true).catch(() => showError('Der Probetest konnte nicht ausgewertet werden. Versuche es erneut.'));
    }
  }

  function syncTimer(exam) {
    if (!exam || !active) {
      clearInterval(timer);
      timer = null;
      return;
    }
    if (!timer) timer = setInterval(tick, 1000);
    if (Date.now() >= exam.deadline) queueMicrotask(tick);
  }

  function toggleExamConfirmation(show) {
    root.querySelector('#lid-confirm').hidden = !show;
    root.querySelector('.lid-question-fieldset').disabled = show;
    root.querySelector('.lid-exam-navigator').inert = show;
  }

  async function storeExamAnswer(id, index, choice, selectedAt = Date.now()) {
    const { exam } = await LiDStore.update(current => LiDLearning.selectExam(current, id, index, choice, selectedAt));
    if (!active || screen !== 'exam') return;
    if (!exam) return display('result', id);
    if (exam.id !== id || exam.index !== index) return;
    const selected = exam.selections[index] !== null;
    const count = root.querySelector('#lid-exam-count');
    if (count) count.textContent = answerCountText(exam);
    const item = root.querySelector(`.lid-exam-number[data-value="${index}"]`);
    if (item) {
      item.classList.toggle('lid-number-answered', selected);
      item.setAttribute('aria-label', `Aufgabe ${index + 1}, ${selected ? 'beantwortet' : 'offen'}`);
    }
    const clear = root.querySelector('[data-lid-action="clear-exam-answer"]');
    if (choice === null && !selected) {
      const input = root.querySelector('input[name="lid-choice"]:checked');
      if (input) input.checked = false;
      root.querySelector('#lid-heading')?.focus();
    }
    if (clear) clear.disabled = !selected;
    if (LiDStore.warning()) showError(LiDStore.warning());
  }

  async function action(event) {
    const trigger = event.target.closest('[data-lid-action]');
    if (!active || !trigger || trigger.disabled || pending) return;
    const { lidAction, value } = trigger.dataset;
    const owner = trigger.closest('[data-lid-round]');
    const id = owner?.dataset.lidRound;
    const index = Number(owner?.dataset.index);

    pending = true;
    try {
      if (lidAction === 'home') display('home');
      else if (lidAction === 'topics') display('topics');
      else if (lidAction === 'profile') display('profile');
      else if (lidAction === 'saved') display('saved');
      else if (lidAction === 'toggle-bookmark') {
        const data = await LiDStore.update(current => LiDLearning.toggleSavedQuestion(current, value));
        const saved = data.savedQuestionIds.includes(value);
        const row = screen === 'saved' && !saved ? trigger.closest('.lid-bookmark-row') : null;
        if (row) {
          const neighbor = (row.nextElementSibling || row.previousElementSibling)?.querySelector('.lid-bookmark');
          row.remove();
          if (neighbor) neighbor.focus();
          else paint('#lid-heading');
        } else {
          trigger.setAttribute('aria-pressed', String(saved));
          trigger.title = bookmarkTitle(saved);
        }
        if (LiDStore.warning()) showError(LiDStore.warning());
      } else if (lidAction === 'start-practice') {
        const data = await LiDStore.update(current => LiDLearning.startPractice(current, value, newRoundId()));
        const round = LiDLearning.findPractice(data, value);
        if (round) display('practice');
        else display(value === 'errors' ? 'no-errors' : 'home');
      } else if (lidAction === 'review-result') {
        const reviewId = newRoundId();
        const data = await LiDStore.update(current => LiDLearning.startMissedPractice(current, value, reviewId));
        if (data.practice?.id === reviewId) display('practice');
        else display('result', value);
      } else if (lidAction === 'next-practice') {
        const data = await LiDStore.update(current => LiDLearning.nextPractice(current, id, index));
        if (data.practice?.id === id) display('practice');
        else if (data.rounds.some(round => round.id === id && round.completion)) display('result', id);
        else display('home');
      } else if (lidAction === 'stop-practice') {
        const mode = LiDStore.read().rounds.find(round => round.id === id)?.mode;
        await LiDStore.update(current => LiDLearning.stopPractice(current, id));
        display(mode && topicLabels.has(mode) ? 'topics' : 'home');
      } else if (lidAction === 'exam-intro') display('exam-intro');
      else if (lidAction === 'start-exam') {
        const data = await LiDStore.update(current => LiDLearning.startExam(current, newRoundId()));
        display(data.exam ? 'exam' : 'home');
      } else if (lidAction === 'resume-exam') display('exam');
      else if (lidAction === 'move-exam') {
        const data = await LiDStore.update(current => LiDLearning.moveExam(current, id, Number(value)));
        display(data.exam ? 'exam' : 'result', id);
      } else if (lidAction === 'clear-exam-answer') {
        await storeExamAnswer(id, index, null);
      } else if (lidAction === 'ask-exam') {
        const exam = LiDStore.read().exam;
        if (!exam || Date.now() >= exam.deadline) await finishExam(id);
        else {
          const blanks = examSize - countAnswers(exam);
          const prompt = root.querySelector('#lid-confirm-text');
          prompt.textContent = blanks
            ? `${blanks} ${blanks === 1 ? 'Aufgabe ist' : 'Aufgaben sind'} noch offen. Probetest jetzt abgeben?`
            : 'Möchtest du den Probetest jetzt abgeben?';
          toggleExamConfirmation(true);
          prompt.focus();
        }
      } else if (lidAction === 'cancel-exam') {
        toggleExamConfirmation(false);
        root.querySelector('[data-lid-action="ask-exam"]')?.focus();
      } else if (lidAction === 'finish-exam') await finishExam(id);
      else if (lidAction === 'show-result') display('result', value);
    } catch (error) {
      showError('Die Aktion konnte nicht ausgeführt werden. Versuche es erneut.');
    } finally {
      pending = false;
    }
  }

  async function submit(event) {
    const form = event.target;
    if (!active || !form.matches('.lid-exercise-form')) return;
    event.preventDefault();
    const choice = event.submitter;
    if (choice?.name !== 'lid-choice' || pending) return;
    pending = true;
    try {
      const data = await LiDStore.update(current => LiDLearning.checkPractice(
        current, form.dataset.lidRound, Number(form.dataset.index), Number(choice.value),
      ));
      if (screen === 'practice') {
        if (data.practice) paint('#lid-feedback');
        else display('home');
      }
    } catch (error) {
      showError('Die Antwort konnte nicht verarbeitet werden. Versuche es erneut.');
    } finally {
      pending = false;
    }
  }

  async function change(event) {
    if (!active || screen !== 'exam') return;
    const target = event.target;
    if (target.name !== 'lid-choice' || !target.checked) return;
    const owner = target.closest('[data-lid-round]');
    if (!owner) return;
    try {
      await storeExamAnswer(owner.dataset.lidRound, Number(owner.dataset.index), Number(target.value));
    } catch (error) {
      showError('Die Antwort konnte nicht gespeichert werden. Versuche es erneut.');
    }
  }

  function setLanguage(de) {
    document.body.classList.toggle('lid-view-active', de);
    document.documentElement.lang = de ? 'de' : 'en';
    document.title = de ? 'Leben in Deutschland – DeutschDaily' : 'DeutschDaily';
    const theme = document.querySelector('meta[name="theme-color"]');
    if (theme) theme.content = de ? '#f4f6f2' : '#4F46E5';
    document.querySelectorAll('[data-text-de]').forEach(element => {
      element.textContent = de ? element.dataset.textDe : element.dataset.textEn;
    });
    document.querySelectorAll('[data-aria-de]').forEach(element => {
      element.setAttribute('aria-label', de ? element.dataset.ariaDe : element.dataset.ariaEn);
    });
  }

  function mount(element) {
    if (root !== element) {
      root = element;
      root.addEventListener('click', action);
      root.addEventListener('submit', submit);
      root.addEventListener('change', change);
    }
    const entering = !active;
    if (entering) setLanguage(true);
    active = true;
    const { exam } = LiDStore.read();
    // Restore and grade an expired test even when the tab was closed at the deadline.
    if (entering && exam && Date.now() >= exam.deadline) {
      void finishExam(exam.id, true).catch(() => showError('Der Probetest konnte nicht ausgewertet werden.'));
    }
    paint(entering ? '#lid-heading' : '');
  }

  function unmount() {
    if (!active) return;
    active = false;
    screen = 'home';
    setLanguage(false);
    syncTimer(null);
  }

  window.addEventListener('storage', event => {
    if (!active || event.key !== LiDStore.key) return;
    const state = LiDStore.read();
    if (screen === 'exam' && !state.exam) {
      const last = state.rounds.filter(round => round.mode === 'exam' && round.completion)
        .sort((a, b) => b.completion.at - a.completion.at)[0];
      display(last ? 'result' : 'home', last?.id);
    } else paint();
  });
  document.addEventListener('visibilitychange', () => {
    if (!active || document.hidden) return;
    tick();
    if (screen === 'home') paint();
  });

  return { mount, unmount, goHome: () => display('home') };
})();
