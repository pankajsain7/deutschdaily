const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const source = [
  read('src/content.js'),
  read('src/learning.js'),
  read('src/frequency-dictionary-data.js'),
  read('src/storage.js'),
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
    schedulePattern,
    getSrsReviewIds,
    getPatternReviewIds,
    practiceAnswer,
    practiceNext,
    startPractice,
    setPracticeDir,
    startPatternPractice,
    patternPracticeAnswer,
    patternPracticeNext,
    renderKursplan,
    setPracticeState: value => { P = value; },
    getPracticeState: () => P,
    DB: () => DB,
    stateFromUrl,
    urlFromState,
    applyUrlState,
    normalizePatternFilter,
    renderRevealDetails,
    applyImport,
    mergeAttempts,
    mergeSrsMaps,
    validFrequencyRankSet,
    getHistoryDaySummary,
    renderProgressDashboard,
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
    patternPracticeReveal,
    patternPracticePrev,
    getFreqLeechIds,
    getNewFreqPool,
    shouldPromptReview,
    markReviewPromptSeen,
    renderPracticeHub,
    mergeFreqRatingStates,
    getFrequencyPracticeState: () => FP,
    getPatternPracticeState: () => PP,
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

reset({});
const firstPattern = t.schedulePattern('would_possible', true);
assert.strictEqual(firstPattern.intervalBefore, 0, 'new pattern SRS starts from interval zero');
assert.strictEqual(t.DB().patternSrs.would_possible.interval, 3, 'first understood pattern uses the first-review interval');

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

reset({
  patternSrs: { would_possible: { interval: 1, ease: 2.5, level: 0, nextReview: t.today(), lastReview: t.today() } },
  understood: [],
});
assert.strictEqual(JSON.stringify(t.getPatternReviewIds()), JSON.stringify(['would_possible']), 'failed patterns with SRS stay eligible for review');

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

const patternUrl = t.urlFromState({ view: 'patterns', patFilter: 'due' });
assert.strictEqual(patternUrl, '/DEDaily.html?view=patterns&filter=due', 'pattern URL should serialize filter');
const practiceUrl = t.urlFromState({ view: 'practice' });
assert.strictEqual(practiceUrl, '/DEDaily.html?view=practice', 'practice URL should serialize the view');
assert.strictEqual(t.normalizePatternFilter('all'), 'all', 'known pattern filters are preserved');
assert.strictEqual(t.normalizePatternFilter('new'), 'learning', 'unknown/legacy pattern filters default to learning');

t.applyUrlState('http://localhost/DEDaily.html?view=patterns');
assert.strictEqual(t.getViewState().view, 'patterns', 'patterns URL opens Patterns tab');
assert.strictEqual(t.getViewState().patFilter, 'learning', 'Patterns tab defaults to Learning');

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
assert(t.renderKursplan().includes('deutsch-a1-b1-kursplan.html'), 'kursplan view embeds deutsch-a1-b1-kursplan.html iframe');

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
assert.strictEqual(t.getFrequencyPracticeState().queue.length, 61, 'Again requeues the card later in the session');
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
t.frequencyPracticePrev();
assert.strictEqual(t.getFrequencyPracticeState().idx, 0, 'does not go below card 0 on prev');

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

t.startPatternPractice({ ids: ['polite_request_modal', 'ask_meaning'] });
assert.strictEqual(t.getPatternPracticeState().idx, 0, 'starts at pattern 0');
t.patternPracticeNext();
assert.strictEqual(t.getPatternPracticeState().idx, 0, 'pattern does not advance on next without rating');
t.patternPracticeReveal();
assert.strictEqual(t.getPatternPracticeState().revealed, true, 'patternPracticeReveal unhides pattern card');
t.patternPracticeReveal();
assert.strictEqual(t.getPatternPracticeState().revealed, false, 'patternPracticeReveal hides pattern card on second call');
t.patternPracticeAnswer(true);
assert.strictEqual(t.getPatternPracticeState().idx, 1, 'advances to pattern 1 after rating');
t.patternPracticePrev();
assert.strictEqual(t.getPatternPracticeState().idx, 0, 'pattern goes back on prev');
t.patternPracticeNext();
assert.strictEqual(t.getPatternPracticeState().idx, 1, 'pattern advances on next since pattern 0 was already rated');

console.log('logic-tests passed');
