/** @typedef {'politics' | 'history' | 'society'} LiDGeneralTopic */
/** @typedef {LiDGeneralTopic | 'state'} LiDTopic */
/** @typedef {'all' | 'daily' | 'errors' | LiDTopic} LiDPracticeMode */
/** @typedef {LiDPracticeMode | 'exam'} LiDMode */
/** @typedef {{ questionId: string, revision: string, choice: number, correct: boolean, at: number, day: string, retry: boolean }} LiDAttempt */
/** @typedef {{ at: number, reason: 'finished' | 'submitted' | 'expired', unanswered: string[], questionIds?: string[], elapsedMs?: number }} LiDCompletion */
/** @typedef {{ id: string, mode: LiDMode, attempts: LiDAttempt[], completion: LiDCompletion | null }} LiDRound */
/** @typedef {{ id: string, edition: string, index: number, items: { questionId: string, retry: boolean }[] }} LiDPractice */
/** @typedef {{ id: string, edition: string, index: number, questionIds: string[], selections: (number | null)[], deadline: number }} LiDExam */
/** @typedef {{ version: number, rounds: LiDRound[], practice: LiDPractice | null, parkedPractices: LiDPractice[], exam: LiDExam | null, savedQuestionIds: string[] }} LiDData */

const LiDLearning = (() => {
  const questions = typeof LID_QUESTIONS === 'undefined' ? [] : LID_QUESTIONS;
  const byId = new Map(questions.map(question => [question.id, question]));
  const stateIds = questions.filter(question => question.id.startsWith('bw-')).map(question => question.id);
  const generalIds = questions.filter(question => question.id.startsWith('de-')).map(question => question.id);
  const edition = typeof LID_SOURCE === 'undefined' ? '' : LID_SOURCE.revision;
  const ready = !!edition && generalIds.length === 300 && stateIds.length === 10 && byId.size === 310;
  const topics = /** @type {const} */ ([
    { mode: 'politics', label: 'Politik in der Demokratie' },
    { mode: 'history', label: 'Geschichte und Verantwortung' },
    { mode: 'society', label: 'Mensch und Gesellschaft' },
    { mode: 'state', label: 'Baden-Württemberg' },
  ]);
  // The catalog groups most questions by subject. These questions fit a different course theme.
  /** @type {Partial<Record<number, LiDGeneralTopic>>} */
  const topicExceptions = {
    2: 'society', 59: 'history', 66: 'society', 95: 'society', 118: 'society', 149: 'society',
    171: 'politics', 182: 'society', 212: 'politics', 213: 'politics', 214: 'politics', 216: 'politics',
    243: 'politics', 274: 'politics', 282: 'politics', 288: 'history',
  };

  /** @param {string} questionId @returns {LiDTopic} */
  function topicForQuestion(questionId) {
    if (questionId.startsWith('bw-')) return 'state';
    const number = Number(questionId.slice(3));
    const exception = topicExceptions[number];
    if (exception) return exception;
    if (number <= 150) return 'politics';
    if (number <= 240) return 'history';
    return 'society';
  }

  const topicById = new Map(questions.map(({ id }) => [id, topicForQuestion(id)]));
  /** @type {ReadonlyMap<LiDMode, string[]>} */
  const idsByTopic = new Map(topics.map(({ mode }) => [
    mode, questions.filter(({ id }) => topicById.get(id) === mode).map(({ id }) => id),
  ]));
  const modes = ['all', 'daily', 'errors', 'exam', ...idsByTopic.keys()];
  const intervals = [1, 3, 7, 14, 30];
  const batchSize = 10;
  const examRules = Object.freeze({ general: 30, state: 3, minutes: 60, orientation: 15, citizenship: 17 });
  const examSize = examRules.general + examRules.state;
  const examTime = examRules.minutes * 60_000;
  const practiceLimits = {
    all: questions.length + batchSize, daily: batchSize * 2, errors: questions.length,
    state: stateIds.length * 2, politics: generalIds.length, history: generalIds.length, society: generalIds.length,
  };

  /** @returns {LiDData} */
  function blank() {
    return { version: 1, rounds: [], practice: null, parkedPractices: [], exam: null, savedQuestionIds: [] };
  }

  const validActiveIndex = (index, size) => Number.isInteger(index) && index >= 0 && index < size;
  const validChoice = choice => validActiveIndex(choice, 4);
  const validTimestamp = value => Number.isSafeInteger(value) && value > 0 && value <= 8640000000000000;
  const validQuestionId = value => typeof value === 'string' && /^(?:de-(?:00[1-9]|0[1-9][0-9]|[12][0-9]{2}|300)|bw-(?:0[1-9]|10))$/.test(value);
  const validRoundId = value => typeof value === 'string' && /^[a-f0-9-]{16,40}$/.test(value);

  function normalizeRound(raw) {
    if (!raw || !validRoundId(raw.id) || !modes.includes(raw.mode) || !Array.isArray(raw.attempts)) return null;
    const isExam = raw.mode === 'exam';
    if (raw.attempts.length > (isExam ? examSize : practiceLimits[raw.mode])) return null;
    const seen = new Set();
    const attempts = [];
    for (const item of raw.attempts) {
      if (!item || !validQuestionId(item.questionId) || !/^[a-f0-9]{16}$/.test(item.revision)
        || !validChoice(item.choice) || typeof item.correct !== 'boolean' || !validTimestamp(item.at)
        || typeof item.retry !== 'boolean' || (isExam && item.retry)) return null;
      const day = normalizeDateKey(item.day);
      const key = item.questionId + (item.retry ? '/retry' : '');
      if (!day || seen.has(key)) return null;
      seen.add(key);
      attempts.push({
        questionId: item.questionId, revision: item.revision, choice: item.choice,
        correct: item.correct, at: item.at, day, retry: item.retry,
      });
    }
    let completion = null;
    if (raw.completion != null) {
      const { at, reason, unanswered } = raw.completion;
      if (!validTimestamp(at) || !Array.isArray(unanswered)) return null;
      completion = { at, reason, unanswered: [...unanswered] };
      if (isExam) {
        const examIds = [...attempts.map(item => item.questionId), ...unanswered];
        if (!['submitted', 'expired'].includes(reason) || !validExamIds(examIds)) return null;
        const { questionIds, elapsedMs } = raw.completion;
        if (Array.isArray(questionIds) && validExamIds(questionIds) && questionIds.every(id => examIds.includes(id))) {
          completion.questionIds = [...questionIds];
        }
        if (Number.isSafeInteger(elapsedMs) && elapsedMs >= 0 && elapsedMs <= examTime) completion.elapsedMs = elapsedMs;
      } else if (reason !== 'finished' || !attempts.length || unanswered.length) return null;
    } else if (isExam && attempts.length) return null;
    return { id: raw.id, mode: raw.mode, attempts, completion };
  }

  function validExamIds(ids) {
    return ids.length === examSize && ids.every(validQuestionId) && new Set(ids).size === examSize
      && ids.filter(id => id.startsWith('bw-')).length === examRules.state;
  }

  function mergeRounds(existing, incoming) {
    const byRound = new Map(existing.map(round => [round.id, round]));
    for (const candidate of incoming) {
      const current = byRound.get(candidate.id);
      if (!current || (!current.completion && (candidate.completion || candidate.attempts.length > current.attempts.length))) {
        byRound.set(candidate.id, candidate);
      }
    }
    return [...byRound.values()];
  }

  function readRounds(raw) {
    if (raw?.version !== 1 || !Array.isArray(raw.rounds)) return null;
    const records = raw.rounds.map(normalizeRound);
    return records.includes(null) ? null : mergeRounds([], records);
  }

  /** @param {unknown} raw @returns {string[]} */
  function readSavedQuestionIds(raw) {
    return Array.isArray(raw) ? [...new Set(raw.filter(validQuestionId))] : [];
  }

  /** @param {LiDData} data @param {string} questionId */
  function toggleSavedQuestion(data, questionId) {
    if (!byId.has(questionId)) return data;
    const saved = data.savedQuestionIds;
    return {
      ...data,
      savedQuestionIds: saved.includes(questionId) ? saved.filter(id => id !== questionId) : [questionId, ...saved],
    };
  }

  function readPractice(raw, rounds) {
    if (!raw || raw.edition !== edition || !Array.isArray(raw.items)
      || !validActiveIndex(raw.index, raw.items.length)) return null;
    const round = rounds.find(item => item.id === raw.id && !item.completion && item.mode !== 'exam');
    if (!round || raw.items.length > practiceLimits[round.mode]
      || round.attempts.length < raw.index || round.attempts.length > raw.index + 1) return null;
    const seen = new Set();
    const items = [];
    const isTopicRound = idsByTopic.has(round.mode);
    for (const [index, item] of raw.items.entries()) {
      if (!item || !byId.has(item.questionId) || typeof item.retry !== 'boolean') return null;
      if (isTopicRound && topicById.get(item.questionId) !== round.mode) return null;
      const key = item.questionId + (item.retry ? '/retry' : '');
      if (seen.has(key) || (item.retry && !seen.has(item.questionId))) return null;
      const attempt = round.attempts[index];
      if (attempt && (attempt.questionId !== item.questionId || attempt.retry !== item.retry)) return null;
      seen.add(key);
      // Retain answered retries for history and remove pending retries from older rounds.
      if (attempt || !item.retry) items.push({ questionId: item.questionId, retry: item.retry });
    }
    return { id: raw.id, edition, index: Math.min(raw.index, items.length - 1), items };
  }

  function readExam(raw, rounds) {
    if (!raw || raw.edition !== edition || !validTimestamp(raw.deadline)
      || !Array.isArray(raw.questionIds) || !validExamIds(raw.questionIds)
      || !Array.isArray(raw.selections) || raw.selections.length !== examSize
      || !raw.selections.every(choice => choice === null || validChoice(choice))
      || !validActiveIndex(raw.index, examSize)) return null;
    if (!rounds.some(item => item.id === raw.id && !item.completion && item.mode === 'exam')) return null;
    return {
      id: raw.id, edition, index: raw.index, deadline: raw.deadline,
      questionIds: [...raw.questionIds], selections: [...raw.selections],
    };
  }

  const practiceGroup = mode => mode === 'daily' ? 'all' : mode;

  function readData(raw) {
    const rounds = readRounds(raw);
    if (!rounds) return null;
    const rawParked = Array.isArray(raw.parkedPractices) ? raw.parkedPractices : [raw.pausedPractice];
    const practiceModes = new Set();
    const practices = [];
    for (const candidate of [raw.practice, ...rawParked]) {
      const practice = readPractice(candidate, rounds);
      if (!practice) continue;
      const mode = practiceGroup(rounds.find(round => round.id === practice.id).mode);
      if (practiceModes.has(mode)) continue;
      practiceModes.add(mode);
      practices.push(practice);
    }
    const [practice = null, ...parkedPractices] = practices;
    const exam = readExam(raw.exam, rounds);
    const activeIds = new Set([...practices.map(item => item.id), exam?.id]);
    return {
      version: 1,
      rounds: rounds.filter(round => round.attempts.length || round.completion || activeIds.has(round.id)),
      practice,
      parkedPractices,
      exam,
      savedQuestionIds: readSavedQuestionIds(raw.savedQuestionIds),
    };
  }

  function replaceRound(data, updated) {
    return data.rounds.map(round => round.id === updated.id ? updated : round);
  }

  function makeAttempt(questionId, choice, retry, now) {
    const question = byId.get(questionId);
    return {
      questionId, revision: question.revision, choice, correct: choice === question.answer,
      at: now, day: dateKey(now), retry,
    };
  }

  function reviewOn(day, offset) {
    return addDaysKey(offset, parseDateKey(day));
  }

  function progress(data, day = today()) {
    const perQuestion = new Map();
    const days = new Set();
    const entries = data.rounds.flatMap(round => round.attempts.map(attempt => ({ attempt, mode: round.mode })));
    entries.sort((a, b) => a.attempt.at - b.attempt.at);
    let firstPass = 0;
    let firstPassCorrect = 0;
    let todayCount = 0;

    for (const { attempt, mode } of entries) {
      days.add(attempt.day);
      if (attempt.day === day) todayCount++;
      if (mode !== 'exam' && !attempt.retry) {
        firstPass++;
        if (attempt.correct) firstPassCorrect++;
      }
      const question = byId.get(attempt.questionId);
      if (!question) continue;

      let record = perQuestion.get(question.id);
      if (!record) {
        record = {
          question, wrong: 0, open: false, due: day, step: -1,
          recovered: 0, lastMiss: null, lastAttempt: 0, current: false, revised: false,
        };
        perQuestion.set(question.id, record);
      }
      if (!attempt.correct) {
        record.wrong++;
        record.lastMiss = attempt.day;
      }
      if (attempt.revision !== question.revision) {
        if (!record.current) record.revised = true;
        continue;
      }
      record.lastAttempt = attempt.at;
      record.current = true;
      record.revised = false;
      if (!attempt.correct) {
        record.open = true;
        record.recovered = 0;
        record.step = 0;
        record.due = reviewOn(attempt.day, 1);
      } else if (!attempt.retry && (record.step < 0 || attempt.day >= record.due)) {
        if (record.open && ++record.recovered >= 2) record.open = false;
        record.step = Math.min(record.step + 1, intervals.length - 1);
        record.due = reviewOn(attempt.day, intervals[record.step]);
      }
    }

    const sortDue = (a, b) => a.due.localeCompare(b.due) || b.wrong - a.wrong || a.question.id.localeCompare(b.question.id);
    const due = [...perQuestion.values()].filter(item => item.due <= day).sort(sortDue);
    const errors = [...perQuestion.values()].filter(item => item.wrong).sort(
      (a, b) => Number(b.open) - Number(a.open) || b.wrong - a.wrong || sortDue(a, b),
    );
    const openErrors = errors.filter(item => item.open);
    return {
      perQuestion, due, errors, openErrors, todayCount, attempts: entries.length,
      days: days.size, completed: data.rounds.filter(round => round.completion).length,
      stateSeen: stateIds.filter(id => perQuestion.has(id)).length,
      firstPass, firstPassCorrect,
    };
  }

  /** @param {LiDData} data */
  function topicProgress(data) {
    const { perQuestion } = progress(data);
    return topics.map(topic => {
      const ids = idsByTopic.get(topic.mode);
      return {
        ...topic,
        total: ids.length,
        answered: ids.filter(id => perQuestion.has(id)).length,
        errors: ids.filter(id => perQuestion.get(id)?.open).length,
      };
    });
  }

  function shuffled(ids, random) {
    const result = [...ids];
    for (let index = result.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  }

  function exerciseIds(mode, data, day, random) {
    if (mode === 'all') return questions.map(question => question.id);
    const topicIds = idsByTopic.get(mode);
    if (topicIds) return topicIds;
    const stats = progress(data, day);
    if (mode === 'errors') {
      return [...stats.openErrors].sort((a, b) => a.lastAttempt - b.lastAttempt)
        .slice(0, batchSize).map(item => item.question.id);
    }
    if (mode !== 'daily') return [];
    const ids = stats.due.slice(0, batchSize).map(item => item.question.id);
    const unseen = questions.filter(question => !stats.perQuestion.has(question.id)).map(question => question.id);
    const landQuestion = shuffled(unseen.filter(id => id.startsWith('bw-')), random)[0];
    if (ids.length < batchSize && landQuestion && !ids.some(id => id.startsWith('bw-'))) ids.push(landQuestion);
    return ids.concat(shuffled(unseen.filter(id => !ids.includes(id)), random).slice(0, batchSize - ids.length));
  }

  /** @param {LiDData} data @param {LiDMode} mode @param {string} id @param {string[]} ids */
  function beginPractice(data, mode, id, ids) {
    if (!ids.length) return data;
    return {
      ...data, practice: { id, edition, index: 0, items: ids.map(questionId => ({ questionId, retry: false })) },
      parkedPractices: data.practice ? [...data.parkedPractices, data.practice] : data.parkedPractices,
      rounds: [...data.rounds, { id, mode, attempts: [], completion: null }],
    };
  }

  /** @param {LiDData} data @param {string} id */
  function resumePractice(data, id) {
    const practice = data.parkedPractices.find(item => item.id === id);
    if (!practice) return data;
    const parkedPractices = data.parkedPractices.filter(item => item.id !== id);
    if (data.practice) parkedPractices.push(data.practice);
    return { ...data, practice, parkedPractices };
  }

  /** @param {LiDData} data @param {LiDPracticeMode} mode */
  function findPractice(data, mode) {
    return data.rounds.find(round => practiceGroup(round.mode) === practiceGroup(mode)
      && (round.id === data.practice?.id || data.parkedPractices.some(item => item.id === round.id)));
  }

  /** @param {LiDData} data @param {LiDPracticeMode} mode @param {string} id */
  function startPractice(data, mode, id, now = Date.now(), random = Math.random) {
    if (!ready) return data;
    const round = findPractice(data, mode);
    if (!round) return beginPractice(data, mode, id, exerciseIds(mode, data, dateKey(now), random));
    const next = resumePractice(data, round.id);
    if (mode === 'all' && round.mode === 'daily') {
      const seen = new Set(next.practice.items.map(item => item.questionId));
      const remaining = questions.filter(question => !seen.has(question.id));
      const items = [...next.practice.items, ...remaining.map(question => ({ questionId: question.id, retry: false }))];
      return { ...next, practice: { ...next.practice, items }, rounds: replaceRound(next, { ...round, mode }) };
    }
    return next;
  }

  /** @param {LiDRound} round @returns {string[]} */
  function missedQuestionIds(round) {
    const ids = new Set();
    for (const { questionId, correct, revision } of round.attempts) {
      if (!correct && byId.get(questionId)?.revision === revision) ids.add(questionId);
    }
    return [...ids];
  }

  /** @param {LiDData} data @param {string} roundId @param {string} id */
  function startMissedPractice(data, roundId, id) {
    if (!ready || findPractice(data, 'errors')) return data;
    const round = data.rounds.find(item => item.id === roundId && item.completion);
    return round ? beginPractice(data, 'errors', id, missedQuestionIds(round)) : data;
  }

  function checkPractice(data, id, index, choice, now = Date.now()) {
    const practice = data.practice;
    if (!practice || practice.id !== id || practice.index !== index || !validChoice(choice)) return data;
    const round = data.rounds.find(item => item.id === id);
    if (round.attempts[index]) return data;
    const item = practice.items[index];
    const attempt = makeAttempt(item.questionId, choice, item.retry, now);
    return {
      ...data,
      rounds: replaceRound(data, { ...round, attempts: [...round.attempts, attempt] }),
    };
  }

  function nextPractice(data, id, index, now = Date.now()) {
    const practice = data.practice;
    if (!practice || practice.id !== id || practice.index !== index) return data;
    const round = data.rounds.find(item => item.id === id);
    if (!round.attempts[index]) return data;
    if (index + 1 < practice.items.length) return { ...data, practice: { ...practice, index: index + 1 } };
    return {
      ...data, practice: data.parkedPractices.at(-1) ?? null, parkedPractices: data.parkedPractices.slice(0, -1),
      rounds: replaceRound(data, { ...round, completion: { at: now, reason: 'finished', unanswered: [] } }),
    };
  }

  function stopPractice(data, id) {
    if (data.practice?.id !== id) return data;
    return {
      ...data, practice: data.parkedPractices.at(-1) ?? null, parkedPractices: data.parkedPractices.slice(0, -1),
      rounds: data.rounds.filter(round => round.id !== id || round.attempts.length),
    };
  }

  function startExam(data, id, now = Date.now(), random = Math.random) {
    if (!ready || data.exam) return data;
    const questionIds = [
      ...shuffled(generalIds, random).slice(0, examRules.general),
      ...shuffled(stateIds, random).slice(0, examRules.state),
    ];
    return {
      ...data,
      exam: { id, edition, index: 0, deadline: now + examTime, questionIds, selections: questionIds.map(() => null) },
      rounds: [...data.rounds, { id, mode: 'exam', attempts: [], completion: null }],
    };
  }

  function finishExam(data, id, now = Date.now()) {
    const exam = data.exam;
    if (!exam || exam.id !== id) return data;
    const at = Math.min(exam.deadline, now);
    const attempts = [];
    const unanswered = [];
    exam.questionIds.forEach((questionId, index) => {
      const choice = exam.selections[index];
      if (choice === null) unanswered.push(questionId);
      else attempts.push(makeAttempt(questionId, choice, false, at));
    });
    const completion = {
      at, reason: now >= exam.deadline ? 'expired' : 'submitted', unanswered,
      questionIds: exam.questionIds, elapsedMs: Math.max(0, at - (exam.deadline - examTime)),
    };
    return {
      ...data, exam: null, rounds: replaceRound(data, { id, mode: 'exam', attempts, completion }),
    };
  }

  function selectExam(data, id, index, choice, now = Date.now()) {
    const exam = data.exam;
    if (!exam || exam.id !== id) return data;
    if (now >= exam.deadline) return finishExam(data, id, now);
    if (exam.index !== index || (choice !== null && !validChoice(choice)) || exam.selections[index] === choice) return data;
    const selections = [...exam.selections];
    selections[index] = choice;
    return { ...data, exam: { ...exam, selections } };
  }

  function moveExam(data, id, index, now = Date.now()) {
    const exam = data.exam;
    if (!exam || exam.id !== id) return data;
    if (now >= exam.deadline) return finishExam(data, id, now);
    if (!validActiveIndex(index, examSize) || exam.index === index) return data;
    return { ...data, exam: { ...exam, index } };
  }

  function examResult(round) {
    const correct = round.attempts.filter(item => item.correct).length;
    return {
      correct, wrong: round.attempts.length - correct, unanswered: round.completion.unanswered.length,
      orientation: correct >= examRules.orientation, citizenship: correct >= examRules.citizenship,
    };
  }

  return {
    questions, byId, ready, blank, batchSize, examSize, examRules, progress, topics, topicProgress,
    readData, readRounds, mergeRounds,
    readSavedQuestionIds, toggleSavedQuestion,
    startPractice, findPractice, startMissedPractice, missedQuestionIds, checkPractice, nextPractice, stopPractice,
    startExam, selectExam, moveExam, finishExam, examResult,
  };
})();

const LiDStore = (() => {
  const key = 'dd_lid_v1';
  /** @type {LiDData} */
  let current = LiDLearning.blank();
  let storedValue;
  let invalidValue = null;
  let unsaved = false;
  let warning = '';

  function read() {
    if (unsaved) return current;
    try {
      const raw = localStorage.getItem(key);
      if (raw === storedValue) return current;
      invalidValue = raw;
      const state = raw === null ? LiDLearning.blank() : LiDLearning.readData(JSON.parse(raw));
      if (!state) throw new TypeError('Unbekanntes Speicherformat');
      current = state;
      storedValue = raw;
      invalidValue = null;
      warning = '';
    } catch (error) {
      warning = 'Der Lernstand konnte nicht aus dem Browserspeicher geladen werden.';
    }
    return current;
  }

  function update(change) {
    const write = () => {
      const previous = read();
      const next = change(previous);
      if (next === previous) return next;
      current = next;
      unsaved = true;
      try {
        const json = JSON.stringify(next);
        if (invalidValue !== null) {
          localStorage.setItem(`${key}_recovery`, invalidValue);
          invalidValue = null;
        }
        localStorage.setItem(key, json);
        storedValue = json;
        unsaved = false;
        warning = '';
      } catch (error) {
        warning = 'Der Browser konnte den Lernstand nicht speichern. Lass diese Seite geöffnet, um in dieser Sitzung weiterzuüben.';
      }
      return current;
    };
    if (!navigator.locks?.request) return Promise.resolve(write());
    let entered = false;
    return navigator.locks.request(key, () => {
      entered = true;
      return write();
    }).catch(error => {
      if (!entered && ['SecurityError', 'NotSupportedError'].includes(error.name)) return write();
      throw error;
    });
  }

  function backup() {
    return read();
  }

  async function importBackup(raw) {
    const imported = LiDLearning.readData(raw);
    if (!imported) return false;
    if (imported.rounds.length || imported.savedQuestionIds.length) {
      await update(data => {
        const rounds = LiDLearning.mergeRounds(data.rounds, imported.rounds);
        const localExam = data.exam && rounds.some(round => round.id === data.exam.id && !round.completion)
          ? data.exam : null;
        return LiDLearning.readData({
          version: data.version,
          rounds,
          practice: data.practice,
          parkedPractices: [...data.parkedPractices, imported.practice, ...imported.parkedPractices],
          exam: localExam || imported.exam,
          savedQuestionIds: [...data.savedQuestionIds, ...imported.savedQuestionIds],
        });
      });
      if (unsaved) throw new Error(warning);
    }
    return true;
  }

  return { key, read, update, backup, importBackup, warning: () => warning };
})();
