const assert = require('assert');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const source = [
  read('src/content.js'),
  read('src/learning.js'),
  read('src/frequency-dictionary-data.js'),
  read('src/backup-presets.js'),
  read('src/storage.js'),
  read('src/lid-catalog.js'),
  read('src/lid-learning.js'),
  read('src/lid-view.js'),
  read('src/app.js'),
  'renderPractice = () => {}; updateHeader = () => {}; render = () => {};',
  `globalThis.__test = {
    SENTENCES,
    normalizeDb,
    objToDB,
    dbToObj,
    save,
    today,
    todayISO,
    addDaysISO,
    load,
    ensureDailyQueue,
    markSentenceLearned,
    srsSchedule,
    getSrsReviewIds,
    practiceAnswer,
    practiceNext,
    startPractice,
    setPracticeDir,
    renderKursplan,
    renderArchive,
    setPracticeState: value => { P = value; },
    getPracticeState: () => P,
    DB: () => DB,
    stateFromUrl,
    urlFromState,
    applyUrlState,
    renderRevealDetails,
    applyImport,
    backupExportObj,
    LiDLearning,
    LiDStore,
    LiDView,
    mergeAttempts,
    mergeSrsMaps,
    validFrequencyRankSet,
    getHistoryDaySummary,
    renderProgressDashboard,
    renderPreviousBackupsSection,
    getPreviousBackups,
    getLatestBackup,
    getBackupById,
    importPresetBackup,
    renderSaved,
    renderTodayVocab,
    renderFrequency,
    getViewState: () => V,
    // Frequency
    FREQUENCY_DICTIONARY,
    scheduleFreq,
    recordFreqAttempt,
    recordFreqRating,
    ensureFreqDailyQueue,
    getFreqReviewIds,
    getFreqRatedIds,
    getFreqUnratedLearnedIds,
    markFreqLearned,
    unmarkFreqLearned,
    toggleFreqLearned,
    toggleFreqFav,
    startFrequencyPractice,
    frequencyPracticeAnswer,
    frequencyPracticeNext,
    frequencyPracticePrev,
    frequencyPracticeReveal,
    practiceReveal,
    practicePrev,
    getFreqLeechIds,
    getNewFreqPool,
    shouldPromptReview,
    markReviewPromptSeen,
    renderPracticeHub,
    mergeFreqRatingStates,
    getFrequencyPracticeState: () => FP,
  };`
].join('\n');

const store = {};
let failingStorageKey = null;
function makeElement() {
  return {
    style: {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    dataset: {},
    value: '',
    textContent: '',
    innerHTML: '',
    tagName: 'DIV',
    appendChild: () => {},
    addEventListener: () => {},
    remove: () => {},
    removeAttribute: () => {},
    setAttribute: () => {},
    focus: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}
const rootElement = makeElement();
const sandbox = {
  console,
  setTimeout: () => 0,
  clearTimeout: () => {},
  setInterval: () => 1,
  clearInterval: () => {},
  crypto: { randomUUID },
  window: {
    __DD_SKIP_AUTO_INIT: true,
    location: { href: 'http://localhost/DEDaily.html', pathname: '/DEDaily.html', search: '' },
    history: {
      pushState: (_state, _title, url) => {
        const next = new URL(url, 'http://localhost/DEDaily.html');
        sandbox.window.location.href = next.href;
        sandbox.window.location.pathname = next.pathname;
        sandbox.window.location.search = next.search;
      },
      replaceState: (_state, _title, url) => {
        const next = new URL(url, 'http://localhost/DEDaily.html');
        sandbox.window.location.href = next.href;
        sandbox.window.location.pathname = next.pathname;
        sandbox.window.location.search = next.search;
      },
    },
    addEventListener: () => {},
    storage: { set: () => {} },
    speechSynthesis: {
      getVoices: () => [],
      speak: () => {},
      cancel: () => {},
      onvoiceschanged: null,
    },
    scrollTo: () => {},
  },
  navigator: {
    userAgent: 'logic-tests',
    clipboard: { writeText: () => Promise.resolve() },
  },
  document: {
    activeElement: null,
    body: makeElement(),
    documentElement: makeElement(),
    addEventListener: () => {},
    createElement: makeElement,
    execCommand: () => true,
    getElementById: id => id === 'root' ? rootElement : makeElement(),
    querySelector: () => null,
    querySelectorAll: () => [],
  },
  URLSearchParams,
  URL: Object.assign(URL, {
    createObjectURL: () => 'blob:logic-test',
    revokeObjectURL: () => {},
  }),
  Blob: function Blob() {},
  Audio: function Audio() {
    return { play: () => Promise.resolve(), pause: () => {}, addEventListener: () => {} };
  },
  SpeechSynthesisUtterance: function SpeechSynthesisUtterance() {},
  speechSynthesis: {
    getVoices: () => [],
    speak: () => {},
    cancel: () => {},
    onvoiceschanged: null,
  },
  localStorage: {
    getItem: key => Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null,
    setItem: (key, value) => {
      if (key === failingStorageKey) throw new Error('QuotaExceededError');
      store[key] = value;
    },
  },
};

vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'logic-tests.vm.js' });

const t = sandbox.__test;

function reset(raw = {}) {
  t.objToDB(raw);
}

function clearStore() {
  Object.keys(store).forEach(key => { delete store[key]; });
}

reset({ learned: ['un1'], historyWords: {} });
assert(t.DB().learned.has('un1'), 'learned ID without historyWords must be preserved');
assert.strictEqual(t.DB().historyWords[t.today()], undefined, 'unknown learned history should not be fabricated as today');

reset({ learned: ['un1'], lastStudy: '2026-05-02', historyWords: {} });
assert.strictEqual(JSON.stringify(t.DB().historyWords['2026-05-02']), JSON.stringify(['un1']), 'missing learned history should use known lastStudy when available');

reset({
  learned: ['un1', 'bad-id'],
  favorites: 'not-array',
  dailyGoal: 999,
  historyWords: { 'bad-date': ['un1'], '2026-5-2': ['un1', 'bad-id'] },
  srs: { un1: { interval: 'bad', nextReview: 'bad-date' }, missing: { interval: 1 } },
});
assert.strictEqual(JSON.stringify([...t.DB().learned]), JSON.stringify(['un1']), 'normalizer filters invalid sentence IDs');
assert.strictEqual(t.DB().dailyGoal, 50, 'daily goal is clamped');
assert.strictEqual(JSON.stringify(t.DB().historyWords['2026-05-02']), JSON.stringify(['un1']), 'historyWords keys and IDs are normalized');
assert(t.DB().srs.un1, 'valid SRS entry is retained');
assert(!t.DB().srs.missing, 'invalid SRS entry is removed');

reset({
  learned: ['un1'],
  dailyGoal: 5,
  historyWords: { [t.addDaysISO(-10)]: ['un1'] },
  srs: { un1: { interval: 3, ease: 2.5, level: 1, nextReview: t.addDaysISO(-1), lastReview: t.addDaysISO(-4) } },
});
t.ensureDailyQueue();
assert.strictEqual(t.DB().dailyQueue[0], 'un1', 'due reviews should be first in the daily queue');

reset({});
t.markSentenceLearned('un2', 'manual');
assert.strictEqual(t.DB().srs.un2.interval, 3, 'first learned sentence uses one first-review interval');
assert(t.DB().historyWords[t.today()].includes('un2'), 'manual learned sentence is tracked in history');

const scheduled = t.srsSchedule('un2', true);
assert.strictEqual(scheduled.intervalBefore, 3, 'SRS schedule reports interval before review');
assert.strictEqual(t.DB().srs.un2.interval, 7, 'correct first review promotes to 7 days');

reset({});
const retryCard = t.SENTENCES.find(s => s.id === 'un1');
t.setPracticeState({ active: true, queue: [retryCard], idx: 0, revealed: true, got: 0, again: 0, skipped: 0, isSRS: false, dir: 'de2en', dirChoice: false, answered: {}, missedIds: [], typedFeedback: null });
t.practiceAnswer(false);
let practiceState = t.getPracticeState();
assert.strictEqual(practiceState.queue.length, 2, 'missed card should be requeued for another attempt');
assert.strictEqual(practiceState.idx, 1, 'practice should advance to the requeued miss');
assert.strictEqual(practiceState.again, 1, 'missed attempt should count once');
assert.strictEqual(practiceState.answered['0'], 'again', 'first queue position is tracked as answered');
t.practiceAnswer(true);
practiceState = t.getPracticeState();
assert.strictEqual(practiceState.got, 1, 'requeued miss can be answered and scored');
assert.strictEqual(practiceState.answered['1'], 'got', 'requeued queue position is tracked independently');
assert(t.DB().learned.has('un1'), 'correct retry marks the sentence learned');



reset({
  freqDailyGoal: 5,
  freqLearned: ['1'],
  freqSrs: { '1': { interval: 3, ease: 2.5, level: 1, lapses: 0, nextReview: t.today(), lastReview: t.addDaysISO(-3) } },
});
t.ensureFreqDailyQueue();
assert(!t.DB().freqDailyQueue.includes('1'), 'due reviews must not appear in the daily learn queue');
assert(t.DB().freqDailyQueue.every(id => !t.DB().freqLearned.has(id)), 'daily learn queue holds new words only');
assert.strictEqual(t.DB().freqDailyQueue.length, 5, 'daily learn queue honours the daily goal');

reset({
  freqLearned: ['1'],
  freqSrs: { '1': { interval: 3, ease: 2.5, level: 1, lapses: 0, nextReview: t.today(), lastReview: t.addDaysISO(-3) } },
});
assert.strictEqual(t.shouldPromptReview(), true, 'review reminder shows when cards are due and it has not been seen today');
t.markReviewPromptSeen();
assert.strictEqual(t.shouldPromptReview(), false, 'review reminder does not return the same day once dismissed');
assert.strictEqual(t.DB().reviewPromptDate, t.today(), 'reminder dismissal is stored as a date key');
assert.strictEqual(t.dbToObj().reviewPromptDate, t.today(), 'reminder date is exported');

reset({});
assert.strictEqual(t.shouldPromptReview(), false, 'review reminder stays hidden when nothing is due');

reset({
  freqLearned: ['20'],
  freqSrs: { '20': { interval: 10, ease: 2.5, level: 3, lapses: 3, nextReview: t.today(), lastReview: t.addDaysISO(-10) } },
});
const lapsed = t.scheduleFreq('20', 'again');
assert.strictEqual(lapsed.intervalAfter, 1, 'again on a review card resets the interval to one day');
assert.strictEqual(t.DB().freqSrs['20'].lapses, 4, 'again on a review card increments the lapse counter');
assert.strictEqual(JSON.stringify(t.getFreqLeechIds()), JSON.stringify(['20']), 'repeatedly forgotten words surface as leeches');

reset({});
const newAgain = t.scheduleFreq('30', 'again');
assert.strictEqual(newAgain.learned, false, 'again on a new card does not mark it learned');
assert.strictEqual(t.DB().freqSrs['30'], undefined, 'again on a new card leaves it unscheduled');

reset({
  freqLearned: ['10'],
  freqFavorites: ['11'],
  freqSrs: { '10': { interval: 3, ease: 2.5, level: 1, nextReview: t.addDaysISO(3), lastReview: t.today() } },
  freqAttempts: [{ id: '10', date: t.today(), result: 'good', intervalBefore: 0, intervalAfter: 3 }],
});
t.applyImport(JSON.stringify({
  freqLearned: ['12'],
  freqFavorites: ['13'],
  freqSrs: { '12': { interval: 5, ease: 2.5, level: 1, nextReview: t.addDaysISO(5), lastReview: t.today() } },
  freqAttempts: [{ id: '12', date: t.today(), result: 'easy', intervalBefore: 0, intervalAfter: 5 }],
}));
assert(t.DB().freqLearned.has('10') && t.DB().freqLearned.has('12'), 'import merges frequency learned IDs');
assert(t.DB().freqFavorites.has('11') && t.DB().freqFavorites.has('13'), 'import merges frequency favorites');
assert(t.DB().freqSrs['10'] && t.DB().freqSrs['12'], 'import merges frequency SRS maps');
assert(t.DB().freqAttempts.some(a => a.id === '12'), 'import merges frequency attempts');

reset({
  grammarStudied: ['legacy-grammar-topic'],
  grammarScores: { 'legacy-grammar-topic': { correct: 1, total: 1 } },
});
assert.strictEqual(Object.prototype.hasOwnProperty.call(t.dbToObj(), 'grammarStudied'), false, 'legacy grammar topics are not exported');
assert.strictEqual(Object.prototype.hasOwnProperty.call(t.dbToObj(), 'grammarScores'), false, 'legacy grammar scores are not exported');

reset({ settings: { externalTts: false } });
assert.strictEqual(t.DB().settings.externalTts, true, 'external TTS stays enabled after normalizing old settings');

reset({ settings: { focusTopics: ['appointments'], curriculumMode: 'survival' } });
assert.strictEqual(Object.prototype.hasOwnProperty.call(t.DB().settings, 'focusTopics'), false, 'old daily focus topic settings are discarded');
assert.strictEqual(Object.prototype.hasOwnProperty.call(t.DB().settings, 'curriculumMode'), false, 'old curriculum mode setting is discarded');

reset({
  attempts: [{ id: 'un1', date: t.today(), mode: 'practice', direction: 'type', result: 'got' }],
});
assert.strictEqual(t.DB().attempts[0].direction, 'type', 'typed practice direction survives normalization');

reset({
  attempts: [
    { id: 'un1', date: t.today(), mode: 'practice', direction: 'de2en', result: 'got' },
    ...Array.from({ length: 1000 }, () => ({ id: 'deleted-id', date: t.today(), result: 'got' })),
  ],
});
assert.strictEqual(t.DB().attempts.length, 1, 'attempt cap is applied after invalid IDs are removed');

const sameDayCurrent = Array.from({ length: 600 }, (_, index) => ({ id: `current-${index}`, date: t.today(), result: 'got', intervalBefore: index }));
const sameDayImported = Array.from({ length: 600 }, (_, index) => ({ id: `imported-${index}`, date: t.today(), result: 'got', intervalBefore: index }));
const mergedForwardIds = t.mergeAttempts(sameDayCurrent, sameDayImported).map(attempt => attempt.id);
const mergedReverseIds = t.mergeAttempts(sameDayImported, sameDayCurrent).map(attempt => attempt.id);
assert.strictEqual(JSON.stringify(mergedForwardIds), JSON.stringify(mergedReverseIds), 'attempt cap is independent of import direction when dates tie');

const sameDayShortSrs = { interval: 3, ease: 2.3, level: 1, nextReview: t.addDaysISO(3), lastReview: t.today() };
const sameDayLongSrs = { interval: 8, ease: 2.5, level: 2, nextReview: t.addDaysISO(8), lastReview: t.today() };
assert.strictEqual(t.mergeSrsMaps({ un1: sameDayShortSrs }, { un1: sameDayLongSrs }).un1.interval, 8, 'same-day SRS merge keeps the more advanced state');
assert.strictEqual(t.mergeSrsMaps({ un1: sameDayLongSrs }, { un1: sameDayShortSrs }).un1.interval, 8, 'same-day SRS merge is independent of import direction');



clearStore();
store.dd_v4 = '{bad json';
t.objToDB({ learned: ['un1'] });
t.load();
assert.strictEqual(store.dd_v4, '{bad json', 'corrupt progress must not be overwritten on load');
assert(store.dd_v4_recovery && store.dd_v4_recovery.includes('{bad json'), 'corrupt progress gets a recovery copy');
assert.strictEqual([...t.DB().learned].length, 0, 'unrecoverable corrupt progress loads an empty in-memory DB only');

clearStore();
store.dd_v4 = 'null';
t.objToDB({ learned: ['un1'] });
t.load();
assert.strictEqual(store.dd_v4, 'null', 'non-object stored progress must not be overwritten on load');
assert(store.dd_v4_recovery && store.dd_v4_recovery.includes('Saved progress payload is not an object'), 'non-object stored progress gets a recovery copy');

clearStore();
store.dd_v4 = '{bad json';
store.dd_clean_v1 = JSON.stringify({ learned: ['un1'], lastStudy: '2026-05-02' });
t.objToDB({});
t.load();
assert(t.DB().learned.has('un1'), 'valid legacy progress is recovered when current progress is corrupt');
assert.strictEqual(store.dd_v4, '{bad json', 'recovering from legacy progress must not overwrite corrupt current progress');
assert(store.dd_v4_recovery && store.dd_v4_recovery.includes('{bad json'), 'recovered corrupt current progress keeps a raw recovery copy');

clearStore();
store.dd_v4 = '{bad json';
store.dd_v4_backup = JSON.stringify({ learned: ['un2'], lastStudy: '2026-05-03' });
t.objToDB({});
t.load();
assert(t.DB().learned.has('un2'), 'valid backup mirror is recovered when current progress is corrupt');
assert.strictEqual(store.dd_v4, '{bad json', 'mirror recovery does not overwrite corrupt current progress');

clearStore();
reset({ learned: ['un1'] });
t.save();
assert(store.dd_v4 && store.dd_v4_backup, 'save writes primary and backup progress');
assert(!store.dd_v4_backup.includes('\n'), 'local backup mirror is stored compactly');
failingStorageKey = 'dd_v4_backup';
t.save();
assert(t.DB().storageError && t.DB().storageError.includes('backup copy'), 'backup quota failure is visible to the user');
failingStorageKey = null;
t.save();
assert.strictEqual(t.DB().storageError, undefined, 'storage warning clears after primary and backup save successfully');

clearStore();
reset({});
const persistedCard = t.SENTENCES.find(sentence => sentence.id === 'un1');
t.setPracticeState({ active: true, queue: [persistedCard], idx: 0, revealed: true, got: 0, again: 0, skipped: 0, isSRS: false, dir: 'de2en', dirChoice: false, answered: {}, missedIds: [], typedFeedback: null });
t.practiceAnswer(true);
assert.strictEqual(JSON.parse(store.dd_v4).attempts.length, 1, 'practice activity is persisted to primary storage');


const browseState = t.stateFromUrl('http://localhost/DEDaily.html?view=browse&topic=health&filter=unlearned');
assert.strictEqual(browseState.view, 'browse', 'browse URL state should parse view');
assert.strictEqual(browseState.topicId, 'health', 'browse URL state should parse topic');
assert.strictEqual(browseState.filter, 'unlearned', 'browse URL state should parse filter');

const legacyPatternUrl = t.urlFromState({ view: 'patterns' });
assert.strictEqual(legacyPatternUrl, '/DEDaily.html?view=browse', 'patterns view normalizes to browse URL');
const practiceUrl = t.urlFromState({ view: 'practice' });
assert.strictEqual(practiceUrl, '/DEDaily.html?view=practice', 'practice URL should serialize the view');
t.applyUrlState('http://localhost/DEDaily.html?view=patterns');
assert.strictEqual(t.getViewState().view, 'browse', 'legacy patterns URL falls back to browse view');

t.applyUrlState('http://localhost/DEDaily.html?view=library&tab=learned');
assert.strictEqual(t.getViewState().view, 'saved', 'library URL opens Library tab');
assert.strictEqual(t.getViewState().libTab, 'learned', 'library URL selects learned subtab');
assert.strictEqual(t.getViewState().libType, 'vocab', 'Library defaults to vocabulary items');
const sentenceLibraryUrl = t.urlFromState({ view: 'saved', libTab: 'learned', libType: 'sentences' });
assert.strictEqual(sentenceLibraryUrl, '/DEDaily.html?view=library&type=sentences', 'Library URL preserves sentence item type with Learned as the default tab');

t.applyUrlState('http://localhost/DEDaily.html?view=practice');
assert.strictEqual(t.getViewState().view, 'practice', 'practice URL opens the Practice tab');

t.applyUrlState('http://localhost/DEDaily.html?view=vocab&topic=money&filter=saved');
assert.strictEqual(t.getViewState().view, 'frequency', 'legacy vocab URL redirects to the vocabulary dictionary');

t.applyUrlState('http://localhost/DEDaily.html?view=kursplan');
assert.strictEqual(t.getViewState().view, 'kursplan', 'kursplan URL opens Kursplan tab');
assert(t.renderKursplan().includes('resources/deutsch-a1-b1-kursplan.html'), 'kursplan view embeds the resources kursplan iframe');

t.applyUrlState('http://localhost/DEDaily.html?view=history&day=2026-05-02');
assert.strictEqual(t.getViewState().view, 'history-day', 'dated history URL opens History day view');
assert.strictEqual(t.getViewState().historyDay, '2026-05-02', 'history URL selects normalized day');

const revealCard = t.SENTENCES.find(sentence => Array.isArray(sentence.vocab) && sentence.vocab.length > 0);
const revealHtml = t.renderRevealDetails(revealCard, true, 'logic-');
assert(!revealHtml.includes('Meaning'), 'revealed details should not repeat the already visible translation');
assert(revealHtml.includes('Sentence vocab'), 'revealed details should include sentence vocab');
assert(!revealHtml.includes('Expected reply'), 'revealed details should not include expected reply guidance');
assert(!revealHtml.includes('Why it works'), 'revealed details should not include grammar guidance');
assert(!revealHtml.includes('Practice:'), 'revealed details should not include practice prompts');
const variantCard = t.SENTENCES.find(sentence => sentence.learn && Array.isArray(sentence.learn.variants) && sentence.learn.variants.length > 0);
const variantRevealHtml = t.renderRevealDetails(variantCard, true, 'variant-');
assert(variantRevealHtml.includes('Formal / informal'), 'revealed details should include formal/informal variants when available');
const missingSentenceVocabIds = Array.from(t.SENTENCES)
  .filter(sentence => !t.renderRevealDetails(sentence, true, 'all-').includes('Sentence vocab'))
  .map(sentence => sentence.id);
assert.deepStrictEqual(missingSentenceVocabIds, [], 'every sentence should render useful sentence vocab');
assert(!revealHtml.includes('Learn' + ' more'), 'revealed details must not contain old reveal-button copy');

// ─── Frequency Dictionary ─────────────────────
assert(Array.isArray(t.FREQUENCY_DICTIONARY) && t.FREQUENCY_DICTIONARY.length === 2525, 'FREQUENCY_DICTIONARY is loaded with 2525 entries');
assert.strictEqual(t.validFrequencyRankSet().size, 2525, 'frequency ID validation remains available independently of dictionary data');

// Frequency rating state is validated, persisted, and ordered by its latest response.
reset({
  freqRatingState: {
    '1': { rating: 'hard', updatedAt: '2026-08-01T10:00:00.000Z' },
    '2': { rating: 'not-a-rating', updatedAt: '2026-08-01T10:00:00.000Z' },
    '9999': { rating: 'easy', updatedAt: '2026-08-01T10:00:00.000Z' },
  },
});
assert.deepStrictEqual(Object.keys(t.DB().freqRatingState), ['1'], 'only valid persisted vocabulary ratings are retained');
t.recordFreqRating('1', 'easy', '2026-08-02T10:00:00.000Z');
assert.strictEqual(t.getFreqRatedIds('easy')[0], '1', 'latest vocabulary rating selects the replay group');
const reloadedRatingState = t.dbToObj();
reset(reloadedRatingState);
assert.strictEqual(t.DB().freqRatingState['1'].rating, 'easy', 'vocabulary ratings survive a save/load normalization cycle');
assert.strictEqual(
  JSON.stringify(t.mergeFreqRatingStates(
    { '1': { rating: 'hard', updatedAt: '2026-08-01T10:00:00.000Z' } },
    { '1': { rating: 'good', updatedAt: '2026-08-02T10:00:00.000Z' } },
  )),
  JSON.stringify({ '1': { rating: 'good', updatedAt: '2026-08-02T10:00:00.000Z' } }),
  'import keeps the newest persisted vocabulary rating',
);

reset({
  freqAttempts: [
    { id: '3', date: '2026-08-01', result: 'good' },
    { id: '3', date: '2026-08-02', result: 'again' },
    { id: '4', date: '2026-08-02', result: 'manual' },
  ],
});
assert.strictEqual(t.DB().freqRatingState['3'].rating, 'again', 'old flashcard attempts migrate to their latest replay rating');
assert(!t.DB().freqRatingState['4'], 'manual learned actions never create a replay rating');
assert.strictEqual(t.DB().freqRatingState['3'].updatedAt, '2026-08-02T12:00:00.000Z', 'migrated ratings receive stable ISO timestamps');

// scheduleFreq: new entry with each rating
reset({});
let freqAgain = t.scheduleFreq('1', 'again');
assert.strictEqual(freqAgain.learned, false, 'new freq again should not mark learned');
assert(!t.DB().freqLearned.has('1'), 'new freq again stays unlearned');

let freqHard = t.scheduleFreq('1', 'hard');
assert.strictEqual(freqHard.intervalAfter, 1, 'new freq hard schedules one day');
assert(t.DB().freqLearned.has('1'), 'new freq hard marks learned');

reset({});
let freqGood = t.scheduleFreq('2', 'good');
assert.strictEqual(freqGood.intervalAfter, 3, 'new freq good schedules three days');
assert(t.DB().freqLearned.has('2'), 'new freq good marks learned');

reset({});
let freqEasy = t.scheduleFreq('3', 'easy');
assert.strictEqual(freqEasy.intervalAfter, 5, 'new freq easy schedules five days');
assert(t.DB().freqLearned.has('3'), 'new freq easy marks learned');

// scheduleFreq: review with ratings
reset({
  freqLearned: ['10'],
  freqSrs: { '10': { interval: 10, ease: 2.5, level: 3, nextReview: t.today(), lastReview: t.addDaysISO(-10) } },
});
let freqReviewedHard = t.scheduleFreq('10', 'hard');
assert.strictEqual(freqReviewedHard.intervalAfter, 12, 'review freq hard uses shorter multiplier');

reset({
  freqLearned: ['10'],
  freqSrs: { '10': { interval: 10, ease: 2.5, level: 3, nextReview: t.today(), lastReview: t.addDaysISO(-10) } },
});
let freqReviewedGood = t.scheduleFreq('10', 'good');
assert.strictEqual(freqReviewedGood.intervalAfter, 25, 'review freq good uses ease multiplier');

reset({
  freqLearned: ['10'],
  freqSrs: { '10': { interval: 10, ease: 2.5, level: 3, nextReview: t.today(), lastReview: t.addDaysISO(-10) } },
});
let freqReviewedEasy = t.scheduleFreq('10', 'easy');
assert.strictEqual(freqReviewedEasy.intervalAfter, 33, 'review freq easy extends good interval');

// Completing a due review must not make it look like a new daily word.
reset({
  freqLearned: ['1'],
  freqDailyQueue: ['2'],
  freqDailyQueueDate: t.today(),
  freqDailyQueueDone: ['1'],
  freqSrs: { '1': { interval: 3, ease: 2.5, level: 1, nextReview: t.today(), lastReview: t.addDaysISO(-3) } },
});
t.scheduleFreq('1', 'good');
assert.strictEqual(t.DB().freqDailyQueueDone.size, 0, 'due reviews do not increment the new-word queue');

// Scheduled sessions change SRS; replay sessions keep the schedule intact while recording ratings.
reset({
  freqLearned: ['1'],
  freqSrs: { '1': { interval: 3, ease: 2.5, level: 1, nextReview: t.today(), lastReview: t.addDaysISO(-3) } },
});
t.startFrequencyPractice({ ids: ['1'], mode: 'scheduled' });
t.frequencyPracticeAnswer('good');
assert.strictEqual(t.DB().freqSrs['1'].interval, 8, 'scheduled vocabulary practice updates SRS');
assert.strictEqual(t.DB().freqRatingState['1'].rating, 'good', 'scheduled vocabulary practice saves the latest rating');

reset({
  freqLearned: ['1'],
  freqSrs: { '1': { interval: 8, ease: 2.5, level: 2, nextReview: t.addDaysISO(8), lastReview: t.today() } },
});
t.startFrequencyPractice({ ids: ['1'], mode: 'replay' });
t.frequencyPracticeAnswer('hard');
assert.strictEqual(t.DB().freqSrs['1'].interval, 8, 'replay practice does not alter SRS');
assert.strictEqual(t.DB().freqRatingState['1'].rating, 'hard', 'replay practice still saves the latest rating');

// ensureFreqDailyQueue populates the queue
reset({
  freqLearned: ['1'],
  freqDailyGoal: 5,
  freqSrs: { '1': { interval: 3, ease: 2.5, level: 1, nextReview: t.today(), lastReview: t.addDaysISO(-3) } },
});
t.ensureFreqDailyQueue();
assert.strictEqual(t.DB().freqDailyQueue[0], '2', 'the freq daily queue starts at the first unlearned word');

reset({});
t.startFrequencyPractice({ ids: ['1'] });
t.frequencyPracticeNext();
assert.strictEqual(t.getFrequencyPracticeState().idx, 0, 'unrated frequency card cannot be skipped with next()');
assert.strictEqual(t.getFrequencyPracticeState().skipped, 0, 'skipping is restricted without rating');
assert.strictEqual(t.DB().freqAttempts.length, 0, 'no skip attempt recorded for unrated card');

reset({});
const sixtyFrequencyIds = Array.from({ length: 60 }, (_, index) => String(index + 1));
t.startFrequencyPractice({ ids: sixtyFrequencyIds });
const firstCardId = String(t.getFrequencyPracticeState().queue[0].rank);
t.frequencyPracticeAnswer('again');
assert.strictEqual(t.getFrequencyPracticeState().queue.length, 60, 'Again advances to next card without duplicate insertion in same session');
assert.strictEqual(t.getFrequencyPracticeState().missedIds[0], firstCardId, 'Again keeps the card available for Review Again');

reset({
  freqLearned: ['1'],
  freqSrs: { '1': { interval: 3, ease: 2.5, level: 1, nextReview: t.today(), lastReview: t.addDaysISO(-3) } },
  freqAttempts: [
    { id: '1', date: t.today(), result: 'good', wasDue: true, intervalBefore: 3, intervalAfter: 8 },
    { id: '2', date: t.today(), result: 'skip', wasDue: false, intervalBefore: 0, intervalAfter: 0 },
  ],
});
const frequencyHistory = t.getHistoryDaySummary(t.today());
assert.strictEqual(frequencyHistory.frequencyPracticeCount, 1, 'answered frequency cards count in daily history');
assert.strictEqual(frequencyHistory.skipped, 1, 'frequency skips count in daily history');
assert.strictEqual(frequencyHistory.reviews, 1, 'due frequency answers count as reviews');
assert(t.renderProgressDashboard().includes('Words Learned'), 'progress overview leads with vocabulary stats');
assert(t.renderPracticeHub().includes('Practice again'), 'practice hub renders persistent replay groups');
assert(!t.renderPracticeHub().includes('English → German'), 'vocabulary practice no longer offers English-to-German cards');
assert(!t.renderPracticeHub().includes('Shortcuts'), 'practice hub no longer shows shortcut hints');

reset({ freqLearned: ['12'] });
assert.strictEqual(JSON.stringify(t.getFreqUnratedLearnedIds()), '["12"]', 'learned cards without a real response remain available for safe rating');
assert(t.renderPracticeHub().includes('Build your replay groups'), 'practice hub gives learned words a safe path into replay groups');
assert(!t.renderTodayVocab().includes('undefined'), 'today vocab card renders without holes');
assert(!t.renderFrequency().includes('undefined'), 'vocabulary browse view renders without holes');
t.ensureFreqDailyQueue();
assert(t.DB().freqDailyQueue.every(id => !t.DB().freqLearned.has(id)), 'today vocab never re-offers a learned word');

reset({ freqLearned: ['1'], freqFavorites: ['2'] });
t.applyUrlState('http://localhost/DEDaily.html?view=library&tab=saved');
assert(t.renderSaved().includes('saved frequency word'), 'Library Saved tab includes saved frequency words');
t.applyUrlState('http://localhost/DEDaily.html?view=library&tab=learned');
assert(t.renderSaved().includes('learned frequency word'), 'Library Learned tab includes learned frequency words');
assert(t.renderSaved().includes('Library item type'), 'Library renders the Sentences/Vocab type toggle');

// toggleFreqLearned / toggleFreqFav update DB
reset({});
t.markFreqLearned('5', 'manual');
assert(t.DB().freqLearned.has('5'), 'manual freq learned is tracked');
assert.strictEqual(t.DB().freqAttempts[0].result, 'manual', 'manual freq learned records attempt');
assert.strictEqual(t.DB().freqAttempts[0].isNew, true, 'manual freq learned marks attempt as isNew');

// getHistoryDaySummary computes vocab metrics
const todaySummary = t.getHistoryDaySummary(t.today());
assert.strictEqual(todaySummary.vocabLearnedCount, 1, 'history day summary counts newly learned vocab');
assert(todaySummary.vocabLearnedIds.includes('5'), 'history day summary includes learned vocab id');

// frequencyPracticeAnswer tracks isNew for new words
reset({});
t.startFrequencyPractice({ ids: ['10', '11'], mode: 'scheduled' });
t.frequencyPracticeAnswer('good');
assert.strictEqual(t.DB().freqAttempts[0].isNew, true, 'first rating of a new word records isNew: true');

// mergeAttempts preserves isNew
const mergedAttempts = t.mergeAttempts(
  [{ id: '10', date: t.today(), result: 'good', wasDue: false, isNew: true, intervalBefore: 0, intervalAfter: 3 }],
  [{ id: '11', date: t.today(), result: 'good', wasDue: false, isNew: true, intervalBefore: 0, intervalAfter: 3 }]
);
assert.strictEqual(mergedAttempts.length, 2, 'mergeAttempts merges distinct attempts');
assert.strictEqual(mergedAttempts[0].isNew, true, 'mergeAttempts preserves isNew');

// Library learned tab does not duplicate cards
reset({
  learned: ['un1'],
  srs: { un1: { interval: 3, ease: 2.5, level: 1, nextReview: t.today(), lastReview: t.addDaysISO(-3) } },
  freqLearned: ['1'],
  freqSrs: { '1': { interval: 3, ease: 2.5, level: 1, nextReview: t.today(), lastReview: t.addDaysISO(-3) } }
});
t.applyUrlState('http://localhost/DEDaily.html?view=library&tab=learned&type=sentences');
const sentenceHtml = t.renderSaved();
const scMatches = (sentenceHtml.match(/id="sc-un1"/g) || []).length;
assert.strictEqual(scMatches, 1, 'Sentence card exists exactly once in Learned tab without duplicate IDs');

t.applyUrlState('http://localhost/DEDaily.html?view=library&tab=learned&type=vocab');
const vocabHtml = t.renderSaved();
const fcMatches = (vocabHtml.match(/id="fc-1"/g) || []).length;
assert.strictEqual(fcMatches, 1, 'Frequency vocab card exists exactly once in Learned tab without duplicate IDs');

reset({ freqLearned: ['5'], freqSrs: { '5': { interval: 3, ease: 2.5, level: 1, nextReview: t.addDaysISO(3), lastReview: t.today() } } });
t.unmarkFreqLearned('5');
assert(!t.DB().freqLearned.has('5'), 'unmark freq learned removes from set');
assert(!t.DB().freqSrs['5'], 'unmark freq learned removes SRS data');

reset({});
t.toggleFreqFav('7');
assert(t.DB().freqFavorites.has('7'), 'toggle freq fav adds to favorites');
t.toggleFreqFav('7');
assert(!t.DB().freqFavorites.has('7'), 'toggle freq fav removes from favorites');

t.startFrequencyPractice({ ids: ['1', '2'], mode: 'replay' });
assert.strictEqual(t.getFrequencyPracticeState().revealed, false, 'vocab flashcard starts unrevealed');
t.frequencyPracticeReveal();
assert.strictEqual(t.getFrequencyPracticeState().revealed, true, 'frequencyPracticeReveal unhides english translation');
t.frequencyPracticeReveal();
assert.strictEqual(t.getFrequencyPracticeState().revealed, false, 'frequencyPracticeReveal hides english translation on second call');
assert.strictEqual(t.getFrequencyPracticeState().idx, 0, 'starts at card 0');
t.frequencyPracticeNext();
assert.strictEqual(t.getFrequencyPracticeState().idx, 0, 'does not advance on next without rating');
t.frequencyPracticeAnswer('good');
assert.strictEqual(t.getFrequencyPracticeState().idx, 1, 'advances to card 1 after rating card 0');
t.frequencyPracticePrev();
assert.strictEqual(t.getFrequencyPracticeState().idx, 0, 'goes backward to card 0 on prev');
t.frequencyPracticeNext();
assert.strictEqual(t.getFrequencyPracticeState().idx, 1, 'advances to card 1 on next since card 0 was already rated');
t.frequencyPracticePrev();
assert.strictEqual(t.getFrequencyPracticeState().idx, 0, 'goes backward to card 0 on prev');
t.frequencyPracticeAnswer('again');
assert.strictEqual(t.getFrequencyPracticeState().idx, 1, 're-rating a previous card advances back to the next card');
assert.strictEqual(t.getFrequencyPracticeState().good, 0, 're-rating removes the previous rating from session totals');
assert.strictEqual(t.getFrequencyPracticeState().again, 1, 're-rating updates the session total');
const reratedId = String(t.getFrequencyPracticeState().queue[0].rank);
assert.strictEqual(t.DB().freqRatingState[reratedId].rating, 'again', 're-rating a previous card persists its new rating');
t.frequencyPracticePrev();
assert.strictEqual(t.getFrequencyPracticeState().idx, 0, 'does not go below card 0 on prev');

reset({ freqLearned: ['1'], freqSrs: { '1': { interval: 3, ease: 2.5, level: 1, nextReview: t.today(), lastReview: t.addDaysISO(-3), lapses: 0 } } });
t.startFrequencyPractice({ ids: ['1'], mode: 'scheduled' });
t.frequencyPracticeAnswer('hard');
assert.strictEqual(t.DB().freqSrs['1'].interval, 4, 'scheduled hard rating updates the review interval');
t.frequencyPracticePrev();
t.frequencyPracticeAnswer('again');
assert.strictEqual(t.DB().freqSrs['1'].interval, 1, 're-rating restores the original schedule before applying the new rating');
assert.strictEqual(t.DB().freqSrs['1'].lapses, 1, 're-rating does not apply the replaced scheduled rating twice');

t.startPractice({ ids: ['un1', 'un2'], skipSessionFilter: true });
t.setPracticeDir('de2en');
assert.strictEqual(t.getPracticeState().idx, 0, 'starts at sentence 0');
t.practiceNext();
assert.strictEqual(t.getPracticeState().idx, 0, 'sentence does not advance on next without rating');
t.practiceReveal();
assert.strictEqual(t.getPracticeState().revealed, true, 'practiceReveal unhides sentence card');
t.practiceReveal();
assert.strictEqual(t.getPracticeState().revealed, false, 'practiceReveal hides sentence card on second call');
t.practiceAnswer(true);
assert.strictEqual(t.getPracticeState().idx, 1, 'advances to sentence 1 after rating');
t.practicePrev();
assert.strictEqual(t.getPracticeState().idx, 0, 'sentence goes back on prev');
t.practiceNext();
assert.strictEqual(t.getPracticeState().idx, 1, 'sentence advances on next since sentence 0 was already rated');



// --- Previous Backups & Cross-Device Sync Tests ---
const previousBackups = t.getPreviousBackups();
assert.ok(Array.isArray(previousBackups) && previousBackups.length === 1, 'previous backups registry loaded with latest backup');
const latest = t.getLatestBackup();
assert.ok(latest, 'latest backup snapshot exists');
assert.strictEqual(latest.id, 'backup-2026-08-18-195530', 'latest backup ID matches');
assert.strictEqual(latest.stats.vocabLearned, 470, 'latest backup vocab count is 470');
assert.strictEqual(latest.stats.streak, 5, 'latest backup streak is 5');

// Test DB restore from backup
t.objToDB(latest.data);
const restoredDb = t.DB();
assert.strictEqual(restoredDb.freqLearned.size, 470, 'restored DB has 470 vocab items');
assert.strictEqual(restoredDb.learned.size, 12, 'restored DB has 12 sentences');
assert.strictEqual(restoredDb.streak, 5, 'restored DB has streak 5');
assert.strictEqual(restoredDb.lastStudy, '2026-08-18', 'restored DB lastStudy is 2026-08-18');
assert.strictEqual(restoredDb.freqAttempts.length, 1000, 'restored DB has 1000 review attempts');
assert.strictEqual(Object.keys(restoredDb.freqSrs).length, 470, 'restored DB has 470 freq SRS cards');

// Test latest backup lookup by ID
const snapshot = t.getBackupById('backup-2026-08-18-195530');
assert.ok(snapshot, 'can retrieve latest snapshot by ID');
assert.strictEqual(snapshot.isLatest, true, 'snapshot is marked latest');

// Test HTML render of previous backups section
const backupsHtml = t.renderPreviousBackupsSection();
assert.ok(backupsHtml.includes('Previous Backups'), 'renders section title');
assert.ok(backupsHtml.includes('backup-2026-08-18-195530'), 'renders latest backup ID in action handlers');
assert.ok(backupsHtml.includes('470'), 'renders 470 words stat chip');

console.log('logic-tests passed');

async function testLiD() {
  const lid = t.LiDLearning;
  const start = new Date(2026, 10, 20, 12).getTime();
  const timestamp = offset => new Date(2026, 10, 20 + offset, 12).getTime();
  const days = offset => {
    const date = new Date(timestamp(offset));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const roundId = index => String(index).padStart(32, '0');
  assert.equal(t.stateFromUrl('http://localhost/DEDaily.html?view=leben-in-deutschland').view, 'leben-in-deutschland');
  assert.equal(t.stateFromUrl('http://localhost/DEDaily.html').view, 'leben-in-deutschland');
  assert.equal(t.stateFromUrl('http://localhost/').view, 'leben-in-deutschland');
  assert.equal(t.stateFromUrl('http://localhost/DEDaily.html?view=unknown').view, 'leben-in-deutschland');
  assert.equal(t.urlFromState({ view: 'leben-in-deutschland' }), '/DEDaily.html');
  assert.equal(t.stateFromUrl('http://localhost/DEDaily.html?view=archiv').view, 'archiv');
  assert.equal(t.urlFromState({ view: 'archiv' }), '/DEDaily.html?view=archiv');
  const legacyHome = t.stateFromUrl('http://localhost/DEDaily.html?mode=sentences');
  assert.equal(legacyHome.view, 'today');
  assert.equal(legacyHome.todayTab, 'sentences');
  assert.equal(t.urlFromState(legacyHome), '/DEDaily.html?view=today&mode=sentences');
  for (const view of ['today', 'practice', 'frequency', 'browse', 'kursplan', 'library', 'progress']) {
    assert(t.renderArchive().includes(`href="/DEDaily.html?view=${view}"`), `Archive links to ${view}`);
  }
  assert(t.LiDLearning.ready);

  let data = lid.startPractice(lid.blank(), 'state', roundId(1), start);
  const firstId = data.practice.items[0].questionId;
  const correct = lid.byId.get(firstId).answer;
  const wrong = (correct + 1) % 4;
  assert.equal(firstId, 'bw-01');
  assert.equal(data.practice.items.length, 10);
  assert.strictEqual(lid.nextPractice(data, roundId(1), 0), data, 'continue requires a checked answer');
  data = lid.checkPractice(data, roundId(1), 0, wrong, start);
  assert.strictEqual(lid.checkPractice(data, roundId(1), 0, wrong, start), data, 'double checks are idempotent');
  assert.equal(data.practice.items.length, 10, 'a wrong state answer does not extend the round');
  assert(lid.readData(JSON.parse(JSON.stringify(data))).practice, 'a checked question resumes after reload');
  assert.equal(lid.progress(data, days(0)).openErrors[0].due, days(1));

  for (let index = 1; index < 10; index++) {
    data = lid.nextPractice(data, roundId(1), index - 1, start);
    const question = lid.byId.get(data.practice.items[index].questionId);
    data = lid.checkPractice(data, roundId(1), index, question.answer, start);
  }

  const { practice, rounds: [stateRound] } = data;
  const queuedItems = [...practice.items];
  queuedItems.splice(4, 0, { questionId: firstId, retry: true });
  const parked = lid.readData({
    ...data, practice: null, parkedPractices: [{ ...practice, index: 4, items: queuedItems }],
    rounds: [{ ...stateRound, attempts: stateRound.attempts.slice(0, 4) }],
  });
  assert.deepEqual(parked.practice.items, practice.items, 'a saved round drops pending retries');
  assert.equal(parked.practice.index, 4, 'a cursor on a pending retry advances to the next unanswered question');

  const lateAttempt = stateRound.attempts[8];
  const tail = lid.readData({
    ...data,
    practice: { ...practice, index: 10, items: [...practice.items, { questionId: lateAttempt.questionId, retry: true }] },
    rounds: [{ ...stateRound, attempts: stateRound.attempts.map((attempt, index) => index === 8
      ? { ...attempt, choice: (attempt.choice + 1) % 4, correct: false } : attempt) }],
  });
  assert.equal(tail.practice.index, 9, 'a trailing retry returns to the final answered question');
  assert.equal(lid.nextPractice(tail, roundId(1), 9, start).practice, null);

  data = lid.nextPractice(data, roundId(1), 9, start);
  assert.equal(data.practice, null, 'state practice completes after ten questions');
  let stats = lid.progress(data, days(0));
  assert.equal(stats.firstPass, 10);
  assert.equal(stats.firstPassCorrect, 9);
  assert.equal(stats.openErrors[0].wrong, 1);
  assert.deepEqual([...lid.missedQuestionIds(data.rounds[0])], [firstId]);
  assert.equal(stats.perQuestion.size, 10);
  assert.equal(stats.attempts, 10);

  const legacyHistory = lid.readData({
    ...data, rounds: [{ ...stateRound, completion: data.rounds[0].completion,
      attempts: [...stateRound.attempts, { ...stateRound.attempts[0], retry: true }] }],
  });
  assert.equal(lid.progress(legacyHistory, days(0)).openErrors[0].wrong, 2, 'answered retries stay in history');
  assert.deepEqual([...lid.missedQuestionIds(legacyHistory.rounds[0])], [firstId], 'a past retry appears once in mistake practice');

  const answerError = (roundIndex, offset) => {
    const id = roundId(roundIndex);
    data = lid.startPractice(data, 'errors', id, timestamp(offset));
    assert.equal(data.practice.items[0].questionId, firstId);
    data = lid.checkPractice(data, id, 0, correct, timestamp(offset));
    assert.equal(data.practice.items.length, 1);
    data = lid.nextPractice(data, id, 0, timestamp(offset));
  };
  answerError(2, 0);
  assert.equal(lid.progress(data, days(0)).openErrors[0].due, days(1), 'same-day practice does not advance a review');
  answerError(3, 1);
  assert.equal(lid.progress(data, days(1)).openErrors[0].due, days(4));
  answerError(4, 4);
  stats = lid.progress(data, days(4));
  assert.equal(stats.openErrors.length, 0, 'two due successes on different days resolve the error');
  assert.equal(stats.errors[0].due, days(11));

  const daily = lid.startPractice(data, 'daily', roundId(5), timestamp(11), () => 0.5);
  const dueIds = lid.progress(data, days(11)).due.map(item => item.question.id);
  assert.deepEqual(daily.practice.items.slice(0, dueIds.length).map(item => item.questionId), dueIds, 'due tasks precede unseen questions');
  assert.equal(new Set(daily.practice.items.map(item => item.questionId)).size, 10);
  const dailyAnswer = lid.byId.get(daily.practice.items[0].questionId).answer;
  assert.equal(lid.checkPractice(daily, roundId(5), 0, (dailyAnswer + 1) % 4, timestamp(11)).practice.items.length, 10);
  const legacyDay = lid.readData({ ...daily, parkedPractices: undefined });
  const expanded = lid.startPractice(legacyDay, 'all', roundId(6), timestamp(11));
  assert.equal(expanded.practice.id, daily.practice.id, 'opening all questions preserves a legacy round');
  assert.deepEqual(expanded.practice.items.slice(0, 10), daily.practice.items);
  assert.equal(new Set(expanded.practice.items.map(item => item.questionId)).size, 310);

  const allId = roundId(7);
  let all = lid.startPractice(lid.blank(), 'all', allId, start);
  assert.deepEqual(all.practice.items.map(item => item.questionId), lid.questions.map(question => question.id));
  for (const [index, question] of lid.questions.entries()) {
    all = lid.checkPractice(all, allId, index, index ? question.answer : (question.answer + 1) % 4, start);
    all = lid.nextPractice(all, allId, index, start);
  }
  assert.equal(all.practice, null);
  assert.equal(lid.readData(JSON.parse(JSON.stringify(all))).rounds[0].attempts.length, 310);
  assert.equal(lid.progress(all).openErrors.length, 1, 'a catalog miss carries over to mistake practice');

  const old = JSON.parse(JSON.stringify(data));
  old.rounds.forEach(round => round.attempts.forEach(item => {
    if (item.questionId === firstId) item.revision = '0000000000000000';
  }));
  const revision = lid.progress(lid.readData(old), days(5)).perQuestion.get(firstId);
  assert(revision.revised && revision.due === days(5));
  assert.equal(revision.wrong, 1, 'revised questions retain prior statistics');
  assert.equal(lid.missedQuestionIds(lid.readData(old).rounds[0]).length, 0, 'old revisions stay out of targeted review');

  for (const score of [14, 15, 16, 17]) {
    const id = roundId(10 + score);
    let exam = lid.startExam(lid.blank(), id, start, () => 0.5);
    assert.equal(exam.exam.questionIds.filter(questionId => questionId.startsWith('bw-')).length, 3);
    assert.equal(new Set(exam.exam.questionIds).size, 33);
    const otherExam = lid.startExam(lid.blank(), roundId(40), start, () => 0.6);
    assert.notDeepEqual(exam.exam.questionIds, otherExam.exam.questionIds, 'a new exam draws a fresh sample');
    const deadline = exam.exam.deadline;
    assert.equal(deadline, start + 3600000);
    for (let index = 0; index <= score; index++) {
      exam = lid.moveExam(exam, id, index, start);
      const answer = lid.byId.get(exam.exam.questionIds[index]).answer;
      exam = lid.selectExam(exam, id, index, (answer + 1) % 4, start);
      if (index < score) exam = lid.selectExam(exam, id, index, answer, start);
    }
    const examOrder = exam.exam.questionIds;
    exam = lid.readData(JSON.parse(JSON.stringify(exam)));
    assert.equal(exam.exam.deadline, deadline, 'resuming does not restart the timer');
    exam = lid.selectExam(exam, id, score + 1, 0, deadline + 1);
    assert.equal(exam.exam, null, 'changes after the deadline finalize without grading the late answer');
    assert.strictEqual(lid.finishExam(exam, id, deadline), exam, 'double submission is idempotent');
    const [result] = exam.rounds;
    assert.equal(result.completion.reason, 'expired');
    assert.equal(result.completion.elapsedMs, 3600000);
    assert.deepEqual(lid.readData(JSON.parse(JSON.stringify(exam))).rounds[0].completion.questionIds, examOrder);
    const report = lid.examResult(result);
    assert.equal(report.correct, score);
    assert.equal(report.wrong, 1);
    assert.equal(report.unanswered, 32 - score);
    assert.equal(report.orientation, score >= 15);
    assert.equal(report.citizenship, score >= 17);
    assert.equal(lid.progress(exam, days(0)).openErrors.length, 1);
    assert.equal(lid.progress(exam, days(0)).firstPass, 0);
    const errors = lid.startMissedPractice(exam, id, roundId(28));
    assert.deepEqual([...errors.practice.items.map(item => item.questionId)], [result.attempts[score].questionId],
      'result review repeats only the missed question and skips unanswered and correct ones');
    assert.strictEqual(lid.startMissedPractice(errors, id, roundId(29)), errors, 'result review preserves an active round');
  }

  const examId = roundId(30);
  let allWrong = lid.startExam(lid.blank(), examId, start, () => 0.5);
  for (const [index, questionId] of allWrong.exam.questionIds.entries()) {
    allWrong = lid.moveExam(allWrong, examId, index, start);
    allWrong = lid.selectExam(allWrong, examId, index, (lid.byId.get(questionId).answer + 1) % 4, start);
  }
  allWrong = lid.finishExam(allWrong, examId, start);
  const wideReviewId = roundId(31);
  let wideReview = lid.startMissedPractice(allWrong, examId, wideReviewId);
  assert.equal(lid.readData(JSON.parse(JSON.stringify(wideReview))).practice.items.length, 33);
  while (wideReview.practice) {
    const { index, items } = wideReview.practice;
    const correctChoice = lid.byId.get(items[index].questionId).answer;
    wideReview = lid.checkPractice(wideReview, wideReviewId, index, (correctChoice + 1) % 4, start);
    wideReview = lid.nextPractice(wideReview, wideReviewId, index, start);
  }
  assert.equal(lid.readData(JSON.parse(JSON.stringify(wideReview))).rounds[1].attempts.length, 33,
    'a full result review asks each missed question once');

  const batchId = roundId(32);
  let errorBatch = lid.startPractice(allWrong, 'errors', batchId, start + 1);
  const recentQuestions = new Set(errorBatch.practice.items.map(item => item.questionId));
  assert.equal(recentQuestions.size, 10);
  while (errorBatch.practice) {
    const { index, items } = errorBatch.practice;
    const correctChoice = lid.byId.get(items[index].questionId).answer;
    errorBatch = lid.checkPractice(errorBatch, batchId, index, index ? correctChoice : (correctChoice + 1) % 4, start + 1);
    errorBatch = lid.nextPractice(errorBatch, batchId, index, start + 1);
  }
  assert.equal(errorBatch.rounds.find(round => round.id === batchId).attempts.length, 10, 'mistake practice does not repeat within a round');
  const nextBatch = lid.startPractice(errorBatch, 'errors', roundId(33), start + 2);
  assert(nextBatch.practice.items.every(item => !recentQuestions.has(item.questionId)),
    'the next home review prioritizes open mistakes not reached in the previous batch');

  store[t.LiDStore.key] = 'corrupt local data';
  t.LiDStore.read();
  assert.match(t.LiDStore.warning(), /geladen/);
  await t.LiDStore.update(() => data);
  assert.equal(store[`${t.LiDStore.key}_recovery`], 'corrupt local data');
  const backup = t.backupExportObj();
  assert.equal(backup.lid.rounds.length, data.rounds.length);
  assert(!Object.hasOwn(backup.lid, 'practice'), 'transferred backups contain practice history');
  const copy = JSON.stringify(backup);
  delete store[t.LiDStore.key];
  await t.applyImport(copy);
  await t.applyImport(copy);
  assert.equal(lid.progress(t.LiDStore.read()).attempts, stats.attempts, 'import restores attempts without duplicating them');
  await t.applyImport(JSON.stringify({ learned: ['un1'] }));
  assert(t.DB().learned.has('un1'), 'legacy backup remains compatible');
  assert.equal(lid.progress(t.LiDStore.read()).attempts, stats.attempts, 'legacy backup preserves LiD progress');
  assert.equal(await t.LiDStore.importBackup({ version: 1, rounds: [{ mode: 'exam', attempts: [] }] }), false);
  console.log('Leben in Deutschland logic-tests passed');
}

function mountLiDForTest() {
  const { LiDLearning, LiDStore, LiDView } = t;
  store[LiDStore.key] = JSON.stringify(LiDLearning.blank());
  const events = new Map();
  const root = makeElement();
  root.addEventListener = (type, listener) => events.set(type, listener);
  const click = (lidAction, value = '', owner = null, row = null) => {
    assert.match(root.innerHTML, new RegExp(`<button[^>]*data-lid-action="${lidAction}" data-value="${value}"[^>]*>`));
    const trigger = { ...makeElement(), dataset: { lidAction, value }, closest: selector => selector === '.lid-bookmark-row' ? row : owner };
    return events.get('click')({ target: { closest: () => trigger } });
  };
  const submit = (id, choice) => events.get('submit')({
    target: { matches: selector => selector === '.lid-exercise-form', dataset: { lidRound: id, index: '0' } },
    submitter: { name: 'lid-choice', value: String(choice) },
    preventDefault: () => {},
  });

  LiDView.mount(root);
  return { root, click, submit, events };
}

async function testLiDErrorTraining() {
  const { LiDLearning, LiDStore, LiDView } = t;
  const { root, click, submit } = mountLiDForTest();
  assert.doesNotMatch(root.innerHTML, /Fehlerverlauf/);
  await click('start-practice', 'all');
  const catalog = LiDStore.read().practice;
  assert.match(root.innerHTML, /Aufgabe 1 von 310/);
  await click('home');
  await click('topics');
  await click('start-practice', 'state');
  const practice = LiDStore.read().practice;
  assert.match(root.innerHTML, /Aufgabe 1 von 10/);
  await click('topics');
  await click('home');
  await click('start-practice', 'errors');
  assert.match(root.innerHTML, /Du hast keine offenen Fehler/);
  assert.strictEqual(LiDStore.read().practice, practice, 'an empty review leaves the round open');

  await click('home');
  await click('topics');
  await click('start-practice', 'state');
  const correct = LiDLearning.byId.get(practice.items[0].questionId).answer;
  await submit(practice.id, (correct + 1) % 4);
  assert.match(root.innerHTML, /<strong>Falsch<\/strong>/);
  await click('topics');
  await click('home');
  await click('start-practice', 'errors');
  const { practice: review, parkedPractices } = LiDStore.read();
  assert.equal(review.items[0].questionId, practice.items[0].questionId);
  assert.deepEqual([...parkedPractices.map(item => item.id)], [catalog.id, practice.id]);

  const saved = LiDLearning.readData(JSON.parse(store[LiDStore.key]));
  assert.deepEqual(saved.practice, review, 'an unanswered review resumes after reload');
  assert.deepEqual(saved.parkedPractices, parkedPractices, 'both paused rounds resume after reload');
  const legacy = LiDLearning.readData({ ...saved, parkedPractices: undefined, pausedPractice: parkedPractices[1] });
  assert.equal(legacy.parkedPractices[0].id, practice.id, 'the previous single paused round is retained');

  await click('home');
  await click('topics');
  await click('start-practice', 'state');
  assert.match(root.innerHTML, /<strong>Falsch<\/strong>/, 'the regular round keeps its answered question');
  await click('topics');
  await click('home');
  await click('start-practice', 'errors');
  await submit(review.id, correct);
  await click('next-practice', '', { dataset: { lidRound: review.id, index: '0' } });
  assert.match(root.innerHTML, /Übungsrunde abgeschlossen/);
  assert.deepEqual(LiDStore.read().practice, parkedPractices[1], 'finishing review restores the most recent round');
  await click('home');
  await click('start-practice', 'all');
  assert.deepEqual(LiDStore.read().practice, catalog, 'the catalog round can still be resumed');
  LiDView.unmount();
  console.log('Fehlertraining navigation tests passed');
}

async function testLiDTopics() {
  const { LiDLearning: lid, LiDStore, LiDView } = t;
  const { root, click, submit } = mountLiDForTest();
  const topics = lid.topicProgress(lid.blank());
  const topicIds = new Map(topics.map(({ mode }, index) => {
    const data = lid.startPractice(lid.blank(), mode, String(index + 1).padStart(32, '0'));
    return [mode, data.practice.items.map(item => item.questionId)];
  }));
  const allIds = [...topicIds.values()].flat();
  assert.equal(allIds.length, 310);
  assert.equal(new Set(allIds).size, 310, 'every catalog question belongs to exactly one practice topic');
  assert(topicIds.get('politics').includes('de-243'), 'the assembly question is grouped with political participation');
  assert(topicIds.get('history').includes('de-288'), 'the historical responsibility question is grouped with history');
  assert(topicIds.get('society').includes('de-182'), 'the synagogue question is grouped with religious diversity');
  assert(topicIds.get('state').every(id => id.startsWith('bw-')));

  await click('topics');
  await click('start-practice', 'politics');
  const politics = LiDStore.read().practice;
  const question = lid.byId.get(politics.items[0].questionId);
  await submit(politics.id, (question.answer + 1) % 4);
  await click('topics');
  assert.match(root.innerHTML, /Fortsetzen · 1 von \d+ beantwortet · 1 offener Fehler/);
  await click('start-practice', 'history');
  const switched = lid.readData(JSON.parse(store[LiDStore.key]));
  assert.equal(switched.parkedPractices[0].id, politics.id, 'each topic retains its own saved position');
  await click('stop-practice', '', { dataset: { lidRound: switched.practice.id, index: '0' } });
  assert.match(root.innerHTML, /id="lid-heading" tabindex="-1">Nach Themen üben/);
  await click('start-practice', 'politics');
  assert.match(root.innerHTML, /<strong>Falsch<\/strong>/, 'resuming the topic restores the checked answer');
  const { lid: backup } = t.backupExportObj();
  assert.equal(lid.topicProgress({ ...lid.blank(), rounds: lid.readRounds(backup) })[0].errors, 1);
  LiDView.unmount();

  const id = '1'.repeat(32);
  let completed = lid.startPractice(lid.blank(), 'politics', id);
  for (const [index, item] of completed.practice.items.entries()) {
    const answer = lid.byId.get(item.questionId).answer;
    completed = lid.checkPractice(completed, id, index, (answer + 1) % 4);
    completed = lid.nextPractice(completed, id, index);
  }
  const review = lid.startMissedPractice(completed, id, '2'.repeat(32));
  const restored = lid.readData(JSON.parse(JSON.stringify(review)));
  assert.equal(restored.practice.items.length, topicIds.get('politics').length, 'review of a full topic survives reload');
  console.log('Topic practice and progress tests passed');
}

async function testLiDExamProfile() {
  const { LiDLearning, LiDStore, LiDView } = t;
  const { root, click, events } = mountLiDForTest();
  const nodes = new Map();
  root.querySelector = selector => {
    if (!nodes.has(selector)) nodes.set(selector, makeElement());
    return nodes.get(selector);
  };
  await click('profile');
  assert.match(root.innerHTML, /Hier erscheinen deine abgeschlossenen Probetests/);
  await click('home');
  await click('exam-intro');
  assert.match(root.innerHTML, /30 allgemeine Fragen und 3 Fragen zu Baden-Württemberg/);
  assert.equal(LiDStore.read().exam, null, 'exam instructions do not start the timer');

  await click('start-exam');
  assert.equal([...root.innerHTML.matchAll(/class="lid-exam-number/g)].length, 33);
  assert.match(root.innerHTML, /id="lid-timer"/);
  const exam = LiDStore.read().exam;
  const owner = { dataset: { lidRound: exam.id, index: '0' } };
  await click('toggle-bookmark', exam.questionIds[0], owner);
  assert.strictEqual(LiDStore.read().exam, exam, 'saving a question does not change the timer or answers');
  const wrong = (LiDLearning.byId.get(exam.questionIds[0]).answer + 1) % 4;
  const choose = () => events.get('change')({
    target: { name: 'lid-choice', checked: true, value: String(wrong), closest: () => owner },
  });
  await choose();
  assert.equal(LiDStore.read().exam.selections[0], wrong);
  assert.doesNotMatch(root.innerHTML, /id="lid-feedback"/);
  await click('clear-exam-answer', '', owner);
  assert.equal(LiDStore.read().exam.selections[0], null);
  await choose();
  await click('ask-exam', '', owner);
  assert.equal(root.querySelector('#lid-confirm').hidden, false);
  assert.match(root.querySelector('#lid-confirm-text').textContent, /32 Aufgaben/);
  await click('finish-exam', '', owner);
  assert.equal(LiDStore.read().exam, null);
  assert.match(root.innerHTML, /Falsche und offene Antworten/);
  assert.match(root.innerHTML, /<strong>Deine Antwort<\/strong>/);
  assert.match(root.innerHTML, /<strong>Richtige Antwort<\/strong>/);
  assert.match(root.innerHTML, /class="lid-bookmark"[^>]+aria-pressed="true"/);
  const { completion } = LiDStore.read().rounds[0];
  assert.equal(completion.reason, 'submitted');
  assert(completion.elapsedMs < 3600000);

  await click('profile');
  assert.match(root.innerHTML, /0\/33 · Ergebnis ansehen/);
  assert.match(root.innerHTML, /Offene Fehler<\/dt><dd>1/);
  await click('show-result', exam.id);
  assert.match(root.innerHTML, /Falsche und offene Antworten/);
  await click('review-result', exam.id);
  assert.equal(LiDStore.read().practice.items[0].questionId, exam.questionIds[0]);
  LiDView.unmount();
  console.log('Mock exam and profile navigation tests passed');
}

async function testLiDBookmarks() {
  const { LiDLearning, LiDStore, LiDView } = t;
  const { root, click } = mountLiDForTest();
  await click('saved');
  assert.match(root.innerHTML, /auf das Lesezeichen/);
  await click('home');
  await click('start-practice', 'all');
  const { questionId } = LiDStore.read().practice.items[0];
  await click('toggle-bookmark', questionId);
  assert.equal(JSON.parse(store[LiDStore.key]).savedQuestionIds[0], questionId);
  assert.equal(LiDStore.read().rounds[0].attempts.length, 0, 'saving does not submit an answer');

  const { lid: backup } = t.backupExportObj();
  assert.equal(backup.rounds.length, 0);
  delete store[LiDStore.key];
  assert(await LiDStore.importBackup({ ...backup, savedQuestionIds: [questionId, questionId, 'invalid'] }));
  assert(await LiDStore.importBackup({ version: 1, rounds: [] }));
  assert.deepEqual([...LiDStore.read().savedQuestionIds], [questionId], 'bookmarks merge without duplicate or invalid IDs');

  await click('home');
  await click('saved');
  assert(root.innerHTML.includes(LiDLearning.byId.get(questionId).prompt));
  let removed = false;
  await click('toggle-bookmark', questionId, null, { remove: () => { removed = true; } });
  assert.equal(removed, true);
  assert.equal(LiDStore.read().savedQuestionIds.length, 0);
  assert.match(root.innerHTML, /auf das Lesezeichen/);
  LiDView.unmount();
  console.log('Bookmark storage and navigation tests passed');
}

testLiD().then(testLiDErrorTraining).then(testLiDTopics).then(testLiDExamProfile).then(testLiDBookmarks).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
