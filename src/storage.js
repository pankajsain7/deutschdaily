// ══════════════════════════════════════════════
// STORAGE
// ══════════════════════════════════════════════
const SKEY = 'dd_v4';
const SKEY_OLD = 'dd_clean_v1';
const SKEY_BACKUP = 'dd_v4_backup';
const SKEY_RECOVERY = 'dd_v4_recovery';
const DB_VERSION = 10;
const FIRST_REVIEW_DAYS = 3;
const DEFAULT_FREQ_DAILY_GOAL = 15;
const FREQUENCY_DICTIONARY_SIZE = 2525;
const LEECH_LAPSES = 4;
const DEFAULT_SETTINGS = {
  externalTts: true,
};

let DB = {
  version: DB_VERSION,
  todayTab: 'vocab',
  learned: new Set(),
  favorites: new Set(),
  understood: new Set(),
  streak: 0,
  lastStudy: null,
  dailyGoal: 10,
  dailyQueue: [],
  dailyQueueDate: null,
  dailyQueueDone: new Set(),
  history: {},
  historyWords: {},
  srs: {},
  patternSrs: {},
  freqLearned: new Set(),
  freqFavorites: new Set(),
  freqSrs: {},
  freqRatingState: {},
  freqAttempts: [],
  freqDailyGoal: DEFAULT_FREQ_DAILY_GOAL,
  freqDailyQueue: [],
  freqDailyQueueDate: null,
  freqDailyQueueDone: new Set(),
  reviewPromptDate: null,
  attempts: [],
  patternAttempts: [],
  settings: { ...DEFAULT_SETTINGS },
};

function validSentenceIdSet() { return new Set(SENTENCES.map(s => s.id)); }
function validPatternIdSet() { return new Set(PATTERNS.map(p => p.id)); }
function validFrequencyRankSet() { return new Set(Array.from({ length: FREQUENCY_DICTIONARY_SIZE }, (_, index) => String(index + 1))); }

function dateKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseDateKey(key) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(key || ''));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null;
  return d;
}
function normalizeDateKey(key) {
  const d = parseDateKey(key);
  return d ? dateKey(d) : null;
}
function addDaysKey(days, from = new Date()) {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + Number(days || 0));
  return dateKey(d);
}
function diffDaysKey(a, b) {
  const da = parseDateKey(a);
  const db = parseDateKey(b);
  if (!da || !db) return 0;
  da.setHours(12, 0, 0, 0);
  db.setHours(12, 0, 0, 0);
  return Math.round((da - db) / 86400000);
}
function today() { return dateKey(); }
function todayKey() { return today(); }
function todayISO() { return today(); }
function addDaysISO(days) { return addDaysKey(days); }
function clampNumber(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function uniqueValidIds(value, validIds) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  value.forEach(id => {
    const sid = String(id);
    if (validIds.has(sid) && !seen.has(sid)) { seen.add(sid); out.push(sid); }
  });
  return out;
}
function normalizeHistoryWords(value, validIds) {
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  Object.entries(value).forEach(([rawKey, rawIds]) => {
    const key = normalizeDateKey(rawKey);
    if (!key) return;
    const ids = uniqueValidIds(rawIds, validIds);
    if (ids.length) out[key] = [...new Set([...(out[key] || []), ...ids])];
  });
  return out;
}
function normalizeHistory(value) {
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  Object.entries(value).forEach(([rawKey, count]) => {
    const key = normalizeDateKey(rawKey);
    if (!key) return;
    out[key] = clampNumber(count, 0, 9999, 0);
  });
  return out;
}
function srsLevelFromInterval(interval) {
  if (interval <= 1) return 0;
  if (interval < 7) return 1;
  if (interval < 14) return 2;
  if (interval < 30) return 3;
  if (interval < 60) return 4;
  if (interval < 90) return 5;
  return 6;
}
function normalizeSrs(value, validIds) {
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  Object.entries(value).forEach(([id, raw]) => {
    if (!validIds.has(id) || !raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    const interval = clampNumber(raw.interval, 0, 3650, 0);
    const nextReview = normalizeDateKey(raw.nextReview);
    const lastReview = normalizeDateKey(raw.lastReview);
    const ease = clampNumber(raw.ease, 1.3, 5, 2.5);
    out[id] = {
      interval,
      ease,
      level: clampNumber(raw.level, 0, 6, srsLevelFromInterval(interval)),
      lapses: clampNumber(raw.lapses, 0, 999, 0),
      nextReview: nextReview || (interval > 0 ? addDaysKey(interval) : null),
      lastReview,
    };
  });
  return out;
}
function normalizePatternSrs(value, validIds) {
  return normalizeSrs(value, validIds);
}
function normalizeAttemptDirection(direction) {
  return ['de2en', 'en2de', 'type'].includes(direction) ? direction : 'de2en';
}
function normalizeAttempts(value, validIds) {
  if (!Array.isArray(value)) return [];
  return value.map(raw => {
    if (!raw || typeof raw !== 'object' || !validIds.has(String(raw.id))) return null;
    const direction = normalizeAttemptDirection(raw.direction);
    return {
      id: String(raw.id),
      date: normalizeDateKey(raw.date) || today(),
      mode: raw.mode === 'practice' || raw.mode === 'manual' ? raw.mode : 'practice',
      direction,
      result: ['got', 'again', 'skip', 'manual'].includes(raw.result) ? raw.result : 'again',
      topic: typeof raw.topic === 'string' ? raw.topic : '',
      patternIds: Array.isArray(raw.patternIds) ? raw.patternIds.map(String).filter(Boolean).slice(0, 6) : [],
      wasDue: Boolean(raw.wasDue),
      intervalBefore: clampNumber(raw.intervalBefore, 0, 3650, 0),
      intervalAfter: clampNumber(raw.intervalAfter, 0, 3650, 0),
    };
  }).filter(Boolean).slice(-1000);
}
function normalizePatternAttempts(value, validIds) {
  if (!Array.isArray(value)) return [];
  return value.map(raw => {
    if (!raw || typeof raw !== 'object' || !validIds.has(String(raw.id))) return null;
    return {
      id: String(raw.id),
      date: normalizeDateKey(raw.date) || today(),
      result: raw.result === 'got' || raw.result === 'again' || raw.result === 'skip' ? raw.result : 'again',
      wasDue: Boolean(raw.wasDue),
      intervalBefore: clampNumber(raw.intervalBefore, 0, 3650, 0),
      intervalAfter: clampNumber(raw.intervalAfter, 0, 3650, 0),
    };
  }).filter(Boolean).slice(-1000);
}
function normalizeFrequencyAttempts(value, validIds) {
  if (!Array.isArray(value)) return [];
  return value.map(raw => {
    if (!raw || typeof raw !== 'object' || !validIds.has(String(raw.id))) return null;
    return {
      id: String(raw.id),
      date: normalizeDateKey(raw.date) || today(),
      result: ['again', 'hard', 'good', 'easy', 'manual', 'skip'].includes(raw.result) ? raw.result : 'again',
      wasDue: Boolean(raw.wasDue),
      isNew: Boolean(raw.isNew || raw.result === 'manual' || (Number(raw.intervalBefore || 0) === 0 && Number(raw.intervalAfter || 0) > 0)),
      intervalBefore: clampNumber(raw.intervalBefore, 0, 3650, 0),
      intervalAfter: clampNumber(raw.intervalAfter, 0, 3650, 0),
    };
  }).filter(Boolean).slice(-1000);
}
function normalizeFreqRatingState(value, validIds) {
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  Object.entries(value).forEach(([id, raw]) => {
    if (!validIds.has(String(id)) || !raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    const rating = ['again', 'hard', 'good', 'easy'].includes(raw.rating) ? raw.rating : null;
    const updatedAtMs = Date.parse(String(raw.updatedAt || ''));
    if (!rating || !Number.isFinite(updatedAtMs)) return;
    out[String(id)] = { rating, updatedAt: new Date(updatedAtMs).toISOString() };
  });
  return out;
}
function migrateFreqRatingsFromAttempts(ratingState, attempts) {
  const migrated = { ...ratingState };
  const explicitRatingIds = new Set(Object.keys(ratingState));
  attempts.forEach(attempt => {
    if (!attempt || explicitRatingIds.has(attempt.id) || !['again', 'hard', 'good', 'easy'].includes(attempt.result)) return;
    // Older saves recorded the response but did not yet have rating metadata.
    // Attempts only carried a date, so preserve their order within that day.
    const updatedAt = new Date(`${attempt.date}T12:00:00.000Z`).toISOString();
    migrated[attempt.id] = { rating: attempt.result, updatedAt };
  });
  return migrated;
}
function normalizeSettings(value) {
  return {
    externalTts: true,
  };
}
function normalizeDb(raw = {}) {
  const validSentenceIds = validSentenceIdSet();
  const validPatternIds = validPatternIdSet();
  const validFreqIds = validFrequencyRankSet();
  const safe = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const learned = uniqueValidIds(safe.learned, validSentenceIds);
  const historyWords = normalizeHistoryWords(safe.historyWords, validSentenceIds);
  const freqDailyQueueDate = normalizeDateKey(safe.freqDailyQueueDate);
  const freqDailyQueue = uniqueValidIds(safe.freqDailyQueue, validFreqIds);

  const fallbackKey = normalizeDateKey(safe.lastStudy);
  if (fallbackKey) {
    const trackedIds = new Set();
    Object.values(historyWords).forEach(ids => ids.forEach(id => trackedIds.add(id)));
    learned.forEach(id => {
      if (trackedIds.has(id)) return;
      if (!historyWords[fallbackKey]) historyWords[fallbackKey] = [];
      historyWords[fallbackKey].push(id);
      trackedIds.add(id);
    });
  }

  const history = normalizeHistory(safe.history);
  Object.entries(historyWords).forEach(([key, ids]) => { history[key] = ids.length; });
  const dailyQueueDate = normalizeDateKey(safe.dailyQueueDate);
  const todayK = today();
  const freqAttempts = normalizeFrequencyAttempts(safe.freqAttempts, validFreqIds);
  const normalized = {
    version: DB_VERSION,
    todayTab: safe.todayTab === 'sentences' ? 'sentences' : 'vocab',
    learned: new Set(learned),
    favorites: new Set(uniqueValidIds(safe.favorites, validSentenceIds)),
    understood: new Set(uniqueValidIds(safe.understood, validPatternIds)),
    streak: clampNumber(safe.streak, 0, 9999, 0),
    lastStudy: normalizeDateKey(safe.lastStudy),
    dailyGoal: clampNumber(safe.dailyGoal, 1, 50, 10),
    dailyQueue: uniqueValidIds(safe.dailyQueue, validSentenceIds),
    dailyQueueDate,
    dailyQueueDone: new Set(dailyQueueDate === todayK ? uniqueValidIds(safe.dailyQueueDone, validSentenceIds) : []),
    history,
    historyWords,
    srs: normalizeSrs(safe.srs, validSentenceIds),
    patternSrs: normalizePatternSrs(safe.patternSrs, validPatternIds),
    freqLearned: new Set(uniqueValidIds(safe.freqLearned, validFreqIds)),
    freqFavorites: new Set(uniqueValidIds(safe.freqFavorites, validFreqIds)),
    freqSrs: normalizeSrs(safe.freqSrs, validFreqIds),
    freqRatingState: migrateFreqRatingsFromAttempts(
      normalizeFreqRatingState(safe.freqRatingState, validFreqIds),
      freqAttempts,
    ),
    freqAttempts,
    freqDailyGoal: clampNumber(safe.freqDailyGoal, 1, 60, DEFAULT_FREQ_DAILY_GOAL),
    freqDailyQueue,
    freqDailyQueueDate,
    freqDailyQueueDone: new Set(freqDailyQueueDate === todayK
      ? uniqueValidIds(safe.freqDailyQueueDone, validFreqIds).filter(id => freqDailyQueue.includes(id))
      : []),
    reviewPromptDate: normalizeDateKey(safe.reviewPromptDate),
    attempts: normalizeAttempts(safe.attempts, validSentenceIds),
    patternAttempts: normalizePatternAttempts(safe.patternAttempts, validPatternIds),
    settings: normalizeSettings(safe.settings),
  };

  Object.keys(normalized.srs).forEach(id => {
    if (!normalized.learned.has(id)) delete normalized.srs[id];
  });
  normalized.learned.forEach(id => {
    if (!normalized.srs[id]) normalized.srs[id] = initialSrsState();
  });
  normalized.understood.forEach(id => {
    if (!normalized.patternSrs[id]) normalized.patternSrs[id] = initialSrsState();
  });
  Object.keys(normalized.freqSrs).forEach(id => {
    if (!normalized.freqLearned.has(id)) delete normalized.freqSrs[id];
  });
  normalized.freqLearned.forEach(id => {
    if (!normalized.freqSrs[id]) normalized.freqSrs[id] = initialSrsState();
  });
  return normalized;
}

function dbToObj() {
  return {
    version: DB.version,
    todayTab: DB.todayTab || 'vocab',
    learned: [...DB.learned],
    favorites: [...DB.favorites],
    understood: [...DB.understood],
    streak: DB.streak,
    lastStudy: DB.lastStudy,
    dailyGoal: DB.dailyGoal,
    dailyQueue: DB.dailyQueue,
    dailyQueueDate: DB.dailyQueueDate,
    dailyQueueDone: [...DB.dailyQueueDone],
    history: DB.history,
    historyWords: DB.historyWords,
    srs: DB.srs,
    patternSrs: DB.patternSrs,
    freqLearned: [...DB.freqLearned],
    freqFavorites: [...DB.freqFavorites],
    freqSrs: DB.freqSrs,
    freqRatingState: DB.freqRatingState,
    freqAttempts: DB.freqAttempts,
    freqDailyGoal: DB.freqDailyGoal,
    freqDailyQueue: DB.freqDailyQueue,
    freqDailyQueueDate: DB.freqDailyQueueDate,
    freqDailyQueueDone: [...DB.freqDailyQueueDone],
    reviewPromptDate: DB.reviewPromptDate,
    attempts: DB.attempts,
    patternAttempts: DB.patternAttempts,
    settings: DB.settings,
  };
}
function objToDB(p) {
  DB = normalizeDb(p);
}

function backupExportObj() {
  return { exportedAt: new Date().toISOString(), ...dbToObj() };
}

function backupExportJson(pretty = true) {
  return JSON.stringify(backupExportObj(), null, pretty ? 2 : 0);
}

function parseStoredDb(key, raw) {
  if (!raw) return { key, raw, status: 'empty', value: null, error: null };
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { key, raw, status: 'corrupt', value: null, error: 'Saved progress payload is not an object' };
    }
    return { key, raw, status: 'ok', value, error: null };
  } catch (error) {
    return {
      key,
      raw,
      status: 'corrupt',
      value: null,
      error: error instanceof SyntaxError ? error.message : 'Unknown storage parse error',
    };
  }
}

function preserveCorruptStorage(candidates) {
  if (!candidates.length) return false;
  try {
    localStorage.setItem(SKEY_RECOVERY, JSON.stringify({
      savedAt: new Date().toISOString(),
      candidates: candidates.map(candidate => ({
        key: candidate.key,
        raw: candidate.raw,
        error: candidate.error,
      })),
    }));
    return true;
  } catch (error) {
    return false;
  }
}

async function load() {
  let storageError = null;
  let primary = null;
  let mirror = null;
  let legacy = null;
  try {
    primary = parseStoredDb(SKEY, localStorage.getItem(SKEY));
    mirror = parseStoredDb(SKEY_BACKUP, localStorage.getItem(SKEY_BACKUP));
    legacy = parseStoredDb(SKEY_OLD, localStorage.getItem(SKEY_OLD));
  } catch (e) {
    storageError = 'Progress could not be read from local storage.';
    objToDB({});
    DB.storageError = storageError;
    return;
  }

  const selected = primary.status === 'ok' ? primary : mirror.status === 'ok' ? mirror : legacy.status === 'ok' ? legacy : null;
  const corruptCandidates = [
    primary.status === 'corrupt' ? primary : null,
    primary.status !== 'ok' && mirror.status === 'corrupt' ? mirror : null,
    primary.status !== 'ok' && mirror.status !== 'ok' && legacy.status === 'corrupt' ? legacy : null,
  ].filter(Boolean);

  if (selected) {
    objToDB(selected.value);
    if (corruptCandidates.length) {
      const recoverySaved = preserveCorruptStorage(corruptCandidates);
      storageError = selected.key === SKEY_OLD
        ? `Current saved progress was corrupted; recovered from the older backup${recoverySaved ? ' and saved a raw recovery copy.' : ' without overwriting the current raw data.'}`
        : selected.key === SKEY_BACKUP
        ? `Current saved progress was missing or corrupted; recovered from the browser backup mirror${recoverySaved ? ' and saved a raw recovery copy.' : '.'}`
        : 'Old backup progress was corrupted and ignored.';
      DB.storageError = storageError;
      return;
    }
    save();
    return;
  }

  objToDB({});
  if (corruptCandidates.length) {
    const recoverySaved = preserveCorruptStorage(corruptCandidates);
    storageError = recoverySaved
      ? 'Saved progress was corrupted and could not be loaded. It was not overwritten, and a raw recovery copy was saved.'
      : 'Saved progress was corrupted and could not be loaded. The raw localStorage value was left unchanged for export or repair.';
  }
  if (storageError) DB.storageError = storageError;
  if (!corruptCandidates.length) save();
}

function save() {
  const json = JSON.stringify(dbToObj());
  let primarySaved = true;
  let backupSaved = true;
  try { localStorage.setItem(SKEY, json); }
  catch (e) {
    primarySaved = false;
    DB.storageError = 'Progress could not be saved locally. Export a backup before closing the browser.';
  }
  try { localStorage.setItem(SKEY_BACKUP, backupExportJson(false)); }
  catch (e) {
    backupSaved = false;
    if (primarySaved) DB.storageError = 'Browser storage is nearly full, so the backup copy could not be updated. Export a backup file.';
  }
  if (primarySaved && backupSaved) delete DB.storageError;
  try { if (window.storage) window.storage.set(SKEY, json); }
  catch (e) { }
}

function recordStudy() {
  const t = today();
  if (DB.lastStudy === t) return;
  const yesterday = addDaysKey(-1);
  DB.streak = DB.lastStudy === yesterday ? DB.streak + 1 : 1;
  DB.lastStudy = t;
  save();
}
function updateStreak() { recordStudy(); }
function shuffle(a) { return [...a].sort(() => Math.random() - .5); }

// ══════════════════════════════════════════════
// GRAMMAR TAG AUTO-DETECTION
// ══════════════════════════════════════════════
function grammarTag(de) {
  const s = String(de || '').toLowerCase();
  if (/\b(muss|müssen|kann|könn|darf|dürfen|soll|sollen|will(?!kommen|kommen)|wollen|mag(?! )|mögen|möchte|möchten|würde|würden)\b/.test(s))
    return { t: 'Modal', c: '#7C3AED', bg: '#F5F3FF' };
  if (/\b(habe|hat|hast|haben|habt|bin|bist|ist|sind|seid|war|waren)\b/.test(s) && /\bge[a-zäöüß]{2,}(t|en)\b/.test(s))
    return { t: 'Perfekt', c: '#2563EB', bg: '#EFF6FF' };
  if (/^(wo |wer |was |wann |wie |woher |wohin |welch|warum )/.test(s))
    return { t: 'W-Frage', c: '#EA580C', bg: '#FFF7ED' };
  if (/\b(nicht|kein|keine|keinen|keiner|keines|keinem)\b/.test(s))
    return { t: 'Negation', c: '#DC2626', bg: '#FEF2F2' };
  if (/\bseit\b/.test(s))
    return { t: 'seit + Dativ', c: '#D97706', bg: '#FFFBEB' };
  return null;
}

// ══════════════════════════════════════════════
// SPACED REPETITION
// ══════════════════════════════════════════════
const SRS_INTERVALS = [1, 3, 7, 14, 30, 60, 90];

function initialSrsState() {
  return { interval: FIRST_REVIEW_DAYS, ease: 2.5, level: 1, lapses: 0, nextReview: addDaysKey(FIRST_REVIEW_DAYS), lastReview: today() };
}
function srsNextLabelForData(srs) {
  if (!srs || !srs.nextReview) return '';
  const diffDays = diffDaysKey(srs.nextReview, today());
  if (diffDays <= 0) return 'due today';
  if (diffDays === 1) return 'due tomorrow';
  if (diffDays < 7) return `in ${diffDays} days`;
  if (diffDays < 30) return `in ${Math.round(diffDays / 7)} week${Math.round(diffDays / 7) > 1 ? 's' : ''}`;
  return `in ${Math.round(diffDays / 30)} month${Math.round(diffDays / 30) > 1 ? 's' : ''}`;
}
function srsNextLabel(id) {
  return srsNextLabelForData(DB.srs[id]);
}
function srsSchedule(id, gotIt) {
  if (!DB.srs[id]) DB.srs[id] = initialSrsState();
  const card = DB.srs[id];
  const before = card.interval || 0;
  const wasDue = Boolean(card.nextReview && card.nextReview <= today());
  card.lastReview = today();
  card.ease = clampNumber(card.ease, 1.3, 5, 2.5);
  if (gotIt) {
    if (before <= 0) card.interval = FIRST_REVIEW_DAYS;
    else if (before < 7) card.interval = 7;
    else card.interval = Math.min(3650, Math.round(before * card.ease));
  } else {
    card.interval = 1;
    card.ease = Math.max(1.3, card.ease - 0.2);
  }
  card.level = srsLevelFromInterval(card.interval);
  card.nextReview = addDaysKey(card.interval);
  save();
  return { intervalBefore: before, intervalAfter: card.interval, wasDue };
}
function schedulePattern(id, gotIt) {
  const isNew = !DB.patternSrs[id];
  if (isNew) DB.patternSrs[id] = { interval: 0, ease: 2.5, level: 0, nextReview: null, lastReview: null };
  const card = DB.patternSrs[id];
  const before = card.interval || 0;
  const wasDue = Boolean(card.nextReview && card.nextReview <= today());
  card.lastReview = today();
  card.ease = clampNumber(card.ease, 1.3, 5, 2.5);
  if (gotIt) {
    if (before <= 0) card.interval = FIRST_REVIEW_DAYS;
    else if (before < 7) card.interval = 7;
    else card.interval = Math.min(3650, Math.round(before * card.ease));
  } else {
    card.interval = 1;
    card.ease = Math.max(1.3, card.ease - 0.2);
  }
  card.level = srsLevelFromInterval(card.interval);
  card.nextReview = addDaysKey(card.interval);
  return { intervalBefore: before, intervalAfter: card.interval, wasDue };
}
function getSrsReviewIds() {
  const td = today();
  return Object.entries(DB.srs)
    .filter(([id, data]) => DB.learned.has(id) && data.nextReview && data.nextReview <= td)
    .map(([id]) => id);
}
function getPatternReviewIds() {
  const td = today();
  return Object.entries(DB.patternSrs)
    .filter(([id, data]) => validPatternIdSet().has(id) && data.nextReview && data.nextReview <= td)
    .map(([id]) => id);
}
function getSrsLevel(id) { return (DB.srs[id] || {}).level || 0; }
function isSrsScheduledFuture(id) {
  const srs = DB.srs[id];
  return Boolean(srs && srs.nextReview && srs.nextReview > today());
}

function markSentenceLearned(id, source = 'manual') {
  if (!validSentenceIdSet().has(id)) return false;
  const wasLearned = DB.learned.has(id);
  DB.learned.add(id);
  DB.dailyQueueDone.add(id);
  recordStudy();
  const k = today();
  if (!DB.historyWords[k]) DB.historyWords[k] = [];
  if (!DB.historyWords[k].includes(id)) DB.historyWords[k].push(id);
  DB.history[k] = DB.historyWords[k].length;
  if (!DB.srs[id]) DB.srs[id] = initialSrsState();
  if (!wasLearned && source === 'manual') {
    const s = SENTENCES.find(sentence => sentence.id === id);
    recordAttempt({ id, result: source === 'manual' ? 'manual' : 'got', mode: source, direction: 'de2en', sentence: s, intervalBefore: 0, intervalAfter: DB.srs[id].interval, wasDue: false });
  }
  save();
  return true;
}
function unmarkSentenceLearned(id) {
  DB.learned.delete(id);
  DB.dailyQueueDone.delete(id);
  delete DB.srs[id];
  save();
}
function recordAttempt({ id, result, mode, direction, sentence, intervalBefore = 0, intervalAfter = 0, wasDue = false }) {
  if (!validSentenceIdSet().has(id)) return;
  DB.attempts.push({
    id,
    date: today(),
    mode: mode || 'practice',
    direction: normalizeAttemptDirection(direction),
    result,
    topic: sentence ? sentence.t : '',
    patternIds: sentence && Array.isArray(sentence.patternIds) ? sentence.patternIds : [],
    wasDue,
    intervalBefore,
    intervalAfter,
  });
  if (DB.attempts.length > 1000) DB.attempts = DB.attempts.slice(-1000);
}
function recordPatternAttempt({ id, result, intervalBefore = 0, intervalAfter = 0, wasDue = false }) {
  if (!validPatternIdSet().has(id)) return;
  DB.patternAttempts.push({ id, date: today(), result, wasDue, intervalBefore, intervalAfter });
  if (DB.patternAttempts.length > 1000) DB.patternAttempts = DB.patternAttempts.slice(-1000);
}
function blankSrsState() {
  return { interval: 0, ease: 2.5, level: 0, lapses: 0, nextReview: null, lastReview: null };
}

let _sessionGotIt = new Set();

function getNewSentencePool() {
  const pool = SENTENCES.filter(s => !DB.learned.has(s.id) && !isSrsScheduledFuture(s.id));
  return shuffle(pool);
}
function ensureDailyQueue() {
  const t = today();
  if (DB.dailyQueueDate === t && DB.dailyQueue.length > 0) return;
  if (DB.dailyQueueDate !== t) {
    DB.dailyQueueDone = new Set();
    _sessionGotIt = new Set();
  }
  const dueIds = getSrsReviewIds();
  const due = shuffle(dueIds.map(id => SENTENCES.find(s => s.id === id)).filter(Boolean));
  const newPool = getNewSentencePool();
  const queue = [...due, ...newPool.filter(s => !dueIds.includes(s.id))].slice(0, DB.dailyGoal);
  DB.dailyQueue = queue.map(s => s.id);
  DB.dailyQueueDate = t;
  save();
}

// ══════════════════════════════════════════════
// FREQUENCY DICTIONARY SRS
// ══════════════════════════════════════════════
function freqById(id) {
  if (typeof FREQUENCY_DICTIONARY === 'undefined') return null;
  return FREQUENCY_DICTIONARY.find(e => String(e.rank) === String(id)) || null;
}
function freqSrsNextLabel(id) {
  return srsNextLabelForData(DB.freqSrs[id]);
}
function getFreqReviewIds() {
  const td = today();
  return Object.entries(DB.freqSrs)
    .filter(([id, data]) => DB.freqLearned.has(id) && data.nextReview && data.nextReview <= td)
    .map(([id]) => id);
}
function getFreqSrsLevel(id) { return (DB.freqSrs[id] || {}).level || 0; }
function getFreqLeechIds() {
  return Object.entries(DB.freqSrs)
    .filter(([id, data]) => DB.freqLearned.has(id) && (data.lapses || 0) >= LEECH_LAPSES)
    .sort((a, b) => (b[1].lapses || 0) - (a[1].lapses || 0) || Number(a[0]) - Number(b[0]))
    .map(([id]) => id);
}
function getFreqRatedIds(rating) {
  const validRatings = ['again', 'hard', 'good', 'easy'];
  return Object.entries(DB.freqRatingState)
    .filter(([id, state]) => validFrequencyRankSet().has(id) && state && validRatings.includes(state.rating) && (!rating || state.rating === rating))
    .sort((a, b) => String(b[1].updatedAt).localeCompare(String(a[1].updatedAt)) || Number(a[0]) - Number(b[0]))
    .map(([id]) => id);
}
function getFreqUnratedLearnedIds(limit = Infinity) {
  return [...DB.freqLearned]
    .filter(id => validFrequencyRankSet().has(id) && !DB.freqRatingState[id])
    .sort((a, b) => {
      const aDate = String((DB.freqSrs[a] || {}).lastReview || '');
      const bDate = String((DB.freqSrs[b] || {}).lastReview || '');
      return aDate.localeCompare(bDate) || Number(a) - Number(b);
    })
    .slice(0, limit);
}
function recordFreqRating(id, rating, updatedAt = new Date().toISOString()) {
  const sid = String(id);
  if (!validFrequencyRankSet().has(sid) || !['again', 'hard', 'good', 'easy'].includes(rating)) return false;
  const updatedAtMs = Date.parse(String(updatedAt || ''));
  if (!Number.isFinite(updatedAtMs)) return false;
  DB.freqRatingState[sid] = { rating, updatedAt: new Date(updatedAtMs).toISOString() };
  return true;
}
function isFreqScheduledFuture(id) {
  const srs = DB.freqSrs[id];
  return Boolean(srs && srs.nextReview && srs.nextReview > today());
}
function recordFreqAttempt({ id, result, intervalBefore = 0, intervalAfter = 0, wasDue = false, isNew }) {
  if (!validFrequencyRankSet().has(String(id))) return;
  const sid = String(id);
  const computedIsNew = typeof isNew === 'boolean'
    ? isNew
    : Boolean(result === 'manual' || (Number(intervalBefore || 0) === 0 && Number(intervalAfter || 0) > 0));
  DB.freqAttempts.push({ id: sid, date: today(), result, wasDue: Boolean(wasDue), isNew: computedIsNew, intervalBefore, intervalAfter });
  if (DB.freqAttempts.length > 1000) DB.freqAttempts = DB.freqAttempts.slice(-1000);
}
function freqRatingInterval(card, rating, isNew) {
  const before = card.interval || 0;
  if (isNew) {
    if (rating === 'hard') return 1;
    if (rating === 'easy') return 5;
    if (rating === 'good') return FIRST_REVIEW_DAYS;
    return 0;
  }
  if (rating === 'again') return 1;
  if (rating === 'hard') return Math.max(1, Math.round(Math.max(before, 1) * 1.2));
  const good = Math.max(FIRST_REVIEW_DAYS, Math.round(Math.max(before, 1) * card.ease));
  if (rating === 'easy') return Math.min(3650, Math.round(good * 1.3));
  return good;
}
function scheduleFreq(id, rating) {
  if (!validFrequencyRankSet().has(String(id))) return { intervalBefore: 0, intervalAfter: 0, wasDue: false, learned: false };
  const safeRating = ['again', 'hard', 'good', 'easy'].includes(rating) ? rating : 'again';
  const isNew = !DB.freqLearned.has(String(id)) || !DB.freqSrs[String(id)];
  const card = DB.freqSrs[String(id)] || blankSrsState();
  const before = card.interval || 0;
  const wasDue = Boolean(card.nextReview && card.nextReview <= today());

  if (isNew && safeRating === 'again') {
    return { intervalBefore: before, intervalAfter: 0, wasDue: false, learned: false };
  }

  card.ease = clampNumber(card.ease, 1.3, 5, 2.5);
  card.lapses = clampNumber(card.lapses, 0, 999, 0);
  card.interval = freqRatingInterval(card, safeRating, isNew);
  if (!isNew && safeRating === 'again') {
    card.ease = Math.max(1.3, card.ease - 0.2);
    card.lapses += 1;
  }
  if (!isNew && safeRating === 'easy') card.ease = Math.min(5, card.ease + 0.15);
  card.level = srsLevelFromInterval(card.interval);
  card.lastReview = today();
  card.nextReview = addDaysKey(card.interval);
  DB.freqLearned.add(String(id));
  if (DB.freqDailyQueue.includes(String(id))) DB.freqDailyQueueDone.add(String(id));
  DB.freqSrs[String(id)] = card;
  recordStudy();
  return { intervalBefore: before, intervalAfter: card.interval, wasDue, learned: true };
}
function markFreqLearned(id, source = 'manual') {
  if (!validFrequencyRankSet().has(String(id))) return false;
  const isNew = !DB.freqLearned.has(String(id));
  const scheduled = scheduleFreq(id, 'good');
  if (source === 'manual') {
    recordFreqAttempt({ id, result: 'manual', intervalBefore: scheduled.intervalBefore, intervalAfter: scheduled.intervalAfter, wasDue: scheduled.wasDue, isNew });
  }
  save();
  return true;
}
function unmarkFreqLearned(id) {
  DB.freqLearned.delete(String(id));
  DB.freqDailyQueueDone.delete(String(id));
  delete DB.freqSrs[String(id)];
  delete DB.freqRatingState[String(id)];
  save();
}
function toggleFreqLearned(id) {
  if (DB.freqLearned.has(String(id))) {
    unmarkFreqLearned(id);
  } else {
    markFreqLearned(id, 'manual');
  }
}
function toggleFreqFav(id) {
  const sid = String(id);
  if (DB.freqFavorites.has(sid)) DB.freqFavorites.delete(sid);
  else DB.freqFavorites.add(sid);
  save();
}
function getNewFreqPool() {
  if (typeof FREQUENCY_DICTIONARY === 'undefined') return [];
  return FREQUENCY_DICTIONARY.filter(e => !DB.freqLearned.has(String(e.rank)) && !isFreqScheduledFuture(String(e.rank)))
    .sort((a, b) => a.rank - b.rank);
}
function ensureFreqDailyQueue() {
  const t = today();
  if (DB.freqDailyQueueDate === t && DB.freqDailyQueue.length > 0) return;
  if (DB.freqDailyQueueDate !== t) {
    DB.freqDailyQueueDone = new Set();
  }
  // Learn queue holds new words only; scheduled reviews live in the Practice tab.
  DB.freqDailyQueue = getNewFreqPool().slice(0, DB.freqDailyGoal).map(e => String(e.rank));
  DB.freqDailyQueueDate = t;
  save();
}

// ══════════════════════════════════════════════
// DAILY REVIEW REMINDER
// ══════════════════════════════════════════════
function shouldPromptReview() {
  return DB.reviewPromptDate !== today() && getFreqReviewIds().length > 0;
}
function markReviewPromptSeen() {
  DB.reviewPromptDate = today();
  save();
}
