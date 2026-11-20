const LID_VIEW = 'leben-in-deutschland';

const LiDView = (() => {
  const titles = {
    daily: 'Heute üben',
    state: 'Landesfragen',
    errors: 'Fehler wiederholen',
  };
  const shortDate = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' });
  const numbers = new Intl.NumberFormat('de-DE');

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

  function button(label, action, { primary = false, disabled = false, value = '', variant = '', note = '' } = {}) {
    const style = primary ? ' lid-button-primary' : variant === 'text' ? ' lid-button-text' : '';
    const noteId = note && `lid-note-${value || action}`;
    const description = note ? ` aria-label="${escapeHtml(label)}" aria-describedby="${escapeHtml(noteId)}"` : '';
    return `<button type="button" class="lid-button${style}" data-lid-action="${action}" data-value="${escapeHtml(value)}"${description}${disabled ? ' disabled' : ''}>
      ${escapeHtml(label)}
      ${note ? `<span id="${escapeHtml(noteId)}" class="lid-button-note">${escapeHtml(note)}</span>` : ''}
    </button>`;
  }

  function metric(value, label) {
    return `<div class="lid-metric"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
  }

  const percent = (numerator, denominator) => denominator ? `${Math.round(numerator / denominator * 100)} %` : '–';

  function errorRows(entries) {
    return `<ol class="lid-mistakes">${entries.map(({ question, wrong, open, due, revised }) => `
      <li>
        <div>
          <div class="lid-mistake-scope">${question.id.startsWith('bw-') ? 'Baden-Württemberg' : 'Allgemein'}, Aufgabe ${Number(question.id.split('-')[1])}</div>
          <div>${escapeHtml(question.prompt)}</div>
        </div>
        <div class="lid-mistake-count">
          <strong>${wrong}× falsch</strong>
          <span>${revised ? 'Aktualisierte Aufgabe' : open ? `Fällig: ${shortDate.format(parseDateKey(due))}` : 'Aufgearbeitet'}</span>
        </div>
      </li>`).join('')}</ol>`;
  }

  function renderHome(data) {
    const stats = LiDLearning.progress(data);
    const attempted = stats.perQuestion.size;
    const total = LiDLearning.questions.length;
    const todayCount = Math.min(LiDLearning.batchSize, stats.due.length + total - attempted);
    const lastExam = data.rounds.filter(round => round.mode === 'exam' && round.completion)
      .sort((a, b) => b.completion.at - a.completion.at)[0];
    const checked = LID_SOURCE.verified.split('-').reverse().join('.');
    const study = data.rounds.find(round => round.id === data.practice?.id);

    const dailyNote = todayCount
      ? `${todayCount} ${todayCount === 1 ? 'Frage' : 'Fragen'}${stats.due.length ? ', fällige zuerst' : ''}`
      : 'Heute sind keine Fragen fällig';
    const errorCount = stats.openErrors.length;
    const errorNote = errorCount ? `${errorCount} ${errorCount === 1 ? 'offene Frage' : 'offene Fragen'}` : 'Keine Fehler zur Wiederholung';
    const practiceButton = study
      ? button('Übung fortsetzen', 'resume-practice', {
        primary: true, note: `${titles[study.mode]}, ${study.attempts.length} beantwortet`,
      })
      : button('Heute üben', 'start-practice', {
        primary: true, value: 'daily', disabled: !todayCount, note: dailyNote,
      });

    return `
      <div class="lid-home">
        <header class="lid-intro">
          <h1 id="lid-heading" tabindex="-1">Leben in Deutschland</h1>
          <p>${total} offizielle BAMF-Fragen für Baden-Württemberg</p>
        </header>
        <div class="lid-home-actions">
          ${practiceButton}
          ${button(data.exam ? 'Probetest fortsetzen' : 'Probetest starten', data.exam ? 'resume-exam' : 'start-exam', {
            note: '33 Fragen in 60 Minuten',
          })}
          ${button('Landesfragen üben', 'start-practice', {
            value: 'state', disabled: !!study, note: '10 Fragen zu Baden-Württemberg',
          })}
          ${button('Fehler wiederholen', 'start-practice', {
            value: 'errors', disabled: !!study || !errorCount, note: errorNote,
          })}
        </div>
        ${study ? '<p class="lid-home-note">Beende deine laufende Übung, um den Übungsmodus zu wechseln.</p>' : ''}
        <section class="lid-home-progress" aria-labelledby="lid-progress-heading">
          <div class="lid-progress-heading">
            <h2 id="lid-progress-heading">Fortschritt</h2>
            <span>${attempted} von ${total} Fragen</span>
          </div>
          <progress class="lid-coverage" aria-label="Bearbeitete Fragen" value="${attempted}" max="${total}"></progress>
          <details id="lid-fortschritt" class="lid-home-details">
            <summary>Statistik und Fehlerverlauf</summary>
            ${stats.attempts || stats.completed ? `<dl class="lid-metrics">
              ${metric(numbers.format(stats.todayCount), 'Antworten heute')}
              ${metric(numbers.format(stats.attempts), 'Antworten insgesamt')}
              ${metric(numbers.format(stats.completed), 'Runden abgeschlossen')}
              ${metric(numbers.format(stats.days), 'Aktive Lerntage')}
              ${metric(percent(stats.firstPassCorrect, stats.firstPass), 'Ersttreffer in Übungen')}
              ${metric(stats.due.length, 'Wiederholungen fällig')}
            </dl>` : '<p class="lid-home-note">Deine Statistik erscheint hier, sobald du eine Frage beantwortet hast.</p>'}
            ${lastExam ? button(`Letzter Test (${LiDLearning.examResult(lastExam).correct}/33)`, 'show-result', { value: lastExam.id, variant: 'text' }) : ''}
            ${stats.errors.length ? `<div class="lid-error-panel">
              <h3>Fehler pro Aufgabe</h3>
              <p>${stats.openErrors.filter(error => error.wrong >= 2).length} Aufgaben mit wiederholten, offenen Fehlern</p>
              ${errorRows(stats.errors.slice(0, 5))}
              ${stats.errors.length > 5 ? `<details><summary>Weitere Aufgaben anzeigen</summary>${errorRows(stats.errors.slice(5))}</details>` : ''}
            </div>` : ''}
          </details>
        </section>
        <footer class="lid-footer">
          <details id="lid-quellen" class="lid-home-details">
            <summary>Lernmethode und Quellen</summary>
            <p>Überlege dir zuerst selbst eine Antwort. Bei richtigen Wiederholungen wächst der Abstand auf 1, 3, 7, 14 und 30 Tage. Nach einem Fehler ist die Aufgabe morgen wieder fällig.</p>
            <p>BAMF-Katalogstand ${LID_SOURCE.edition}. Lösungen geprüft am ${checked}.</p>
            <ul>
              <li><a href="${escapeHtml(LID_SOURCE.pdf)}" target="_blank" rel="noopener">Offizieller BAMF-Fragenkatalog</a></li>
              <li><a href="${escapeHtml(LID_SOURCE.testCenter)}" target="_blank" rel="noopener">BAMF Online-Testcenter mit Lösungen</a></li>
              <li><a href="${escapeHtml(LID_SOURCE.regulation)}" target="_blank" rel="noopener">Amtliche Abbildungen</a></li>
            </ul>
          </details>
          <details id="lid-sicherung" class="lid-home-details">
            <summary>Sicherung</summary>
            <p>Übertrage deinen Lernstand auf ein anderes Gerät.</p>
            <div class="lid-footer-actions">
              ${button('Sicherung herunterladen', 'export')}
              ${button('Sicherung importieren', 'import')}
              <input id="lid-backup-input" type="file" accept=".json,application/json" hidden>
            </div>
            <p id="import-err" role="alert" class="lid-import-error" style="display:none"></p>
          </details>
        </footer>
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

  function options(question, choice, checked, disabled) {
    return `<div class="lid-options">${question.options.map((label, index) => {
      const correct = checked && index === question.answer;
      const wrong = checked && index === choice && index !== question.answer;
      const status = correct ? ' lid-option-correct' : wrong ? ' lid-option-wrong' : '';
      return `<label class="lid-option${status}">
        <input type="radio" name="lid-choice" value="${index}"${index === choice ? ' checked' : ''}${disabled ? ' disabled' : ' required'}>
        <span>${escapeHtml(label)}</span>
        ${correct ? `<span class="lid-choice-icon" title="Richtige Antwort">${ICO.check}</span>` : ''}
      </label>`;
    }).join('')}</div>`;
  }

  function questionContent(question, choice = null, checked = false) {
    return `<fieldset class="lid-question-fieldset">
      <legend id="lid-heading" tabindex="-1">${escapeHtml(question.prompt)}</legend>
      ${figures(question)}
      ${options(question, choice, checked, checked)}
    </fieldset>`;
  }

  function renderPractice(data) {
    const { id, index, items } = data.practice;
    const round = data.rounds.find(item => item.id === id);
    const item = items[index];
    const question = LiDLearning.byId.get(item.questionId);
    const answer = round.attempts[index];
    const isLast = index + 1 === items.length;
    return `
      <div class="lid-workbar">
        ${button('Zur Übersicht', 'home')}
        <span>${titles[round.mode]}</span>
      </div>
      <article class="lid-quiz">
        <header class="lid-quiz-meta">
          <span>Aufgabe ${index + 1} von ${items.length}${item.retry ? ' (Wiederholung)' : ''}</span>
          <span>${item.questionId.startsWith('bw-') ? 'Baden-Württemberg' : 'Allgemein'}</span>
        </header>
        <form class="lid-exercise-form" data-lid-round="${id}" data-index="${index}">
          ${questionContent(question, answer?.choice, Boolean(answer))}
          ${answer ? `<div id="lid-feedback" class="lid-feedback ${answer.correct ? 'lid-positive' : 'lid-negative'}" role="status" tabindex="-1">
            <strong>${answer.correct ? 'Richtig' : 'Falsch'}</strong>
            ${answer.correct ? '' : `<span>Richtige Antwort: ${escapeHtml(question.options[question.answer])}</span>`}
          </div>` : ''}
          <div class="lid-quiz-actions">
            ${answer ? button(isLast ? 'Ergebnis ansehen' : 'Weiter', 'next-practice', { primary: true }) : '<button type="submit" class="lid-button lid-button-primary" disabled>Antwort prüfen</button>'}
            ${button('Runde beenden', 'stop-practice')}
          </div>
        </form>
      </article>`;
  }

  function timeLeft(deadline) {
    const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function renderExam({ exam }) {
    const question = LiDLearning.byId.get(exam.questionIds[exam.index]);
    const answered = exam.selections.filter(choice => choice !== null).length;
    return `
      <div class="lid-workbar">
        ${button('Zur Übersicht', 'home')}
        <span class="lid-time" role="timer" aria-live="off" aria-label="Verbleibende Zeit"><span aria-hidden="true">${ICO.clock}</span><span id="lid-timer">${timeLeft(exam.deadline)}</span></span>
      </div>
      <article class="lid-quiz" data-lid-round="${exam.id}" data-index="${exam.index}">
        <header class="lid-quiz-meta">
          <span>Probetest, Aufgabe ${exam.index + 1} von 33</span>
          <span id="lid-exam-count">${answered}/33 beantwortet</span>
        </header>
        ${questionContent(question, exam.selections[exam.index])}
        <div class="lid-quiz-actions">
          ${button('Zurück', 'move-exam', { value: exam.index - 1, disabled: exam.index === 0 })}
          ${exam.index < 32 ? button('Weiter', 'move-exam', { primary: true, value: exam.index + 1 }) : ''}
          ${button('Test abgeben', 'ask-exam', { primary: exam.index === 32 })}
        </div>
        <div class="lid-confirm" id="lid-confirm" hidden>
          <p id="lid-confirm-text" tabindex="-1"></p>
          <div class="lid-quiz-actions">
            ${button('Jetzt abgeben', 'finish-exam', { primary: true })}
            ${button('Weiter bearbeiten', 'cancel-exam')}
          </div>
        </div>
        <details class="lid-exam-jump">
          <summary>Aufgabenübersicht</summary>
          <div class="lid-exam-grid">${exam.selections.map((choice, index) => `
            <button type="button" class="lid-exam-number${choice !== null ? ' lid-number-answered' : ''}" data-lid-action="move-exam" data-value="${index}"
              aria-label="Aufgabe ${index + 1}, ${choice !== null ? 'beantwortet' : 'offen'}"${exam.index === index ? ' aria-current="step"' : ''}>${index + 1}</button>`).join('')}</div>
        </details>
      </article>`;
  }

  function corrections(round) {
    const wrong = round.attempts.filter(item => !item.correct);
    const open = round.completion.unanswered.map(questionId => ({ questionId, choice: null }));
    if (!wrong.length && !open.length) return '';
    return `<section class="lid-section lid-corrections" aria-labelledby="lid-corrections-heading">
      <h2 id="lid-corrections-heading">Aufgaben nachlesen</h2>
      ${[...wrong, ...open].map(item => {
        const question = LiDLearning.byId.get(item.questionId);
        if (!question) return '';
        const old = item.revision && item.revision !== question.revision;
        return `<details>
          <summary><span class="${item.choice === null ? '' : 'lid-result-missed'}">${item.choice === null ? 'Offen' : 'Falsch'}</span> ${escapeHtml(question.prompt)}</summary>
          ${old ? '<p>Die Antwort stammt aus einem früheren Katalogstand.</p>' : `
            ${figures(question)}
            ${item.choice === null ? '' : `<p>Deine Antwort: ${escapeHtml(question.options[item.choice])}</p>`}
            <p><strong>Richtige Antwort:</strong> ${escapeHtml(question.options[question.answer])}</p>`}
        </details>`;
      }).join('')}
    </section>`;
  }

  function renderResult(round) {
    const isExam = round.mode === 'exam';
    const first = round.attempts.filter(item => !item.retry);
    const firstCorrect = first.filter(item => item.correct).length;
    const retried = round.attempts.length - first.length;
    const report = isExam ? LiDLearning.examResult(round) : null;
    return `
      <div class="lid-workbar">${button('Zur Übersicht', 'home')}</div>
      <section class="lid-quiz lid-results">
        <h1 id="lid-heading" tabindex="-1">${isExam ? 'Ergebnis des Probetests' : 'Übungsrunde abgeschlossen'}</h1>
        ${report ? `
          <p>${round.completion.reason === 'expired' ? 'Die Zeit ist abgelaufen.' : 'Dein Test wurde ausgewertet.'}</p>
          <dl class="lid-metrics lid-result-metrics">
            ${metric(`${report.correct}/33`, 'Richtig')}
            ${metric(report.wrong, 'Falsch')}
            ${metric(report.unanswered, 'Offen')}
          </dl>
          <ul class="lid-thresholds">
            <li><strong>Orientierungskurs ab 15/33</strong><span>${report.orientation ? 'Schwelle erreicht' : 'Schwelle nicht erreicht'}</span></li>
            <li><strong>Kenntnisnachweis zur Einbürgerung ab 17/33</strong><span>${report.citizenship ? 'Schwelle erreicht' : 'Schwelle nicht erreicht'}</span></li>
          </ul>` : `
          <p>${firstCorrect} von ${first.length} Aufgaben beim ersten Versuch richtig.</p>
          ${retried ? `<p>${retried} ${retried === 1 ? 'Aufgabe erneut geübt' : 'Aufgaben erneut geübt'}.</p>` : ''}
          ${first.length - firstCorrect ? '<p>Offene Fehler findest du unter „Fehler wiederholen“.</p>' : ''}`}
      </section>
      ${isExam ? corrections(round) : ''}`;
  }

  function paint(focus = '') {
    if (!active) return;
    const data = LiDStore.read();
    const warning = LiDStore.warning();
    let content;
    if (!LiDLearning.ready) content = '<h1 id="lid-heading" tabindex="-1">Leben in Deutschland</h1><p>Der Fragenkatalog konnte nicht geladen werden.</p>';
    else if (screen === 'practice' && data.practice) content = renderPractice(data);
    else if (screen === 'exam' && data.exam) content = renderExam(data);
    else {
      const result = screen === 'result' && data.rounds.find(round => round.id === resultId && round.completion);
      content = result ? renderResult(result) : renderHome(data);
    }
    const openDetails = root.querySelectorAll('.lid-home-details[open]');
    root.innerHTML = `<div class="lid">
      ${warning ? `<p class="lid-warning" role="status">${escapeHtml(warning)}</p>` : ''}
      <p id="lid-action-error" class="lid-warning" role="alert" hidden></p>
      ${content}
    </div>`;
    for (const { id } of openDetails) {
      const details = document.getElementById(id);
      if (details) details.open = true;
    }
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
    if (clock) clock.textContent = timeLeft(exam.deadline);
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
      else if (lidAction === 'start-practice') {
        const data = await LiDStore.update(current => LiDLearning.startPractice(current, value, newRoundId()));
        display(data.practice ? 'practice' : 'home');
      } else if (lidAction === 'resume-practice') display('practice');
      else if (lidAction === 'next-practice') {
        const data = await LiDStore.update(current => LiDLearning.nextPractice(current, id, index));
        if (data.practice?.id === id) display('practice');
        else if (data.rounds.some(round => round.id === id && round.completion)) display('result', id);
        else display('home');
      } else if (lidAction === 'stop-practice') {
        await LiDStore.update(current => LiDLearning.stopPractice(current, id));
        display('home');
      } else if (lidAction === 'start-exam') {
        await LiDStore.update(current => LiDLearning.startExam(current, newRoundId()));
        display('exam');
      } else if (lidAction === 'resume-exam') display('exam');
      else if (lidAction === 'move-exam') {
        const data = await LiDStore.update(current => LiDLearning.moveExam(current, id, Number(value)));
        display(data.exam ? 'exam' : 'result', id);
      } else if (lidAction === 'ask-exam') {
        const exam = LiDStore.read().exam;
        if (!exam || Date.now() >= exam.deadline) await finishExam(id);
        else {
          const blanks = exam.selections.filter(choice => choice === null).length;
          const prompt = root.querySelector('#lid-confirm-text');
          prompt.textContent = blanks
            ? `${blanks} ${blanks === 1 ? 'Aufgabe ist' : 'Aufgaben sind'} noch offen. Probetest jetzt abgeben?`
            : 'Möchtest du den Probetest jetzt abgeben?';
          root.querySelector('#lid-confirm').hidden = false;
          prompt.focus();
        }
      } else if (lidAction === 'cancel-exam') {
        root.querySelector('#lid-confirm').hidden = true;
        root.querySelector('[data-lid-action="ask-exam"]')?.focus();
      } else if (lidAction === 'finish-exam') await finishExam(id);
      else if (lidAction === 'show-result') display('result', value);
      else if (lidAction === 'export') downloadBackupFile();
      else if (lidAction === 'import') root.querySelector('#lid-backup-input')?.click();
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
    const choice = form.querySelector('input[name="lid-choice"]:checked');
    const submitButton = form.querySelector('button[type="submit"]');
    if (!choice || !submitButton || pending) return;
    pending = true;
    submitButton.disabled = true;
    try {
      const data = await LiDStore.update(current => LiDLearning.checkPractice(
        current, form.dataset.lidRound, Number(form.dataset.index), Number(choice.value),
      ));
      if (screen === 'practice') {
        if (data.practice) paint('#lid-feedback');
        else display('home');
      }
    } catch (error) {
      submitButton.disabled = false;
      showError('Die Antwort konnte nicht verarbeitet werden. Versuche es erneut.');
    } finally {
      pending = false;
    }
  }

  async function change(event) {
    if (!active) return;
    const target = event.target;
    if (target.id === 'lid-backup-input') {
      const file = target.files[0];
      if (!file) return;
      try {
        await applyImport(await file.text());
      } catch (error) {
        showError('Die Sicherungsdatei konnte nicht gelesen werden.');
      } finally {
        target.value = '';
      }
      return;
    }
    if (target.name !== 'lid-choice' || !target.checked) return;
    if (screen === 'practice') {
      const submitButton = target.form.querySelector('button[type="submit"]');
      if (submitButton) submitButton.disabled = false;
      return;
    }
    if (screen !== 'exam') return;
    const owner = target.closest('[data-lid-round]');
    const id = owner.dataset.lidRound;
    const selectedAt = Date.now();
    try {
      const { exam } = await LiDStore.update(current => LiDLearning.selectExam(
        current, id, Number(owner.dataset.index), Number(target.value), selectedAt,
      ));
      if (!active || screen !== 'exam') return;
      if (!exam) return display('result', id);
      const count = root.querySelector('#lid-exam-count');
      if (count) count.textContent = `${exam.selections.filter(choice => choice !== null).length}/33 beantwortet`;
      const item = root.querySelector(`.lid-exam-number[data-value="${exam.index}"]`);
      if (item && exam.selections[exam.index] !== null) {
        item.classList.add('lid-number-answered');
        item.setAttribute('aria-label', `Aufgabe ${exam.index + 1}, beantwortet`);
      }
      if (LiDStore.warning()) showError(LiDStore.warning());
    } catch (error) {
      showError('Die Antwort konnte nicht gespeichert werden. Versuche es erneut.');
    }
  }

  function setLanguage(de) {
    document.body.classList.toggle('lid-view-active', de);
    document.documentElement.lang = de ? 'de' : 'en';
    document.title = de ? 'Leben in Deutschland – DeutschDaily' : 'DeutschDaily';
    const theme = document.querySelector('meta[name="theme-color"]');
    if (theme) theme.content = de ? '#f2f3ef' : '#4F46E5';
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
