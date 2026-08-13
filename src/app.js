// ══════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════
let V = { view: 'today', todayTab: 'vocab', topicId: null, filter: 'all', query: '', speaking: null, libTab: 'learned', libType: 'vocab', patFilter: 'learning', historyDay: null, progressTab: 'overview', progressType: 'vocab', freqFilter: 'all', freqRange: 'all', freqPage: 1, freqRevealed: {} };

const PAGE_SIZE = 50;

// ══════════════════════════════════════════════
// PATTERN DETECTION FOR SENTENCES
// ══════════════════════════════════════════════
function findMatchingPattern(sentence) {
  const explicit = (sentence.patternIds || []).map(id => PATTERN_BY_ID[id]).find(Boolean);
  if (explicit) return explicit;
  return null;
}
const VALID_VIEWS = new Set(['today', 'browse', 'practice', 'kursplan', 'frequency', 'patterns', 'saved', 'progress', 'history-day']);
const VALID_PROGRESS_TABS = new Set(['overview', 'activity']);
const VALID_FILTERS = new Set(['all', 'unlearned', 'learned', 'favorites']);
const VALID_FREQ_FILTERS = new Set(['all', 'new', 'due', 'learned', 'saved']);
const VALID_FREQ_RANGES = new Set(['all', '1-500', '501-1000', '1001-1500', '1501-2000', '2001-2525']);
const VALID_PATTERN_FILTERS = new Set(['learning', 'due', 'understood', 'all']);
const VALID_LIBRARY_TABS = new Set(['saved', 'learned']);
const VALID_LIBRARY_TYPES = new Set(['sentences', 'vocab']);
const TOPIC_IDS = new Set(TOPICS.map(t => t.id));

function normalizeViewName(view) {
  const raw = String(view || 'today');
  if (raw === 'library') return 'saved';
  if (raw === 'stats' || raw === 'history') return 'progress';
  if (raw === 'vocab') return 'frequency';
  return VALID_VIEWS.has(raw) ? raw : 'today';
}
function normalizeProgressTab(value) {
  const raw = String(value || 'overview');
  return VALID_PROGRESS_TABS.has(raw) ? raw : 'overview';
}
function normalizePatternFilter(value) {
  const raw = String(value || 'learning');
  if (raw === 'new') return 'learning';
  return VALID_PATTERN_FILTERS.has(raw) ? raw : 'learning';
}

function stateFromUrl(href) {
  const fallback = { view: 'today', todayTab: 'vocab', topicId: null, filter: 'all', query: '', libTab: 'learned', libType: 'vocab', patFilter: 'learning', historyDay: null, progressTab: 'overview', progressType: 'vocab', freqFilter: 'all', freqRange: 'all' };
  let params;
  try {
    const base = window.location && window.location.href ? window.location.href : 'http://localhost/';
    params = new URL(href || base, base).searchParams;
  } catch (error) {
    params = new URLSearchParams(window.location ? window.location.search : '');
  }
  const viewParam = params.get('view');
  const view = normalizeViewName(viewParam || 'today');
  const topic = params.get('topic');
  const filter = params.get('filter');
  const range = params.get('range');
  const tab = params.get('tab');
  const mode = params.get('mode');
  const type = params.get('type');
  const day = normalizeDateKey(params.get('day'));

  if (view === 'today') {
    fallback.view = 'today';
    fallback.todayTab = mode === 'vocab' || mode === 'sentences' ? mode : (typeof DB !== 'undefined' && DB.todayTab === 'sentences' ? 'sentences' : 'vocab');
  } else if (view === 'browse') {
    fallback.view = 'browse';
    fallback.topicId = topic && TOPIC_IDS.has(topic) ? topic : null;
    fallback.filter = VALID_FILTERS.has(filter) ? filter : 'all';
  } else if (view === 'frequency') {
    fallback.view = 'frequency';
    fallback.freqFilter = VALID_FREQ_FILTERS.has(filter) ? filter : 'all';
    fallback.freqRange = VALID_FREQ_RANGES.has(range) ? range : 'all';
  } else if (view === 'patterns') {
    fallback.view = 'patterns';
    fallback.patFilter = normalizePatternFilter(filter);
  } else if (view === 'saved') {
    fallback.view = 'saved';
    fallback.libTab = VALID_LIBRARY_TABS.has(tab) ? tab : 'learned';
    fallback.libType = VALID_LIBRARY_TYPES.has(type) ? type : 'vocab';
  } else if (view === 'progress' || view === 'history-day') {
    if (day) {
      fallback.view = 'history-day';
      fallback.historyDay = day;
    } else {
      fallback.view = 'progress';
      fallback.progressTab = normalizeProgressTab(tab || (viewParam === 'history' ? 'activity' : 'overview'));
      fallback.progressType = type === 'sentences' ? 'sentences' : 'vocab';
    }
  } else {
    fallback.view = view;
  }
  return fallback;
}
function urlFromState(state = V) {
  const params = new URLSearchParams();
  const view = normalizeViewName(state.view);
  const publicView = view === 'saved' ? 'library' : (view === 'history-day' || view === 'progress') ? 'progress' : view;
  if (publicView !== 'today') params.set('view', publicView);
  if (view === 'today') {
    if (state.todayTab === 'sentences') params.set('mode', 'sentences');
  } else if (view === 'browse') {
    if (state.topicId && TOPIC_IDS.has(state.topicId)) params.set('topic', state.topicId);
    if (state.filter && state.filter !== 'all') params.set('filter', state.filter);
  } else if (view === 'frequency') {
    if (state.freqFilter && state.freqFilter !== 'all') params.set('filter', state.freqFilter);
    if (state.freqRange && state.freqRange !== 'all') params.set('range', state.freqRange);
  } else if (view === 'patterns') {
    params.set('filter', normalizePatternFilter(state.patFilter));
  } else if (view === 'saved') {
    if (state.libTab && state.libTab !== 'learned') params.set('tab', state.libTab);
    if (state.libType === 'sentences') params.set('type', 'sentences');
  } else if (view === 'progress') {
    if (state.progressTab && state.progressTab !== 'overview') params.set('tab', state.progressTab);
    if (state.progressType === 'sentences') params.set('type', 'sentences');
  } else if (view === 'history-day' && state.historyDay) {
    params.set('day', state.historyDay);
  }
  const query = params.toString();
  const pathname = window.location && window.location.pathname ? window.location.pathname : '/';
  return query ? `${pathname}?${query}` : pathname;
}
function applyUrlState(href) {
  const next = stateFromUrl(href);
  V.view = next.view;
  V.todayTab = next.todayTab || (typeof DB !== 'undefined' && DB.todayTab === 'sentences' ? 'sentences' : 'vocab');
  V.topicId = next.topicId;
  V.filter = next.filter;
  V.query = '';
  V.libTab = next.libTab;
  V.libType = next.libType;
  V.patFilter = next.patFilter;
  V.freqFilter = next.freqFilter;
  V.freqRange = next.freqRange;
  V.historyDay = next.historyDay;
  V.progressTab = next.progressTab;
  V.progressType = next.progressType || 'vocab';
}
function syncUrl(replace = false) {
  if (!window.history || !window.location) return;
  const next = urlFromState(V);
  const current = `${window.location.pathname}${window.location.search}`;
  if (next === current) return;
  const method = replace ? 'replaceState' : 'pushState';
  window.history[method]({ view: V.view }, '', next);
}
function commitState({ replace = false, scroll = false } = {}) {
  syncUrl(replace);
  render();
  if (scroll) window.scrollTo(0, 0);
}
function nav(view, extra) {
  const nextView = normalizeViewName(view);
  V.view = nextView;
  if (nextView === 'today' && (extra === 'sentences' || extra === 'vocab')) V.todayTab = extra;
  V.topicId = nextView === 'browse' && extra && TOPIC_IDS.has(extra) ? extra : null;
  V.filter = 'all';
  V.freqFilter = 'all';
  V.freqRange = 'all';
  V.freqPage = 1;
  V.query = '';
  V.historyDay = null;
  if (nextView === 'patterns') V.patFilter = 'learning';
  commitState({ scroll: true });
}
function setTodayTab(tab) {
  const mode = tab === 'vocab' ? 'vocab' : 'sentences';
  V.todayTab = mode;
  if (typeof DB !== 'undefined') {
    DB.todayTab = mode;
    save();
  }
  V.query = '';
  commitState();
}

function jsArg(v) {
  return JSON.stringify(String(v))
    .replace(/&/g, '&amp;')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function idsArg(ids) {
  return JSON.stringify(ids).replace(/"/g, "'");
}

// ══════════════════════════════════════════════
// ICONS
// 24px grid, stroke-based, inherits color + font-size from its label.
// ══════════════════════════════════════════════
const svg = (body, opts = '') =>
  `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true" focusable="false"${opts}>${body}</svg>`;

const ICO = {
  speak: svg(`<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>`),
  check: svg(`<polyline points="20 6 9 17 4 12"/>`),
  star: `<svg class="ico" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><path d="m12 3 2.7 5.46 6.03.88-4.36 4.25 1.03 6L12 16.77 6.6 19.6l1.03-6-4.36-4.25 6.03-.88L12 3z"/></svg>`,
  starOutline: svg(`<path d="m12 3 2.7 5.46 6.03.88-4.36 4.25 1.03 6L12 16.77 6.6 19.6l1.03-6-4.36-4.25 6.03-.88L12 3z"/>`),

  // Navigation
  today: svg(`<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="m9 14.5 2 2 4-4"/>`),
  sentences: svg(`<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>`),
  vocab: svg(`<path d="M4 17.5 9 6.5l5 11M5.8 14h6.4"/><path d="M17 10.5c2.2 0 3 1.2 3 2.6v4.4M20 13.6c-3.2 0-4.4.7-4.4 2.2 0 1 .8 1.8 2 1.8 1.4 0 2.4-1 2.4-2.3"/>`),
  patterns: svg(`<path d="M9.5 3h5a1 1 0 0 1 1 1v1.5a1.75 1.75 0 1 0 3.5 0V4a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1.5a1.75 1.75 0 1 0 0 3.5H20a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-5"/><path d="M9.5 3a1 1 0 0 0-1 1v1.5a1.75 1.75 0 0 1-3.5 0V4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h1.5a1.75 1.75 0 0 1 0 3.5H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h5.5"/>`),
  kursplan: svg(`<path d="m9 4.5-6 2.4v13l6-2.4 6 2.4 6-2.4v-13L15 6.9 9 4.5z"/><path d="M9 4.5v13M15 6.9v13"/>`),
  library: svg(`<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 0 4 21V5.5z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20"/>`),
  progress: svg(`<path d="M3 20.5h18"/><rect x="5" y="11" width="3.6" height="7"  rx="1"/><rect x="10.2" y="6" width="3.6" height="12" rx="1"/><rect x="15.4" y="13.5" width="3.6" height="4.5" rx="1"/>`),

  // Status / actions
  flame: svg(`<path d="M12 2.5s5.5 4.2 5.5 9.2a5.5 5.5 0 0 1-11 0c0-1.7.7-3.2 1.6-4.5.4 1 1.2 1.8 2.1 1.8 1.2 0 1.6-1.1 1.6-2.4 0-1.5-.5-3-.5-4.1z"/><path d="M12 19.5a2.6 2.6 0 0 0 2.6-2.6c0-1.7-2.6-4-2.6-4s-2.6 2.3-2.6 4A2.6 2.6 0 0 0 12 19.5z"/>`),
  target: svg(`<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>`),
  repeat: svg(`<path d="M17 2.5 20.5 6 17 9.5"/><path d="M3.5 12V10a4 4 0 0 1 4-4h13"/><path d="M7 21.5 3.5 18 7 14.5"/><path d="M20.5 12v2a4 4 0 0 1-4 4h-13"/>`),
  search: svg(`<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.4-4.4"/>`),
  calendar: svg(`<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>`),
  chart: svg(`<path d="M3 20.5h18"/><path d="m5 15 4.5-5 3.5 3.5L20 6"/>`),
  layers: svg(`<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>`),
  alert: svg(`<path d="M10.3 4.3 2.6 17.4a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17.2h.01"/>`),
  book: svg(`<path d="M2.5 4.5A1 1 0 0 1 3.7 3.5c1.9.3 5.4 1.1 7 2.6v14c-1.6-1.5-5.1-2.3-7-2.6a1 1 0 0 1-.7-1V4.5z"/><path d="M21.5 4.5a1 1 0 0 0-1.2-1c-1.9.3-5.4 1.1-7 2.6v14c1.6-1.5 5.1-2.3 7-2.6a1 1 0 0 0 .7-1V4.5z"/>`),
  database: svg(`<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13"/><path d="M20 12c0 1.7-3.6 3-8 3s-8-1.3-8-3"/>`),
  upload: svg(`<path d="M21 15.5v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3"/><path d="m7.5 8 4.5-4.5L16.5 8"/><path d="M12 3.5V15"/>`),
  download: svg(`<path d="M21 15.5v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M12 15V3.5"/>`),
  keyboard: svg(`<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>`),
  inbox: svg(`<path d="M21 12.5h-5l-1.5 3h-5l-1.5-3H3"/><path d="M5.5 5.5h13l2.5 7v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5l2.5-7z"/>`),
  pointer: svg(`<path d="M9 11.5V5a1.75 1.75 0 1 1 3.5 0v5.5"/><path d="M12.5 10.5V9a1.75 1.75 0 0 1 3.5 0v1.5"/><path d="M16 10.5V10a1.75 1.75 0 1 1 3.5 0v6a5.5 5.5 0 0 1-5.5 5.5h-1.6a5.5 5.5 0 0 1-4.4-2.2l-2.6-3.5a1.75 1.75 0 0 1 2.7-2.2L9 14.5"/>`),
  trophy: svg(`<path d="M7.5 4h9v6a4.5 4.5 0 0 1-9 0V4z"/><path d="M7.5 6H5a2 2 0 0 0 2.5 3.5M16.5 6H19a2 2 0 0 1-2.5 3.5"/><path d="M12 14.5V18M9 20.5h6"/>`),
  clock: svg(`<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>`),
  info: svg(`<circle cx="12" cy="12" r="8.5"/><path d="M12 16v-4.5M12 8.2h.01"/>`),

  // Sentence topics
  help: svg(`<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.9.6c0 1.7-2.5 2.3-2.5 2.3v1.2"/><path d="M12 16.6h.01"/>`),
  landmark: svg(`<path d="M3.5 20.5h17"/><path d="M12 3.5 3.5 8h17L12 3.5z"/><path d="M6.5 11v6M10 11v6M14 11v6M17.5 11v6"/>`),
  home: svg(`<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9.6V19a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V9.6"/><path d="M9.7 20.5v-5.6h4.6v5.6"/>`),
  health: svg(`<rect x="3" y="6.5" width="18" height="13.5" rx="2.5"/><path d="M8.5 6.5V5.2A1.7 1.7 0 0 1 10.2 3.5h3.6a1.7 1.7 0 0 1 1.7 1.7v1.3"/><path d="M12 10.6v5.4M9.3 13.3h5.4"/>`),
  phone: svg(`<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.4h3"/>`),
  briefcase: svg(`<rect x="2.5" y="7" width="19" height="13.5" rx="2.5"/><path d="M8.5 7V5.2a1.7 1.7 0 0 1 1.7-1.7h3.6a1.7 1.7 0 0 1 1.7 1.7V7"/><path d="M2.5 12.5h19"/>`),
  train: svg(`<rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 9.5h14M9.3 12.8h.01M14.7 12.8h.01"/><path d="m8.5 16-2.5 5M15.5 16l2.5 5M7 19h10"/>`),
  package: svg(`<path d="m12 2.7 8.5 4.2v10.2L12 21.3 3.5 17.1V6.9L12 2.7z"/><path d="M3.5 6.9 12 11.1l8.5-4.2M12 11.1v10.2"/><path d="m7.75 4.8 8.5 4.2"/>`),
  card: svg(`<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 9.8h19M6.2 14.6h4"/>`),
  chat: svg(`<path d="M8 13.2H5.5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2V7"/><path d="M9.5 7h9a2 2 0 0 1 2 2v6.2a2 2 0 0 1-2 2h-2.2L12.6 20v-2.8H9.5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/>`),
  lifebuoy: svg(`<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.6"/><path d="m5.99 5.99 3.46 3.46M18.01 5.99l-3.46 3.46M5.99 18.01l3.46-3.46M18.01 18.01l-3.46-3.46"/>`),
  cup: svg(`<path d="M4.5 5.5h11v6a5.5 5.5 0 0 1-11 0v-6z"/><path d="M15.5 7.5h1.8a2.7 2.7 0 0 1 0 5.4h-1.8"/><path d="M3.5 20.5h13"/>`),
};

// Topic id → icon. Falls back to a neutral bubble for unmapped topics.
const TOPIC_ICO = {
  understand: 'help',
  everyday: 'cup',
  appointments: 'calendar',
  admin: 'landmark',
  housing: 'home',
  health: 'health',
  phone: 'phone',
  work: 'briefcase',
  transport: 'train',
  services: 'package',
  money: 'card',
  social: 'chat',
  emergency: 'lifebuoy',
};

const topicIcon = id => ICO[TOPIC_ICO[id]] || ICO.sentences;

// ══════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════
function render() {
  updateHeader();
  updateNavBtns();
  const root = document.getElementById('root');
  // Kursplan needs full-width layout without the default max-width constraint
  root.classList.toggle('kursplan-active', V.view === 'kursplan');
  if (V.view === 'today') root.innerHTML = renderToday();
  else if (V.view === 'browse' && V.topicId) root.innerHTML = renderTopic();
  else if (V.view === 'browse') root.innerHTML = renderBrowse();
  else if (V.view === 'practice') root.innerHTML = renderPracticeHub();
  else if (V.view === 'frequency') root.innerHTML = renderFrequency();
  else if (V.view === 'kursplan') root.innerHTML = renderKursplan();
  else if (V.view === 'patterns') root.innerHTML = renderPatterns();
  else if (V.view === 'saved') root.innerHTML = renderSaved();
  else if (V.view === 'progress') root.innerHTML = renderProgress();
  else if (V.view === 'history-day') root.innerHTML = renderHistoryDay();
  root.querySelectorAll('.sc,.pc,.vc').forEach((el, i) => el.style.animationDelay = i * 25 + 'ms');
}

function updateHeader() {
  const showVocab = (V.view === 'today' && V.todayTab === 'vocab') || ['frequency', 'practice', 'progress', 'history-day'].includes(V.view);
  const tot = showVocab ? (typeof FREQUENCY_DICTIONARY === 'undefined' ? 0 : FREQUENCY_DICTIONARY.length) : SENTENCES.length;
  const done = showVocab ? DB.freqLearned.size : DB.learned.size;
  const pct = tot ? Math.round(done / tot * 100) : 0;
  document.getElementById('hpf').style.width = pct + '%';
  document.getElementById('hpl').textContent = `${done} / ${tot} ${showVocab ? 'vocab' : 'sentences'} learned`;
  document.getElementById('stk-n').textContent = DB.streak;
}
function updateNavBtns() {
  ['today', 'practice', 'browse', 'kursplan', 'patterns'].forEach(v => {
    const el = document.getElementById('nb-' + v);
    if (el) el.className = 'nb' + (V.view === v ? ' on' : '');
    const mel = document.getElementById('mnb-' + v);
    if (mel) mel.className = 'mnb' + (V.view === v ? ' on' : '');
  });
  const wordsActive = V.view === 'frequency';
  const wordsBtn = document.getElementById('nb-words');
  if (wordsBtn) wordsBtn.className = 'nb' + (wordsActive ? ' on' : '');
  const mWordsBtn = document.getElementById('mnb-words');
  if (mWordsBtn) mWordsBtn.className = 'mnb' + (wordsActive ? ' on' : '');
  const libBtn = document.getElementById('nb-library');
  if (libBtn) libBtn.className = 'nb' + (V.view === 'saved' ? ' on' : '');
  const mLibBtn = document.getElementById('mnb-library');
  if (mLibBtn) mLibBtn.className = 'mnb' + (V.view === 'saved' ? ' on' : '');
  const progressActive = V.view === 'progress' || V.view === 'history-day';
  const progBtn = document.getElementById('nb-progress');
  if (progBtn) progBtn.className = 'nb' + (progressActive ? ' on' : '');
  const mProgBtn = document.getElementById('mnb-progress');
  if (mProgBtn) mProgBtn.className = 'mnb' + (progressActive ? ' on' : '');
  const dueCount = getFreqReviewIds().length;
  document.querySelectorAll('.nav-due-badge').forEach(el => {
    el.textContent = dueCount > 99 ? '99+' : String(dueCount);
    el.hidden = dueCount === 0;
  });
  const sc = document.getElementById('sb-learned-count');
  const scLbl = document.getElementById('sb-learned-lbl');
  const showVocabStat = (V.view === 'today' && V.todayTab === 'vocab') || ['frequency', 'practice', 'progress', 'history-day'].includes(V.view);
  if (sc) sc.textContent = showVocabStat ? DB.freqLearned.size : DB.learned.size;
  if (scLbl) scLbl.textContent = showVocabStat ? 'vocab learned' : 'sentences learned';
}

// ─── KURSPLAN ─────────────────────────────────
function renderKursplan() {
  return `<div style="display:flex; flex-direction:column; height:calc(100vh - 60px); padding-top:14px;">
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px; flex-shrink:0;">
      <div>
        <h2 class="page-title" style="margin:0">A1 → B1 Kursplan</h2>
        <p class="page-sub" style="margin:4px 0 0 0">48 Units · 600 Unterrichtseinheiten · BAMF Integrationskurs & telc/Goethe Standard</p>
      </div>
      <a href="deutsch-a1-b1-kursplan.html" target="_blank" rel="noopener" class="btn-sec" style="text-decoration:none; display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:8px; font-size:13px; font-weight:600;">
        Open Standalone ↗
      </a>
    </div>
    <div class="kursplan-frame-wrapper" style="flex:1 1 0; min-height:0; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.06); border:1px solid var(--border, #E5E7EB); background:#fff;">
      <iframe src="deutsch-a1-b1-kursplan.html" title="Deutsch A1 bis B1 Kursplan" style="width:100%; height:100%; border:none; display:block;" loading="lazy"></iframe>
    </div>
  </div>`;
}

// ─── TODAY ───────────────────────────────────
function renderTodaySentences() {
  ensureDailyQueue();
  const qs = DB.dailyQueue.map(id => SENTENCES.find(s => s.id === id)).filter(Boolean);
  const queueDone = qs.filter(s => DB.dailyQueueDone.has(s.id) || (DB.srs[s.id] && DB.srs[s.id].lastReview === today())).length;
  const learnedToday = (DB.historyWords[today()] || []).filter(id => DB.learned.has(id)).length;
  const reviewedToday = DB.attempts.filter(a => a.date === today() && a.wasDue && (a.result === 'got' || a.result === 'again')).length;
  const tot = qs.length, pct = tot ? Math.min(100, Math.round(queueDone / tot * 100)) : 0, done = queueDone >= tot && tot > 0;
  const storageWarning = DB.storageError ? `<div class="tip-card storage-warning"><div class="tip-lbl">Storage warning</div><div class="tip-text">${esc(DB.storageError)}</div></div>` : '';

  const gc = `<div class="goal-card">
<div class="goal-top">
  <div><div class="goal-title">Today's practice</div><div class="goal-date">${new Date().toLocaleDateString('en-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
  <div class="goal-top-actions">
    <div class="today-segmented-control" role="tablist" aria-label="Today practice category">
      <button class="today-seg-btn" onclick="setTodayTab('vocab')" role="tab" aria-selected="false" type="button">Vocab</button>
      <button class="today-seg-btn on" onclick="setTodayTab('sentences')" role="tab" aria-selected="true" type="button">Sentences</button>
    </div>
    <button class="goal-btn" onclick="openGoalModal()" type="button">Goal: ${DB.dailyGoal}</button>
  </div>
</div>
<div class="goal-nums">
  <div><div class="gnum-v">${queueDone}</div><div class="gnum-l">Queue done</div></div>
  <div><div class="gnum-v">${Math.max(0, tot - queueDone)}</div><div class="gnum-l">Remaining</div></div>
  <div><div class="gnum-v">${learnedToday}</div><div class="gnum-l">New learned</div></div>
  <div><div class="gnum-v">${reviewedToday}</div><div class="gnum-l">Reviews</div></div>
  <div><div class="gnum-v">${DB.dailyGoal}</div><div class="gnum-l">Daily goal</div></div>
</div>
${done ? `<div class="goal-complete">${ICO.check} Daily goal complete. Review due cards, browse topics, or raise the goal if you want more practice.</div>` : `<div class="goal-bar-bg"><div class="goal-bar-fill" style="width:${pct}%"></div></div>`}
  </div>`;

  return `${storageWarning}${gc}

<div class="section-hdr">
  <h2 class="section-hdr-title">Today's ${tot} sentences</h2>
  <div class="section-hdr-actions">
    <button class="btn btn-primary btn-sm" onclick="startPractice({ids:${idsArg(qs.map(s => s.id))}})" type="button">${ICO.target} Practice</button>
    <button class="btn btn-secondary btn-sm" onclick="refreshQueue()" type="button">${ICO.repeat} New batch</button>
  </div>
</div>

${qs.map((s, i) => renderSentenceCard(s, i, true)).join('')}`;
}

function renderTodayVocab() {
  ensureFreqDailyQueue();
  const dueCount = getFreqReviewIds().length;
  const newEntries = DB.freqDailyQueue.map(id => freqById(id)).filter(Boolean).sort((a, b) => a.rank - b.rank);
  const queueDone = newEntries.filter(entry => DB.freqDailyQueueDone.has(String(entry.rank))).length;
  const reviewedToday = DB.freqAttempts.filter(attempt => attempt.date === today() && attempt.wasDue && attempt.result !== 'skip').length;
  const queuePct = newEntries.length ? Math.min(100, Math.round(queueDone / newEntries.length * 100)) : 0;
  const queueIdsJson = idsArg(newEntries.map(entry => String(entry.rank)));
  const done = queueDone >= newEntries.length && newEntries.length > 0;
  const reviewBanner = dueCount ? `<div class="review-section vocab-review-section">
  <div class="review-section-hdr">
    <div class="review-section-title">${ICO.repeat} ${dueCount} word${dueCount !== 1 ? 's' : ''} due for review</div>
    <button class="review-practice-btn" onclick="nav('practice')" type="button">Go to Practice</button>
  </div>
  <div class="review-section-sub">Reviews are handled in the Practice tab so today's list stays new words only.</div>
</div>` : '';

  return `<div>
<div class="goal-card vocab-goal-card">
  <div class="goal-top">
    <div><div class="goal-title">Today's vocabulary</div><div class="goal-date">${new Date().toLocaleDateString('en-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
    <div class="goal-top-actions">
      <div class="today-segmented-control" role="tablist" aria-label="Today practice category">
        <button class="today-seg-btn on" onclick="setTodayTab('vocab')" role="tab" aria-selected="true" type="button">Vocab</button>
        <button class="today-seg-btn" onclick="setTodayTab('sentences')" role="tab" aria-selected="false" type="button">Sentences</button>
      </div>
      <button class="goal-btn" onclick="openFreqGoalModal()" type="button">Goal: ${DB.freqDailyGoal}</button>
    </div>
  </div>
  <div class="goal-nums">
    <div><div class="gnum-v">${queueDone}</div><div class="gnum-l">New learned</div></div>
    <div><div class="gnum-v">${Math.max(0, newEntries.length - queueDone)}</div><div class="gnum-l">Remaining</div></div>
    <div><div class="gnum-v">${dueCount}</div><div class="gnum-l">Due today</div></div>
    <div><div class="gnum-v">${reviewedToday}</div><div class="gnum-l">Reviews</div></div>
    <div><div class="gnum-v">${DB.freqDailyGoal}</div><div class="gnum-l">Daily goal</div></div>
  </div>
  ${done ? `<div class="goal-complete">${ICO.check} Daily vocabulary goal complete. Review due words or start a new batch when you are ready.</div>` : `<div class="goal-bar-bg"><div class="goal-bar-fill" style="width:${queuePct}%"></div></div>`}
</div>

${reviewBanner}

<div class="section-hdr">
  <h2 class="section-hdr-title">Today's ${newEntries.length} new word${newEntries.length !== 1 ? 's' : ''}</h2>
  <div class="section-hdr-actions">
    ${newEntries.length ? `<button class="btn btn-primary btn-sm" onclick="startFrequencyPractice({ids:${queueIdsJson},mode:'new'})" type="button">${ICO.target} Learn these</button>` : ''}
    <button class="btn btn-secondary btn-sm" onclick="refreshFreqQueue()" type="button">${ICO.repeat} New batch</button>
  </div>
</div>

${newEntries.length ? newEntries.map((entry, i) => renderFreqCard(entry, i)).join('') : `<div class="callout callout-success"><div class="callout-title">${ICO.check} No new words left for today</div><div class="callout-sub">Raise the daily target or head to Practice to review what is due.</div></div>`}
  </div>`;
}

function renderToday() {
  const isVocab = V.todayTab === 'vocab';
  return isVocab ? renderTodayVocab() : renderTodaySentences();
}

// ─── BROWSE ──────────────────────────────────
function renderBrowse() {
  const q = V.query.trim().toLowerCase();
  const searchResults = q
    ? SENTENCES.filter(s => {
      const topic = TOPICS.find(t => t.id === s.t);
      const pattern = findMatchingPattern(s);
      return [s.de, s.en, s.use, s.lv, s.register, topic && topic.name, topic && topic.german, pattern && pattern.template]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q));
    })
    : [];
  const topicCards = TOPICS.map(t => {
    const tot = SENTENCES.filter(s => s.t === t.id).length;
    const done = SENTENCES.filter(s => s.t === t.id && DB.learned.has(s.id)).length;
    const pct = tot ? Math.round(done / tot * 100) : 0;
    return `<button class="topic-card" onclick="nav('browse','${t.id}')" type="button">
  <span class="tc-emoji">${topicIcon(t.id)}</span>
  <div class="tc-name">${esc(t.name)}</div>
  <div class="tc-de">${esc(t.german)}</div>
  <div class="tc-prog"><span class="tc-count">${done}/${tot}</span><div class="tc-bar-bg"><div class="tc-bar-fill" style="width:${pct}%"></div></div></div>
</button>`;
  }).join('');
  return `<div style="padding-top:14px">
	<h2 class="page-title">Sentences</h2>
	<p class="page-sub">${SENTENCES.length} sentences · ${PATTERNS.length} patterns · ${TOPICS.length} topics</p>
	<div class="search-wrap" style="margin:0 0 16px"><span class="search-icon">${ICO.search}</span><input class="search-input" placeholder="Search all phrases, topics, and patterns..." value="${esc(V.query)}" oninput="setQuery(this.value)" type="text"></div>
	${V.query ? `<div class="sec-lbl">Search results (${searchResults.length})</div>${searchResults.length ? searchResults.map((s, i) => renderSentenceCard(s, i, true)).join('') : `<div class="empty-state"><div class="empty-icon">${ICO.search}</div>No phrases match.</div>`}` : ''}
	${V.query ? '<div class="sec-lbl">Topics</div>' : ''}
	<div class="topic-grid">${topicCards}</div>
	  </div>`;
}

// ─── TOPIC ───────────────────────────────────
function renderTopic() {
  const topic = TOPICS.find(t => t.id === V.topicId);
  if (!topic) return renderBrowse();
  let sents = SENTENCES.filter(s => s.t === V.topicId);
  if (V.filter === 'learned') sents = sents.filter(s => DB.learned.has(s.id));
  else if (V.filter === 'unlearned') sents = sents.filter(s => !DB.learned.has(s.id));
  else if (V.filter === 'favorites') sents = sents.filter(s => DB.favorites.has(s.id));
  if (V.query) { const q = V.query.toLowerCase(); sents = sents.filter(s => s.de.toLowerCase().includes(q) || s.en.toLowerCase().includes(q)); }
  const done = SENTENCES.filter(s => s.t === V.topicId && DB.learned.has(s.id)).length;
  const tot = SENTENCES.filter(s => s.t === V.topicId).length;
  const allTopicIds = JSON.stringify(SENTENCES.filter(s => s.t === V.topicId).map(s => s.id)).replace(/"/g, "'");
  const unlearnedTopicIds = JSON.stringify(SENTENCES.filter(s => s.t === V.topicId && !DB.learned.has(s.id)).map(s => s.id)).replace(/"/g, "'");
  const practiceTopicBtn = `<div class="btn-row" style="margin-bottom:16px">
<button class="btn btn-primary" style="flex:1" onclick="startPractice({ids:${allTopicIds}})">${ICO.target} Practice all ${tot}</button>
${SENTENCES.filter(s => s.t === V.topicId && !DB.learned.has(s.id)).length > 0 ? `<button class="btn btn-secondary" style="flex:1" onclick="startPractice({ids:${unlearnedTopicIds}})">Unlearned only (${tot - done})</button>` : ''}
  </div>`;
  const cards = sents.length ? sents.map((s, i) => renderSentenceCard(s, i, false)).join('') : `<div class="empty-state"><div class="empty-icon">${ICO.search}</div>No sentences match.</div>`;
  return `<button class="back-btn" onclick="nav('browse')">← All topics</button>
<div class="topic-hdr">
  <div class="topic-hdr-em">${topicIcon(topic.id)}</div>
  <div><div class="topic-hdr-name">${topic.name}</div><div class="topic-hdr-de">${topic.german}</div>
    <div class="topic-hdr-stats"><span class="topic-stat"><strong>${done}</strong> learned</span><span class="topic-stat"><strong>${tot - done}</strong> remaining</span></div>
  </div>
</div>
<div class="filter-row">
  ${['all', 'unlearned', 'learned', 'favorites'].map(f => `<button class="filter-chip${V.filter === f ? ' on' : ''}" onclick="setFilter('${f}')" aria-pressed="${V.filter === f}" type="button">${f === 'all' ? 'All' : f === 'unlearned' ? 'To learn' : f === 'learned' ? 'Learned' : 'Saved'}</button>`).join('')}
</div>
${practiceTopicBtn}
	<div class="search-wrap"><span class="search-icon">${ICO.search}</span><input class="search-input" placeholder="Search..." value="${esc(V.query)}" oninput="setQuery(this.value)" type="text"></div>

${cards}`;
}

// ─── PRACTICE ────────────────────────────────
const PRACTICE_RATING_DECKS = [
  { key: 'all', title: 'All reviewed', sub: 'Every flashcard you have rated', ids: () => getFreqRatedIds() },
  { key: 'again', title: 'Again', sub: 'Latest rating: Again', ids: () => getFreqRatedIds('again') },
  { key: 'hard', title: 'Hard', sub: 'Latest rating: Hard', ids: () => getFreqRatedIds('hard') },
  { key: 'good', title: 'Good', sub: 'Latest rating: Good', ids: () => getFreqRatedIds('good') },
  { key: 'easy', title: 'Easy', sub: 'Latest rating: Easy', ids: () => getFreqRatedIds('easy') },
];

function renderPracticeDeckCard(title, sub, empty, ids, mode = 'replay', isAttention = false, tone = '') {
  const disabled = ids.length === 0;
  const start = `startFrequencyPractice({ids:${idsArg(ids)},mode:'${mode}'})`;
  return `<button class="deck-card${disabled ? ' is-empty' : ''}${isAttention && ids.length ? ' is-due' : ''}${tone ? ` is-${tone}` : ''}" ${disabled ? 'disabled aria-disabled="true"' : `onclick="${start}"`} type="button">
  <span class="deck-card-count">${ids.length}</span>
  <span class="deck-card-title">${esc(title)}</span>
  <span class="deck-card-sub">${esc(disabled ? empty : sub)}</span>
</button>`;
}

function renderPracticeHub() {
  ensureFreqDailyQueue();
  const dueIds = getFreqReviewIds();
  const newIds = DB.freqDailyQueue.filter(id => !DB.freqDailyQueueDone.has(id));
  const sessionIds = [...dueIds, ...newIds.filter(id => !dueIds.includes(id))];
  const overdue = Object.entries(DB.freqSrs).filter(([id, s]) => DB.freqLearned.has(id) && s.nextReview && s.nextReview < today()).length;
  const replayCards = PRACTICE_RATING_DECKS.map(deck => renderPracticeDeckCard(
    deck.title,
    deck.sub,
    'Rate vocabulary cards to build this replay group.',
    deck.ids(),
    'replay',
    false,
    deck.key,
  )).join('');
  const attentionIds = getFreqLeechIds();
  const unratedLearnedIds = getFreqUnratedLearnedIds();
  const ratingSeedIds = unratedLearnedIds.slice(0, 20);
  const onboarding = ratingSeedIds.length ? `<div class="practice-onboarding">
  <div class="practice-onboarding-copy">
    <div class="practice-onboarding-title">Build your replay groups</div>
    <div class="practice-onboarding-sub">${unratedLearnedIds.length} learned word${unratedLearnedIds.length !== 1 ? 's' : ''} do not have a flashcard rating yet. Rate ${ratingSeedIds.length} now; this will not change their review dates.</div>
  </div>
  <button class="btn btn-secondary practice-onboarding-btn" onclick="startFrequencyPractice({ids:${idsArg(ratingSeedIds)},mode:'replay'})" type="button">Rate ${ratingSeedIds.length} words</button>
</div>` : '';

  const hero = sessionIds.length
    ? `<div class="practice-hero">
  <div class="practice-hero-main">
    <div class="practice-hero-title">${sessionIds.length} card${sessionIds.length !== 1 ? 's' : ''} ready</div>
    <div class="practice-hero-sub">${dueIds.length} due review${dueIds.length !== 1 ? 's' : ''} · ${newIds.length} new word${newIds.length !== 1 ? 's' : ''}${overdue ? ` · ${overdue} overdue` : ''}</div>
  </div>
  <button class="btn btn-primary practice-hero-btn" onclick="startFrequencyPractice({ids:${idsArg(sessionIds)},mode:'scheduled'})" type="button">${ICO.target} Start review</button>
</div>`
    : `<div class="practice-hero practice-hero-complete">
  <div class="practice-hero-status">${ICO.check}</div>
  <div class="practice-hero-main">
    <div class="practice-hero-title">Daily review complete</div>
    <div class="practice-hero-sub">No cards are due today. Your scheduled reviews are saved; an optional replay below will not change them.</div>
  </div>
</div>`;

  return `<div style="padding-top:14px">
<h2 class="page-title">Practice</h2>
<p class="page-sub">German vocabulary flashcards with spaced repetition.</p>

${hero}

${onboarding}

<div class="sec-lbl">Practice again</div>
<div class="deck-grid practice-replay-grid">${replayCards}</div>

${attentionIds.length ? `<div class="sec-lbl">Needs attention</div>
<div class="deck-grid practice-attention-grid">${renderPracticeDeckCard('Hard words', `Forgotten ${LEECH_LAPSES} or more times`, 'No problem words yet.', attentionIds, 'replay', true, 'attention')}</div>` : ''}
  </div>`;
}

function renderLoadMore(shown, total, action) {
  if (total <= shown) return '';
  const remaining = total - shown;
  const next = Math.min(remaining, PAGE_SIZE);
  return `<div class="load-more-wrap">
    <span class="load-more-info">Showing ${shown} of ${total}</span>
    <button class="load-more-btn" onclick="${action}" type="button">Load ${next} more</button>
  </div>`;
}

function loadMoreFreq() { V.freqPage = (V.freqPage || 1) + 1; render(); }

// ══════════════════════════════════════════════
// FREQUENCY DICTIONARY
// ══════════════════════════════════════════════
const POS_EXPANSION = {
  'M': 'der (m)',
  'F': 'die (f)',
  'N': 'das (n)',
  'art': 'article',
  'prn': 'pronoun',
  'vb': 'verb',
  'vb2': 'verb',
  'av': 'auxiliary verb',
  'adj': 'adjective',
  'adv': 'adverb',
  'prp': 'preposition',
  'con': 'conjunction',
  'prt': 'particle',
  'nu': 'numeral',
  'i': 'interjection'
};

function getFreqArticle(entry) {
  if (!entry || !entry.pos) return '';
  const parts = entry.pos.split(/[;,]/).map(p => p.trim());
  if (parts.includes('M')) return 'der';
  if (parts.includes('F')) return 'die';
  if (parts.includes('N')) return 'das';
  return '';
}

function freqDisplay(entry) {
  if (!entry) return '';
  const art = getFreqArticle(entry);
  if (art && entry.german && /^[A-ZÄÖÜ]/.test(entry.german)) {
    return `${art} ${entry.german}`;
  }
  return entry.german;
}

function freqPosLabel(entry) {
  if (!entry || !entry.pos) return '';
  return entry.pos.split(/[;,]/).map(p => p.trim()).filter(Boolean).map(p => POS_EXPANSION[p] || p).join(' · ');
}

function freqSentenceWithHighlight(entry) {
  if (!entry || !entry.germanSentence) return '';
  const word = esc(entry.german).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(^|[^\\p{L}])(${word})(?=[^\\p{L}]|$)`, 'giu');
  return esc(entry.germanSentence).replace(regex, '$1<strong lang="de">$2</strong>');
}

function freqCardsForView() {
  const due = new Set(getFreqReviewIds());
  const q = V.query.trim().toLowerCase();
  const [rangeMin, rangeMax] = V.freqRange === 'all' ? [0, Infinity] : V.freqRange.split('-').map(Number);
  if (typeof FREQUENCY_DICTIONARY === 'undefined') return [];
  const filtered = FREQUENCY_DICTIONARY.filter(entry => {
    const id = String(entry.rank);
    if (V.freqRange !== 'all' && (entry.rank < rangeMin || entry.rank > rangeMax)) return false;
    if (V.freqFilter === 'new' && DB.freqLearned.has(id)) return false;
    if (V.freqFilter === 'due' && !due.has(id)) return false;
    if (V.freqFilter === 'learned' && !DB.freqLearned.has(id)) return false;
    if (V.freqFilter === 'saved' && !DB.freqFavorites.has(id)) return false;
    if (!q) return true;
    const art = getFreqArticle(entry);
    const displayWord = art ? `${art} ${entry.german}` : entry.german;
    return [entry.german, displayWord, art, entry.english, entry.pos, freqPosLabel(entry), entry.germanSentence, entry.englishSentence]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(q));
  });
  return filtered.sort((a, b) => a.rank - b.rank);
}
function renderFrequency() {
  if (!V.freqRange || !VALID_FREQ_RANGES.has(V.freqRange)) V.freqRange = 'all';
  if (!V.freqFilter || !VALID_FREQ_FILTERS.has(V.freqFilter)) V.freqFilter = 'all';
  const dueCount = getFreqReviewIds().length;
  const learned = DB.freqLearned.size;
  const total = typeof FREQUENCY_DICTIONARY === 'undefined' ? 0 : FREQUENCY_DICTIONARY.length;
  const visibleEntries = freqCardsForView();
  const visibleIdsJson = idsArg(visibleEntries.map(e => String(e.rank)));
  const rangeChips = [['all', 'All'], ['1-500', '1–500'], ['501-1000', '501–1000'], ['1001-1500', '1001–1500'], ['1501-2000', '1501–2000'], ['2001-2525', '2001–2525']]
    .map(([r, label]) => `<button class="filter-chip${V.freqRange === r ? ' on' : ''}" onclick="setFreqRange('${r}')" aria-pressed="${V.freqRange === r}" type="button">${esc(label)}</button>`).join('');
  const dueSection = dueCount ? `<div class="review-section vocab-review-section">
  <div class="review-section-hdr">
    <div class="review-section-title">${ICO.repeat} ${dueCount} word${dueCount !== 1 ? 's' : ''} due for review</div>
    <button class="review-practice-btn" onclick="nav('practice')" type="button">Go to Practice</button>
  </div>
  <div class="review-section-sub">Spaced repetition sessions live in the Practice tab.</div>
</div>` : '';
  const cardsTitle = V.query
    ? `Search results (${visibleEntries.length})`
    : V.freqRange === 'all'
    ? `All words (${visibleEntries.length})`
    : `Rank ${esc(V.freqRange)} (${visibleEntries.length})`;

  return `<div style="padding-top:14px">
<h2 class="page-title">Vocabulary</h2>
<p class="page-sub">The ${total.toLocaleString('en-DE')} most common German words, ranked by frequency — ${learned} learned so far.</p>
${dueSection}

<div class="search-wrap" style="margin:12px 0"><span class="search-icon">${ICO.search}</span><input class="search-input" placeholder="Search German word, English meaning, or sentence..." value="${esc(V.query)}" oninput="setQuery(this.value)" type="text"></div>
<div class="filter-row vocab-topic-row">${rangeChips}</div>
<div class="filter-row">
  ${['all', 'new', 'due', 'learned', 'saved'].map(f => `<button class="filter-chip${V.freqFilter === f ? ' on' : ''}" onclick="setFreqFilter('${f}')" aria-pressed="${V.freqFilter === f}" type="button">${f === 'all' ? 'All' : f === 'new' ? 'New' : f === 'due' ? 'Due' : f === 'learned' ? 'Learned' : 'Saved'}</button>`).join('')}
</div>
<div class="freq-browse-hdr">
  <div class="sec-lbl freq-browse-results-lbl">${cardsTitle}</div>
  ${visibleEntries.length ? `<button class="act-btn vocab-visible-practice" onclick="startFrequencyPractice({ids:${visibleIdsJson},mode:'free'})" type="button">${ICO.target} Practice these</button>` : ''}
</div>
${visibleEntries.length ? visibleEntries.slice(0, (V.freqPage || 1) * PAGE_SIZE).map((e, i) => renderFreqCard(e, i)).join('') + renderLoadMore(Math.min(visibleEntries.length, (V.freqPage || 1) * PAGE_SIZE), visibleEntries.length, 'loadMoreFreq()') : `<div class="empty-state"><div class="empty-icon">${ICO.search}</div>No words match.</div>`}
  </div>`;
}
function renderFreqCard(entry, i) {
  const id = String(entry.rank);
  const learned = DB.freqLearned.has(id);
  const saved = DB.freqFavorites.has(id);
  const nextLabel = freqSrsNextLabel(id);
  const srsLvl = getFreqSrsLevel(id);
  const srsDots = learned ? `<span class="srs-dots" title="${esc(nextLabel)}">${SRS_INTERVALS.map((_, dot) => `<span class="srs-dot${dot < srsLvl ? ' filled' : ''}"></span>`).join('')}</span>${nextLabel ? `<span class="srs-next">${esc(nextLabel)}</span>` : ''}` : '';
  return `<div class="vc freq-card${learned ? ' lrn' : ''}${saved ? ' fav' : ''}" id="fc-${id}">
<div class="sc-top">
  <span class="topic-label">Rank #${entry.rank}</span>
  <span class="lvl-tag">${esc(freqPosLabel(entry))}</span>
  ${learned ? `<span class="lrn-badge">${ICO.check} Learned</span>${srsDots}` : ''}
</div>
<button class="vocab-term reveal-btn" onclick="toggleFreqReveal('${id}')" aria-expanded="false" type="button" lang="de">${esc(freqDisplay(entry))}</button>
<div class="freq-sentence" lang="de">${freqSentenceWithHighlight(entry)}</div>
<button class="vocab-en hid reveal-btn" id="fen-${id}" onclick="toggleFreqWordMeaning('${id}')" aria-hidden="true" hidden type="button" title="Click sentence to toggle word meaning">
  <span class="freq-en-sentence">${esc(entry.englishSentence)}</span>
  <span class="freq-en-word hid" id="few-${id}" aria-hidden="true" hidden><span style="font-weight:400;font-size:12px;color:var(--text-3);display:block;margin-top:4px">Word meaning:</span>${esc(entry.english)}</span>
</button>
<div class="card-actions">
  <button class="act-btn speak-btn" data-id="freq-${id}" onclick="speak(${jsArg(entry.germanSentence || entry.german)},'freq-${id}')" type="button">
    ${ICO.speak} Listen
  </button>
  <button class="act-btn${learned ? ' is-learned' : ''}" id="flrn-btn-${id}" onclick="toggleFreqLearnedUi('${id}')" type="button">
    ${ICO.check} ${learned ? 'Learned' : 'Mark learned'}
  </button>
  <button class="act-btn${saved ? ' is-fav' : ''}" id="ffav-btn-${id}" onclick="toggleFreqFavUi('${id}')" type="button">
    ${ICO.star} ${saved ? 'Saved' : 'Save'}
  </button>
</div>
  </div>`;
}
function toggleFreqReveal(id) {
  const en = document.getElementById('fen-' + id);
  const card = document.getElementById('fc-' + id);
  if (!en) return;
  if (en.classList.contains('hid')) {
    en.hidden = false;
    en.setAttribute('aria-hidden', 'false');
    en.classList.remove('hid');
    if (card) card.querySelectorAll('.reveal-btn').forEach(btn => btn.setAttribute('aria-expanded', 'true'));
  } else {
    const wordMeaning = document.getElementById('few-' + id);
    en.classList.add('hid');
    en.hidden = true;
    en.setAttribute('aria-hidden', 'true');
    if (wordMeaning) {
      wordMeaning.hidden = true;
      wordMeaning.setAttribute('aria-hidden', 'true');
      wordMeaning.classList.add('hid');
    }
    if (card) card.querySelectorAll('.reveal-btn').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
  }
}
function toggleFreqWordMeaning(id) {
  const wordMeaning = document.getElementById('few-' + id);
  const englishSentence = document.getElementById('fen-' + id);
  if (!wordMeaning || !englishSentence || englishSentence.classList.contains('hid')) return;
  if (wordMeaning.classList.contains('hid')) {
    wordMeaning.hidden = false;
    wordMeaning.setAttribute('aria-hidden', 'false');
    wordMeaning.classList.remove('hid');
    englishSentence.setAttribute('aria-expanded', 'true');
  } else {
    wordMeaning.hidden = true;
    wordMeaning.setAttribute('aria-hidden', 'true');
    wordMeaning.classList.add('hid');
    englishSentence.setAttribute('aria-expanded', 'false');
  }
}
function syncFreqCardState(id) {
  const card = document.getElementById('fc-' + id);
  if (!card) return;
  const learned = DB.freqLearned.has(id);
  const saved = DB.freqFavorites.has(id);
  card.classList.toggle('lrn', learned);
  card.classList.toggle('fav', saved);

  const learnedBtn = document.getElementById('flrn-btn-' + id);
  if (learnedBtn) {
    learnedBtn.classList.toggle('is-learned', learned);
    learnedBtn.innerHTML = `${ICO.check} ${learned ? 'Learned' : 'Mark learned'}`;
  }
  const savedBtn = document.getElementById('ffav-btn-' + id);
  if (savedBtn) {
    savedBtn.classList.toggle('is-fav', saved);
    savedBtn.innerHTML = `${ICO.star} ${saved ? 'Saved' : 'Save'}`;
  }

  const top = card.querySelector('.sc-top');
  if (!top) return;
  top.querySelectorAll('.lrn-badge, .srs-dots, .srs-next').forEach(element => element.remove());
  if (learned) {
    const nextLabel = freqSrsNextLabel(id);
    const level = getFreqSrsLevel(id);
    top.insertAdjacentHTML('beforeend', `<span class="lrn-badge">${ICO.check} Learned</span><span class="srs-dots" title="${esc(nextLabel)}">${SRS_INTERVALS.map((_, dot) => `<span class="srs-dot${dot < level ? ' filled' : ''}"></span>`).join('')}</span>${nextLabel ? `<span class="srs-next">${esc(nextLabel)}</span>` : ''}`);
  }
}
function toggleFreqLearnedUi(id) {
  toggleFreqLearned(id);
  syncFreqCardState(id);
  updateHeader();
}
function toggleFreqFavUi(id) {
  toggleFreqFav(id);
  syncFreqCardState(id);
  updateHeader();
}
function setFreqFilter(filter) {
  V.freqFilter = VALID_FREQ_FILTERS.has(filter) ? filter : 'all';
  V.freqPage = 1;
  commitState();
}
function setFreqRange(range) {
  V.freqRange = VALID_FREQ_RANGES.has(range) ? range : 'all';
  V.freqPage = 1;
  commitState();
}
function setFreqGoal(n) {
  DB.freqDailyGoal = clampNumber(n, 1, 60, DEFAULT_FREQ_DAILY_GOAL);
  DB.freqDailyQueue = [];
  DB.freqDailyQueueDate = null;
  save();
  document.querySelectorAll('.goal-opt').forEach(el => {
    const selected = parseInt(el.textContent, 10) === DB.freqDailyGoal;
    el.classList.toggle('sel', selected);
    el.setAttribute('aria-pressed', String(selected));
  });
}
function refreshFreqQueue() {
  DB.freqDailyQueue = [];
  ensureFreqDailyQueue();
  render();
}

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SENTENCE_VOCAB_GLOSSARY = [
  { de: 'Könnten Sie', en: 'could you (formal)', note: 'polite request' },
  { de: 'Können Sie', en: 'can you (formal)', note: 'polite request' },
  { de: 'Können wir', en: 'can we' },
  { de: 'Kann ich', en: 'can I' },
  { de: 'Haben Sie', en: 'do you have', note: 'formal question' },
  { de: 'Darf ich', en: 'may I' },
  { de: 'Muss ich', en: 'do I have to' },
  { de: 'Möchten Sie', en: 'would you like', note: 'formal' },
  { de: 'Möchtest du', en: 'would you like', note: 'informal' },
  { de: 'Ich möchte', en: 'I would like to' },
  { de: 'Ich würde gern', en: 'I would like to', note: 'polite form' },
  { de: 'Ich brauche', en: 'I need' },
  { de: 'Ich habe', en: 'I have' },
  { de: 'Ich bin', en: 'I am' },
  { de: 'Ich kann', en: 'I can / I am able to' },
  { de: 'Ich komme', en: 'I am coming / I will arrive' },
  { de: 'Ich suche', en: 'I am looking for' },
  { de: 'Soll ich', en: 'should I' },
  { de: 'Ich rufe wegen', en: 'I am calling about' },
  { de: 'Ich schicke', en: 'I will send' },
  { de: 'Ich melde mich', en: 'I will get back to you' },
  { de: 'Mir ist schwindelig', en: 'I feel dizzy', note: 'fixed phrase' },
  { de: 'Mir fehlen', en: 'I am missing / I still need', note: 'useful phrase' },
  { de: 'Es gibt', en: 'there is / there are' },
  { de: 'Gibt es', en: 'is there / are there' },
  { de: 'Bis wann', en: 'by when', note: 'deadline question' },
  { de: 'Wie oft', en: 'how often' },
  { de: 'Wie lange', en: 'how long' },
  { de: 'Wie hoch', en: 'how high / how much' },
  { de: 'Welche', en: 'which' },
  { de: 'Auf welchem', en: 'on which' },
  { de: 'Auf welchen Namen', en: 'under which name' },
  { de: 'Wer ist', en: 'who is' },
  { de: 'Wo ist', en: 'where is' },
  { de: 'Wo sind', en: 'where are' },
  { de: 'Wo stehen', en: 'where are standing / located' },
  { de: 'Wo fährt', en: 'where does it leave' },
  { de: 'Wo muss ich', en: 'where do I have to' },
  { de: 'Was bedeutet', en: 'what does it mean' },
  { de: 'Meinen Sie', en: 'do you mean' },
  { de: 'Nehmen Sie', en: 'do you accept / take', note: 'formal question' },
  { de: 'Passt Ihnen', en: 'does it work for you', note: 'formal' },
  { de: 'Passt dir', en: 'does it work for you', note: 'informal' },
  { de: 'Sagen Sie mir bitte Bescheid', en: 'please let me know', note: 'formal' },
  { de: 'Sag mir Bescheid', en: 'let me know', note: 'informal' },
  { de: 'noch einmal', en: 'one more time' },
  { de: 'sagen', en: 'to say', note: 'verb' },
  { de: 'langsamer sprechen', en: 'to speak more slowly' },
  { de: 'verstanden', en: 'understood' },
  { de: 'Wort', en: 'word' },
  { de: 'Abkürzung', en: 'abbreviation' },
  { de: 'aufschreiben', en: 'to write down', note: 'verb' },
  { de: 'Beispiel', en: 'example' },
  { de: 'geben', en: 'to give', note: 'verb' },
  { de: 'einfacher', en: 'simpler / easier' },
  { de: 'Deutsch', en: 'German' },
  { de: 'zeigen', en: 'to show', note: 'verb' },
  { de: 'steht', en: 'is written / stands', note: 'verb' },
  { de: 'schicken', en: 'to send', note: 'verb' },
  { de: 'Termin', en: 'appointment' },
  { de: 'vereinbaren', en: 'to arrange / make', note: 'verb' },
  { de: 'buchen', en: 'to book', note: 'verb' },
  { de: 'verschieben', en: 'to move / reschedule', note: 'verb' },
  { de: 'absagen', en: 'to cancel', note: 'verb' },
  { de: 'bestätigen', en: 'to confirm', note: 'verb' },
  { de: 'anmelden', en: 'to register', note: 'verb' },
  { de: 'Anmeldung', en: 'registration' },
  { de: 'Warteliste', en: 'waiting list' },
  { de: 'Bestätigung', en: 'confirmation' },
  { de: 'Unterlagen', en: 'documents / paperwork' },
  { de: 'mitbringen', en: 'to bring along', note: 'verb' },
  { de: 'fehlen', en: 'to be missing', note: 'verb' },
  { de: 'Antrag', en: 'application / request form' },
  { de: 'einreichen', en: 'to submit', note: 'verb' },
  { de: 'geschickt', en: 'sent' },
  { de: 'schriftlich', en: 'in writing' },
  { de: 'Bescheinigung', en: 'certificate / official confirmation' },
  { de: 'Formular', en: 'form' },
  { de: 'Adresse', en: 'address' },
  { de: 'Telefonnummer', en: 'phone number' },
  { de: 'heiße', en: 'am called / my name is', note: 'verb' },
  { de: 'Namen', en: 'name' },
  { de: 'buchstabieren', en: 'to spell', note: 'verb' },
  { de: 'ändern', en: 'to change', note: 'verb' },
  { de: 'Kopie', en: 'copy' },
  { de: 'erhalten', en: 'to receive', note: 'verb' },
  { de: 'bekommen', en: 'to get / receive', note: 'verb' },
  { de: 'Steuer-ID', en: 'tax ID' },
  { de: 'Ausweis', en: 'ID document' },
  { de: 'dabei', en: 'with me / on me' },
  { de: 'falsch geschrieben', en: 'spelled / written incorrectly' },
  { de: 'Fehler', en: 'error' },
  { de: 'korrigieren', en: 'to correct', note: 'verb' },
  { de: 'Schreiben', en: 'official letter / notice' },
  { de: 'erklären', en: 'to explain', note: 'verb' },
  { de: 'worum es geht', en: 'what it is about' },
  { de: 'nächsten Schritte', en: 'next steps' },
  { de: 'Wohnung', en: 'apartment' },
  { de: 'Heizung', en: 'heating' },
  { de: 'Internet', en: 'internet' },
  { de: 'Rechnung', en: 'bill / invoice' },
  { de: 'Reparatur', en: 'repair' },
  { de: 'vorbeikommen', en: 'to come by', note: 'verb' },
  { de: 'Hausmeister', en: 'caretaker' },
  { de: 'informieren', en: 'to inform', note: 'verb' },
  { de: 'ausgesperrt', en: 'locked out' },
  { de: 'Schlüsseldienst', en: 'locksmith' },
  { de: 'Schlüssel', en: 'key' },
  { de: 'steckt', en: 'is stuck / is inserted', note: 'verb' },
  { de: 'von innen', en: 'from the inside' },
  { de: 'Schimmel', en: 'mold' },
  { de: 'Bad', en: 'bathroom' },
  { de: 'entdeckt', en: 'discovered' },
  { de: 'ansehen', en: 'to look at', note: 'verb' },
  { de: 'Nachbarn', en: 'neighbors' },
  { de: 'laut', en: 'loud' },
  { de: 'leiser', en: 'quieter' },
  { de: 'Müll', en: 'trash / rubbish' },
  { de: 'abgeholt', en: 'picked up / collected' },
  { de: 'Mülltonnen', en: 'trash bins' },
  { de: 'Warmmiete', en: 'rent including utilities' },
  { de: 'Vermieter', en: 'landlord' },
  { de: 'Dokument', en: 'document' },
  { de: 'Vertrag', en: 'contract' },
  { de: 'prüfen', en: 'to check / review', note: 'verb' },
  { de: 'beenden', en: 'to end', note: 'verb' },
  { de: 'Geld zurück', en: 'money back / refund' },
  { de: 'dringend', en: 'urgent / urgently' },
  { de: 'Kopfschmerzen', en: 'headache' },
  { de: 'Fieber', en: 'fever' },
  { de: 'Bauchschmerzen', en: 'stomach pain' },
  { de: 'gesetzlich versichert', en: 'publicly insured' },
  { de: 'krankschreiben', en: 'to issue a sick note', note: 'verb' },
  { de: 'Rezept', en: 'prescription' },
  { de: 'ausstellen', en: 'to issue', note: 'verb' },
  { de: 'nehmen', en: 'to take', note: 'verb' },
  { de: 'vor oder nach dem Essen', en: 'before or after eating' },
  { de: 'Nebenwirkungen', en: 'side effects' },
  { de: 'täglich', en: 'daily' },
  { de: 'Medikamente', en: 'medication' },
  { de: 'allergisch', en: 'allergic' },
  { de: 'verletzt', en: 'injured' },
  { de: 'Überweisung', en: 'referral' },
  { de: 'Facharzt', en: 'specialist doctor' },
  { de: 'Apotheke', en: 'pharmacy' },
  { de: 'geöffnet', en: 'open' },
  { de: 'Medikament', en: 'medicine' },
  { de: 'bestellen', en: 'to order', note: 'verb' },
  { de: 'Gesundheitskarte', en: 'health insurance card' },
  { de: 'vergessen', en: 'forgotten', note: 'verb' },
  { de: 'neue Patienten', en: 'new patients' },
  { de: 'Verbindung', en: 'connection' },
  { de: 'WLAN', en: 'Wi-Fi' },
  { de: 'funktioniert nicht', en: 'is not working' },
  { de: 'schlecht', en: 'bad / poor' },
  { de: 'zurückrufen', en: 'to call back', note: 'verb' },
  { de: 'später', en: 'later' },
  { de: 'einloggen', en: 'to log in', note: 'verb' },
  { de: 'Passwort', en: 'password' },
  { de: 'zurücksetzen', en: 'to reset', note: 'verb' },
  { de: 'telefonieren', en: 'to talk on the phone', note: 'verb' },
  { de: 'Kundennummer', en: 'customer number' },
  { de: 'nennen', en: 'to give / state', note: 'verb' },
  { de: 'Code', en: 'code' },
  { de: 'App', en: 'app' },
  { de: 'krankgeschrieben', en: 'on sick leave' },
  { de: 'Aufgabe', en: 'task' },
  { de: 'fertig', en: 'finished' },
  { de: 'Datei', en: 'file' },
  { de: 'Bescheid', en: 'notice / update' },
  { de: 'zuständig', en: 'responsible' },
  { de: 'Meeting', en: 'meeting' },
  { de: 'Feedback', en: 'feedback' },
  { de: 'Gehaltsabrechnung', en: 'payslip' },
  { de: 'Urlaubstage', en: 'vacation days' },
  { de: 'Bahn', en: 'train / tram' },
  { de: 'Hauptbahnhof', en: 'main station' },
  { de: 'Bus', en: 'bus' },
  { de: 'Bürgerbüro', en: 'citizen services office' },
  { de: 'umsteigen', en: 'to transfer', note: 'verb' },
  { de: 'Gleis', en: 'platform / track' },
  { de: 'fährt ab', en: 'departs', note: 'verb' },
  { de: 'fällt aus', en: 'is cancelled', note: 'verb' },
  { de: 'Verspätung', en: 'delay' },
  { de: 'stattdessen', en: 'instead' },
  { de: 'Ticket', en: 'ticket' },
  { de: 'gültig', en: 'valid' },
  { de: 'entwerten', en: 'to validate a ticket', note: 'verb' },
  { de: 'gekauft', en: 'bought' },
  { de: 'zurückgeben', en: 'to return', note: 'verb' },
  { de: 'Ersatzbus', en: 'replacement bus' },
  { de: 'dauert', en: 'takes / lasts', note: 'verb' },
  { de: 'Fahrt', en: 'journey / ride' },
  { de: 'falsche Richtung', en: 'wrong direction' },
  { de: 'Aufzug', en: 'lift / elevator' },
  { de: 'Taxi', en: 'taxi' },
  { de: 'Deutschlandticket', en: 'Germany public transport pass' },
  { de: 'zurückbekommen', en: 'to get back', note: 'verb' },
  { de: 'Paket', en: 'parcel' },
  { de: 'abholen', en: 'to pick up', note: 'verb' },
  { de: 'Benachrichtigung', en: 'notification' },
  { de: 'Sendung', en: 'shipment / parcel' },
  { de: 'Filiale', en: 'branch / shop' },
  { de: 'Packstation', en: 'parcel locker' },
  { de: 'Retourenpaket', en: 'return parcel' },
  { de: 'abgeben', en: 'to drop off / hand in', note: 'verb' },
  { de: 'Rücksendeetikett', en: 'return label' },
  { de: 'Artikel', en: 'item' },
  { de: 'kaputt', en: 'broken' },
  { de: 'angekommen', en: 'arrived' },
  { de: 'umtauschen', en: 'to exchange', note: 'verb' },
  { de: 'Größe', en: 'size' },
  { de: 'ähnlich', en: 'similar' },
  { de: 'günstiger', en: 'cheaper' },
  { de: 'mit Karte zahlen', en: 'pay by card' },
  { de: 'Quittung', en: 'receipt' },
  { de: 'Lieferung', en: 'delivery' },
  { de: 'Abholcode', en: 'pickup code' },
  { de: 'Konto', en: 'account' },
  { de: 'eröffnen', en: 'to open', note: 'verb' },
  { de: 'überweisen', en: 'to transfer money', note: 'verb' },
  { de: 'Betrag', en: 'amount' },
  { de: 'Lastschrift', en: 'direct debit' },
  { de: 'Zahlung', en: 'payment' },
  { de: 'stoppen', en: 'to stop', note: 'verb' },
  { de: 'Karte', en: 'card' },
  { de: 'sperren', en: 'to block / freeze', note: 'verb' },
  { de: 'bezahlt', en: 'paid' },
  { de: 'Mahnung', en: 'payment reminder' },
  { de: 'Schaden melden', en: 'to report a claim / damage' },
  { de: 'Nachbarschaft', en: 'neighborhood' },
  { de: 'vorstellen', en: 'to introduce oneself', note: 'verb' },
  { de: 'Kaffee trinken', en: 'to have coffee' },
  { de: 'morgen Abend', en: 'tomorrow evening' },
  { de: 'anderes Mal', en: 'another time' },
  { de: 'annehmen', en: 'to accept / receive', note: 'verb' },
  { de: 'Hilfe', en: 'help' },
  { de: 'Unfall', en: 'accident' },
  { de: 'Handy', en: 'mobile phone' },
  { de: 'weg', en: 'gone / missing' },
  { de: 'unwohl', en: 'unwell' },
  { de: 'Notaufnahme', en: 'emergency department' },
  { de: 'sofort', en: 'immediately' },
  { de: 'Arzt', en: 'doctor' },
  { de: 'sicher', en: 'safe' },
  { de: 'brennt', en: 'is burning / there is a fire' },
  { de: 'noch', en: 'still / yet' },
  { de: 'heute', en: 'today' },
  { de: 'morgen', en: 'tomorrow' },
  { de: 'diese Woche', en: 'this week' },
  { de: 'ungefähr', en: 'approximately' },
  { de: 'zehn Minuten', en: 'ten minutes' },
  { de: 'per E-Mail', en: 'by email' },
  { de: 'online', en: 'online' },
  { de: 'bitte', en: 'please' }
];

function hasGermanTerm(text, term) {
  const escaped = String(term).normalize('NFC')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, 'iu').test(String(text || '').normalize('NFC'));
}

function revealVocabItems(s) {
  const items = [];
  const add = (de, en, note = '') => {
    const key = String(de || '').normalize('NFC').toLowerCase();
    if (!de || items.some(item => item.key === key)) return;
    items.push({ key, de, en, note });
  };
  (s.vocab || []).forEach(item => add(item.de, item.en, item.note));
  (s.chunks || []).forEach(chunk => add(chunk[0], chunk[1]));
  SENTENCE_VOCAB_GLOSSARY.forEach(item => {
    if (hasGermanTerm(s.de, item.de)) add(item.de, item.en, item.note);
  });
  return items.slice(0, 6);
}
function renderRevealDetails(s, compact = false, idPrefix = 'rd-') {
  const learn = s.learn;
  if (!learn) return '';
  const vocab = revealVocabItems(s);
  const variants = Array.isArray(learn.variants) ? learn.variants : [];
  const vocabHtml = vocab.length ? `<div class="reveal-box"><div class="reveal-box-title">Sentence vocab</div>${vocab.map(item => `<div class="vocab-row"><strong lang="de">${esc(item.de)}</strong><span>${esc(item.en)}${item.note ? ` · ${esc(item.note)}` : ''}</span></div>`).join('')}</div>` : '';
  const variantsHtml = variants.length ? `<div class="reveal-box"><div class="reveal-box-title">Formal / informal</div>${variants.map(v => `<div class="vocab-row"><strong>${esc(v.label)}</strong><span lang="de">${esc(v.de)}</span></div>`).join('')}</div>` : '';
  const style = compact ? '' : ' style="display:none"';
  return `<div class="reveal-details${compact ? ' compact' : ''}" id="${idPrefix}${s.id}"${style}>
<div class="reveal-grid">
  ${vocabHtml}
  ${variantsHtml}
</div>
  </div>`;
}

function renderVariantPreview(s) {
  const variants = s.learn && Array.isArray(s.learn.variants) ? s.learn.variants : [];
  if (!variants.length) return '';
  return `<div class="variant-preview" id="vp-${s.id}">
<div class="variant-preview-title">Formal / informal</div>
${variants.map(v => `<div class="variant-preview-row">
  <span class="variant-preview-label">${esc(v.label)}</span>
  <span class="variant-preview-de">${esc(v.de)}</span>
</div>`).join('')}
  </div>`;
}

// ─── SENTENCE CARD ───────────────────────────
function renderSentenceCard(s, i, showTopic) {
  const lrn = DB.learned.has(s.id), fav = DB.favorites.has(s.id);
  const topic = TOPICS.find(t => t.id === s.t);
  const gram = grammarTag(s.de);
  const srsLvl = getSrsLevel(s.id);
  const nextLabel = srsNextLabel(s.id);
  const srsDots = lrn ? `<span class="srs-dots" title="${esc(nextLabel)}">${SRS_INTERVALS.map((_, i) => `<span class="srs-dot${i < srsLvl ? ' filled' : ''}"></span>`).join('')}</span>${nextLabel ? `<span class="srs-next">${esc(nextLabel)}</span>` : ''}` : '';
  const matchedPattern = findMatchingPattern(s);
  const patTag = matchedPattern ? `<span class="pattern-tag" title="This sentence uses a pattern">${ICO.patterns} ${matchedPattern.template.replace(/\[.*?\]/g, '...').substring(0, 25)}</span>` : '';
  const variantTag = s.learn && s.learn.variants && s.learn.variants.length ? `<span class="pattern-tag" title="Includes formal and informal versions">Sie / du</span>` : '';
  const recognitionTag = isRecognitionSentence(s) ? `<span class="pattern-tag" title="Recognize this phrase and know how to respond">Recognition</span>` : '';
  return `<div class="sc${lrn ? ' lrn' : ''}${fav ? ' fav' : ''}" id="sc-${s.id}">
<div class="sc-top">
  ${showTopic && topic ? `<span class="topic-label">${esc(topic.name)}</span>` : ''}
  <span class="lvl-tag l${s.lv}">${s.lv}</span>
  ${gram ? `<span class="gram-tag">${esc(gram.t)}</span>` : ''}
  ${patTag}
  ${variantTag}
  ${recognitionTag}
  ${lrn ? `<span class="lrn-badge">${ICO.check} Learned</span>${srsDots}` : ''}
</div>
<button class="sentence-de reveal-btn" onclick="toggleReveal('${s.id}')" aria-expanded="false" type="button" lang="de">${esc(s.de)}</button>
<div class="sentence-ph"><span class="ph-lbl">${ICO.speak}</span>${esc(s.ph)}</div>
<div class="reveal-hint" id="hn-${s.id}" onclick="toggleReveal('${s.id}')" style="cursor:pointer">Tap to reveal translation</div>
<button class="sentence-en hid reveal-btn" id="en-${s.id}" onclick="toggleReveal('${s.id}')" aria-hidden="true" hidden type="button">${esc(s.en)}</button>
${renderRevealDetails(s)}
<div class="card-actions">
  <button class="act-btn${V.speaking === s.id ? ' is-playing' : ''} speak-btn" data-id="${s.id}" onclick="speak(${jsArg(s.de)},'${s.id}')" type="button">
    ${ICO.speak} ${V.speaking === s.id ? `<span class="pulse">Playing...</span>` : 'Listen'}
  </button>
  <button class="act-btn${lrn ? ' is-learned' : ''}" id="lrn-btn-${s.id}" onclick="toggleLearned('${s.id}')">
    ${ICO.check} ${lrn ? 'Learned' : 'Mark done'}
  </button>
  <button class="act-btn${fav ? ' is-fav' : ''}" id="fav-btn-${s.id}" onclick="toggleFav('${s.id}')">
    ${ICO.star} ${fav ? 'Saved' : 'Save'}
  </button>
</div>
  </div>`;
}

// ─── PATTERNS ────────────────────────────────
function activePatterns() {
  return PATTERNS
    .filter(p => p.status !== 'hidden')
    .slice()
    .sort((a, b) => (a.priority || 999) - (b.priority || 999) || a.template.localeCompare(b.template));
}
function patternsForFilter(filter, duePatternIds = getPatternReviewIds()) {
  const due = new Set(duePatternIds);
  const all = activePatterns();
  if (filter === 'understood') return all.filter(p => DB.understood.has(p.id));
  if (filter === 'due') return all.filter(p => due.has(p.id));
  if (filter === 'all') return all;
  return all.filter(p => !DB.understood.has(p.id) || due.has(p.id));
}
function renderPatterns() {
  const duePatternIds = getPatternReviewIds();
  const pats = patternsForFilter(normalizePatternFilter(V.patFilter), duePatternIds);
  const active = activePatterns();
  const undCount = active.filter(p => DB.understood.has(p.id)).length;
  const learningCount = active.filter(p => !DB.understood.has(p.id) || duePatternIds.includes(p.id)).length;
  const understoodCount = active.filter(p => DB.understood.has(p.id)).length;
  const duePatternSection = duePatternIds.length ? `<div class="review-section pattern-review-section">
    <div class="review-section-hdr">
      <div class="review-section-title">${ICO.repeat} Due pattern review <span class="review-count-badge">${duePatternIds.length}</span></div>
      <button class="review-practice-btn" onclick="startPatternPractice({ids:${idsArg(duePatternIds)}})">Practice now</button>
    </div>
    <div class="review-section-sub">Patterns ready for spaced review.</div>
  </div>` : '';
  const cards = pats.length ? pats.map((p, i) => renderPatternCard(p, i)).join('') : `<div class="empty-state"><div class="empty-icon">${ICO.search}</div>No patterns match.</div>`;
  const visibleIds = JSON.stringify(pats.map(p => p.id)).replace(/"/g, "'");
  const learningIds = JSON.stringify(active.filter(p => !DB.understood.has(p.id) || duePatternIds.includes(p.id)).map(p => p.id)).replace(/"/g, "'");
  const understoodIds = JSON.stringify(active.filter(p => DB.understood.has(p.id)).map(p => p.id)).replace(/"/g, "'");
  return `<div style="padding-top:14px">
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
  <h2 class="page-title" style="margin-top:0">Sentence patterns</h2>
  <span style="font-size:13px;font-weight:500;color:var(--text-2)">${undCount} of ${active.length} understood</span>
</div>
<p class="page-sub">Master these ${active.length} A1/A2 patterns and reuse them in real situations</p>
${duePatternSection}

<div class="btn-row">
  ${pats.length > 0 ? `<button class="btn btn-primary" onclick="startPatternPractice({ids:${visibleIds}})" type="button">Practice visible (${pats.length})</button>` : ''}
  ${learningCount > 0 ? `<button class="btn btn-secondary" onclick="startPatternPractice({ids:${learningIds}})" type="button">Learning (${learningCount})</button>` : ''}
  ${understoodCount > 0 ? `<button class="btn btn-secondary" onclick="startPatternPractice({ids:${understoodIds}})" type="button">Understood (${understoodCount})</button>` : ''}
</div>

<div class="filter-row">
  <button class="filter-chip${V.patFilter === 'learning' ? ' on' : ''}" onclick="setPatFilter('learning')" aria-pressed="${V.patFilter === 'learning'}" type="button">Learning</button>
  <button class="filter-chip${V.patFilter === 'due' ? ' on' : ''}" onclick="setPatFilter('due')" aria-pressed="${V.patFilter === 'due'}" type="button">Due</button>
  <button class="filter-chip${V.patFilter === 'understood' ? ' on' : ''}" onclick="setPatFilter('understood')" aria-pressed="${V.patFilter === 'understood'}" type="button">Understood</button>
  <button class="filter-chip${V.patFilter === 'all' ? ' on' : ''}" onclick="setPatFilter('all')" aria-pressed="${V.patFilter === 'all'}" type="button">All</button>
</div>

${cards}
  </div>`;
}

function setPatFilter(f) { V.patFilter = normalizePatternFilter(f); commitState(); }

const PATTERN_INFORMAL_EXAMPLES = {
  polite_request_modal: { de: 'Könntest du bitte langsamer sprechen?', en: 'Could you please speak more slowly?' },
  ask_write_down: { de: 'Kannst du das bitte aufschreiben?', en: 'Can you write that down, please?' },
  ask_explain_again: { de: 'Kannst du das kurz erklären?', en: 'Can you briefly explain that?' },
  ask_availability: { de: 'Hast du diese Woche Zeit?', en: 'Do you have time this week?' },
  works_for_you: { de: 'Passt dir Dienstagvormittag?', en: 'Does Tuesday morning work for you?' },
  call_about: { de: 'Ich rufe wegen deiner Nachricht an.', en: 'I am calling about your message.' },
  written_confirmation: { de: 'Kannst du mir das schriftlich bestätigen?', en: 'Can you confirm that in writing for me?' },
  would_possible: { de: 'Könnte ich später kommen?', en: 'Could I come later?' },
  send_followup: { de: 'Ich schicke dir später den Link.', en: 'I will send you the link later.' },
  plan_invite: { de: 'Hättest du Lust, einen Kaffee zu trinken?', en: 'Would you like to have a coffee?' },
  let_know: { de: 'Sag mir Bescheid, wenn du da bist.', en: 'Let me know when you are there.' },
};

function informalPatternExample(pattern) {
  if (PATTERN_INFORMAL_EXAMPLES[pattern.id]) return PATTERN_INFORMAL_EXAMPLES[pattern.id];
  return (pattern.examples || []).find(e => /\b(du|dir|dich|dein|deine|deiner|deinem|deinen)\b/i.test(e.de)) || null;
}

function renderPatternCard(p, i) {
  const und = DB.understood.has(p.id);
  const cat = PAT_CATS.find(c => c.id === p.cat);
  const tpl = p.template.replace(/\[([^\]]+)\]/g, '<span class="pat-blank">[$1]</span>');
  const informal = informalPatternExample(p);
  return `<div class="pc${und ? ' und' : ''}" id="pc-${p.id}">
${cat ? `<span class="pat-cat-tag">${esc(cat.label)}</span>` : ''}
<div class="pat-template" lang="de">${tpl}</div>
<div class="pat-meaning">${p.meaning}</div>
<div class="pat-examples">${p.examples.map((e, ei) => `<div class="pat-ex"><div class="pat-de" lang="de"><button class="pat-ex-speak" onclick="event.stopPropagation();speak(${jsArg(e.de)},'pex-${p.id}-${ei}')" aria-label="Listen" title="Listen" type="button">${ICO.speak}</button> ${esc(e.de)}</div><div class="pat-en">${esc(e.en)}</div></div>`).join('')}</div>
${informal ? `<div class="pat-informal">
  <div class="pat-informal-label">Informal example</div>
  <div class="pat-informal-de" lang="de"><button class="pat-ex-speak" onclick="event.stopPropagation();speak(${jsArg(informal.de)},'pinf-${p.id}')" aria-label="Listen" title="Listen" type="button">${ICO.speak}</button> ${esc(informal.de)}</div>
  <div class="pat-informal-en">${esc(informal.en)}</div>
</div>` : ''}
<div class="pat-actions">
  <button class="act-btn${und ? ' is-learned' : ''}" onclick="toggleUnderstood('${p.id}')">
    ${ICO.check} ${und ? 'Understood' : 'Mark understood'}
  </button>
  <button class="act-btn speak-btn" data-id="p${p.id}" onclick="speak(${jsArg(p.examples[0].de)},'p${p.id}')" type="button">
    ${ICO.speak} Listen
  </button>
</div>
  </div>`;
}

// ─── SAVED / LIBRARY ─────────────────────────
function setLibTab(tab) { V.libTab = VALID_LIBRARY_TABS.has(tab) ? tab : 'learned'; commitState(); }
function setLibType(type) { V.libType = VALID_LIBRARY_TYPES.has(type) ? type : 'vocab'; commitState(); }

function renderSaved() {
  const favSents = SENTENCES.filter(s => DB.favorites.has(s.id));
  const learnedSents = SENTENCES.filter(s => DB.learned.has(s.id));
  const favFreq = [...DB.freqFavorites].map(id => freqById(id)).filter(Boolean).sort((a, b) => a.rank - b.rank);
  const learnedFreq = [...DB.freqLearned].map(id => freqById(id)).filter(Boolean).sort((a, b) => a.rank - b.rank);
  const showSentences = V.libType === 'sentences';
  const savedCount = showSentences ? favSents.length : favFreq.length;
  const learnedCount = showSentences ? learnedSents.length : learnedFreq.length;
  const tabs = `<div class="lib-tabs" role="tablist">
    <button class="lib-tab${V.libTab === 'learned' ? ' on' : ''}" onclick="setLibTab('learned')" type="button">Learned <span class="lib-tab-count">${learnedCount}</span></button>
    <button class="lib-tab${V.libTab === 'saved' ? ' on' : ''}" onclick="setLibTab('saved')" type="button">Saved <span class="lib-tab-count">${savedCount}</span></button>
  </div>`;
  const typeToggle = `<div class="lib-type-toggle" role="tablist" aria-label="Library item type">
    <button class="lib-type-btn${showSentences ? '' : ' on'}" onclick="setLibType('vocab')" role="tab" aria-selected="${!showSentences}" type="button">Vocab</button>
    <button class="lib-type-btn${showSentences ? ' on' : ''}" onclick="setLibType('sentences')" role="tab" aria-selected="${showSentences}" type="button">Sentences</button>
  </div>`;

  // SRS due-for-review section
  const reviewIds = getSrsReviewIds();
  const reviewSents = reviewIds.map(id => SENTENCES.find(s => s.id === id)).filter(Boolean);
  const sentenceReviewSection = reviewSents.length ? (() => {
    const ids = JSON.stringify(reviewSents.map(s => s.id)).replace(/"/g, "'");
    return `<div class="review-section">
  <div class="review-section-hdr">
    <div class="review-section-title">${ICO.repeat} Due for review <span class="review-count-badge">${reviewSents.length}</span></div>
    <button class="review-practice-btn" onclick="startPractice({ids:${ids},isSRS:true})">Practice now</button>
  </div>
  <div class="review-section-sub">These sentences are scheduled for review today — spaced repetition in action.</div>
</div>`;
  })() : '';
  const reviewFreqIds = getFreqReviewIds();
  const reviewFreq = reviewFreqIds.map(id => freqById(id)).filter(Boolean);
  const frequencyReviewSection = reviewFreq.length ? `<div class="review-section">
  <div class="review-section-hdr">
    <div class="review-section-title">${ICO.repeat} Due for review <span class="review-count-badge">${reviewFreq.length}</span></div>
    <button class="review-practice-btn" onclick="startFrequencyPractice({ids:${idsArg(reviewFreqIds)},mode:'due'})" type="button">Practice now</button>
  </div>
  <div class="review-section-sub">These vocabulary cards are scheduled for review today.</div>
</div>` : '';
  const reviewSection = showSentences ? sentenceReviewSection : frequencyReviewSection;

  if (V.libTab === 'learned') return renderLearnedTab(tabs, typeToggle, showSentences ? learnedSents : [], showSentences ? [] : learnedFreq, showSentences);
  if (!savedCount) return `<div style="padding-top:14px"><h2 class="page-title">Library</h2>${tabs}${typeToggle}${reviewSection}<div class="empty-state" style="padding-top:40px"><div class="empty-icon">${ICO.starOutline}</div>No saved ${showSentences ? 'sentences' : 'vocabulary'} yet.<br><span style="font-size:13px">Tap Save on any ${showSentences ? 'sentence' : 'vocabulary'} card.</span></div></div>`;
  const favIds = JSON.stringify(favSents.map(s => s.id)).replace(/"/g, "'");
  const favFreqIds = idsArg(favFreq.map(entry => String(entry.rank)));
  const sentenceSection = favSents.length ? `<div class="learned-cta">
  <div class="learned-cta-info">
    <div class="learned-cta-title">${favSents.length} saved sentence${favSents.length !== 1 ? 's' : ''}</div>
    <div class="learned-cta-sub">Practice your saved sentences</div>
  </div>
  <button class="learned-practice-btn" onclick="startPractice({ids:${favIds}})">Practice all</button>
</div>
${favSents.map((s, i) => renderSentenceCard(s, i, true)).join('')}` : '';
  const frequencySection = favFreq.length ? `<div class="learned-cta">
  <div class="learned-cta-info">
    <div class="learned-cta-title">${favFreq.length} saved frequency word${favFreq.length !== 1 ? 's' : ''}</div>
    <div class="learned-cta-sub">Practice your saved vocabulary</div>
  </div>
  <button class="learned-practice-btn" onclick="startFrequencyPractice({ids:${favFreqIds},mode:'saved'})" type="button">Practice all</button>
</div>
${favFreq.map((entry, i) => renderFreqCard(entry, i)).join('')}` : '';
  return `<div style="padding-top:14px"><h2 class="page-title">Library</h2>${tabs}${typeToggle}${reviewSection}
${showSentences ? sentenceSection : frequencySection}</div>`;
}

function renderLearnedTab(tabs, typeToggle, learnedSents, learnedFreq, showSentences) {
  if (!learnedSents.length && !learnedFreq.length) return `<div style="padding-top:14px"><h2 class="page-title">Library</h2>${tabs}${typeToggle}<div class="empty-state" style="padding-top:40px"><div class="empty-icon">${ICO.book}</div>No learned items yet.<br><span style="font-size:13px">Mark a sentence or vocabulary card learned to track it here.</span></div></div>`;

  // SRS due sentences (filtered to the currently selected library type)
  const dueIds = showSentences ? getSrsReviewIds() : [];
  const dueSents = dueIds.map(id => SENTENCES.find(s => s.id === id)).filter(Boolean);
  const dueFreqIds = showSentences ? [] : getFreqReviewIds();
  const dueFreq = dueFreqIds.map(id => freqById(id)).filter(Boolean).sort((a, b) => a.rank - b.rank);

  // Sentences reviewed today (practiced via SRS today, now scheduled for future)
  const td = todayISO();
  const reviewedTodaySents = showSentences ? learnedSents.filter(s => {
    const srs = DB.srs[s.id];
    return srs && srs.lastReview === td && !dueIds.includes(s.id);
  }) : [];

  const dueIdsJson = JSON.stringify(dueSents.map(s => s.id)).replace(/"/g, "'");
  const dueFreqIdsJson = idsArg(dueFreqIds);

  // Due for practice section banner
  const sentenceDueSection = dueSents.length ? `
    <div class="review-section">
      <div class="review-section-hdr">
        <div class="review-section-title">${ICO.repeat} Due for review <span class="review-count-badge">${dueSents.length}</span></div>
        <button class="review-practice-btn" onclick="startPractice({ids:${dueIdsJson},isSRS:true})">Practice due</button>
      </div>
      <div class="review-section-sub">These sentences are scheduled for review today — spaced repetition in action.</div>
    </div>
  ` : '';
  const frequencyDueSection = dueFreq.length ? `
    <div class="review-section">
      <div class="review-section-hdr">
        <div class="review-section-title">${ICO.repeat} Due frequency review <span class="review-count-badge">${dueFreq.length}</span></div>
        <button class="review-practice-btn" onclick="startFrequencyPractice({ids:${dueFreqIdsJson},mode:'due'})" type="button">Practice due</button>
      </div>
      <div class="review-section-sub">These vocabulary cards are scheduled for review today.</div>
    </div>
  ` : '';
  const dueSection = sentenceDueSection || frequencyDueSection ? `${sentenceDueSection}${frequencyDueSection}` : '';

  // Reviewed today section
  const reviewedSection = reviewedTodaySents.length ? `
    <div class="sec-lbl">Reviewed today (${reviewedTodaySents.length})</div>
    ${reviewedTodaySents.map((s, i) => renderSentenceCard(s, i, true)).join('')}
  ` : '';

  // All learned section
  const allSentenceSection = learnedSents.length ? `
    <div class="sec-lbl">All learned (${learnedSents.length})</div>
    ${learnedSents.map((s, i) => renderSentenceCard(s, i, true)).join('')}
  ` : '';
  const learnedFreqIds = idsArg(learnedFreq.map(entry => String(entry.rank)));
  const allFrequencySection = learnedFreq.length ? `
    <div class="learned-cta">
      <div class="learned-cta-info">
        <div class="learned-cta-title">${learnedFreq.length} learned frequency word${learnedFreq.length !== 1 ? 's' : ''}</div>
        <div class="learned-cta-sub">Review your learned vocabulary</div>
      </div>
      <button class="learned-practice-btn" onclick="startFrequencyPractice({ids:${learnedFreqIds},mode:'free'})" type="button">Practice all</button>
    </div>
    ${learnedFreq.map((entry, i) => renderFreqCard(entry, i)).join('')}
  ` : '';

  return `<div style="padding-top:14px">
<h2 class="page-title">Library</h2>
${tabs}
${typeToggle}
${dueSection}
${reviewedSection}
${allSentenceSection}
${allFrequencySection}
  </div>`;
}

// ─── STATS ───────────────────────────────────
function pct(got, total) { return total ? Math.round(got / total * 100) : 0; }
function aggregateAttempts(attempts, keyFn) {
  const map = {};
  attempts.forEach(a => {
    const key = keyFn(a);
    if (!key) return;
    if (!map[key]) map[key] = { got: 0, again: 0, skip: 0, total: 0 };
    if (a.result === 'got' || a.result === 'manual') map[key].got++;
    else if (a.result === 'again') map[key].again++;
    else if (a.result === 'skip') map[key].skip++;
    if (a.result !== 'skip') map[key].total++;
  });
  return map;
}
function reviewForecast(srsMap, days = 7) {
  return Array.from({ length: days }, (_, i) => {
    const key = addDaysISO(i);
    const count = Object.values(srsMap).filter(s => s.nextReview === key).length;
    return { key, count, label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : parseDateKey(key).toLocaleDateString('en-DE', { weekday: 'short' }) };
  });
}
function setProgressType(type) {
  V.progressType = type === 'sentences' ? 'sentences' : 'vocab';
  commitState();
}

function renderProgressDashboard() {
  const studiedDates = new Set([...DB.attempts, ...DB.patternAttempts, ...DB.freqAttempts].filter(a => a.result !== 'skip').map(a => a.date));
  Object.keys(DB.historyWords).forEach(k => studiedDates.add(k));
  const days = getHistoryDays(30);

  // ── helpers ──────────────────────────────────
  function forecastChart(srsMap) {
    const fc = reviewForecast(srsMap, 7);
    const maxF = Math.max(...fc.map(r => r.count), 1);
    return `<div class="forecast-row">${fc.map(r => `<div class="forecast-day"><div class="forecast-count">${r.count}</div><div class="forecast-bar"><span class="${r.count ? '' : 'zero'}" style="height:${Math.max(8, Math.round(r.count / maxF * 100))}%"></span></div><div class="forecast-label">${r.label}</div></div>`).join('')}</div>`;
  }
  function sectionCard(title, badge, bodyHtml, subtitle) {
    const badgeHtml = badge ? `<span class="progress-section-badge${badge.cls ? ' ' + badge.cls : ''}">${badge.text}</span>` : '';
    const subHtml = subtitle ? `<span class="progress-section-sub">${subtitle}</span>` : '';
    return `<div class="progress-section">
  <div class="progress-section-hdr">
    <div class="progress-section-title">${title}${subHtml}</div>${badgeHtml}
  </div>
  <div class="progress-section-body">${bodyHtml}</div>
</div>`;
  }

  // ── Data ──────────────────────────────────────
  const vocabTotal = FREQUENCY_DICTIONARY_SIZE;
  const vocabDone = DB.freqLearned.size;
  const vocabCompletion = pct(vocabDone, vocabTotal);
  const vocabDue = getFreqReviewIds().length;
  const vocabMastered = Object.entries(DB.freqSrs).filter(([id, s]) => DB.freqLearned.has(id) && s.level >= 5).length;
  const leechIds = getFreqLeechIds();
  const streak = DB.streak;
  const activeDaysTotal = studiedDates.size;

  // Retention rate (all-time vocab)
  const vocabAttempts = DB.freqAttempts.filter(a => a.result !== 'skip');
  const totalGot = vocabAttempts.filter(a => a.result === 'good' || a.result === 'easy').length;
  const totalAgain = vocabAttempts.filter(a => a.result === 'again' || a.result === 'hard').length;
  const retention = totalGot + totalAgain ? pct(totalGot, totalGot + totalAgain) : 0;

  // ── 1. Smart Hero Banner ─────────────────────
  const heroHtml = `
<div class="dash-hero">
  <div class="dash-hero-card">
    <div class="dash-hero-icon" style="color:var(--accent)">${ICO.vocab}</div>
    <div class="dash-hero-num">${vocabDone}</div>
    <div class="dash-hero-lbl">Words Learned</div>
    <div class="dash-hero-sub">${vocabCompletion}% of ${vocabTotal}</div>
    <div class="dash-hero-bar"><div class="dash-hero-bar-fill" style="width:${vocabCompletion}%"></div></div>
  </div>
  <div class="dash-hero-card">
    <div class="dash-hero-icon" style="color:var(--amber)">${ICO.flame}</div>
    <div class="dash-hero-num">${streak}</div>
    <div class="dash-hero-lbl">Day Streak</div>
    <div class="dash-hero-sub">${activeDaysTotal} active days total</div>
  </div>
  <div class="dash-hero-card">
    <div class="dash-hero-icon" style="color:${retention >= 80 ? 'var(--green)' : retention >= 60 ? 'var(--amber)' : 'var(--red)'}">${ICO.target}</div>
    <div class="dash-hero-num ${retention >= 80 ? 'accent-green' : retention >= 60 ? 'accent-amber' : 'accent-red'}">${retention}%</div>
    <div class="dash-hero-lbl">Retention Rate</div>
    <div class="dash-hero-sub">${totalGot + totalAgain} total reviews</div>
  </div>
  <div class="dash-hero-card${vocabDue > 0 ? ' has-due' : ''}">
    <div class="dash-hero-icon" style="color:${vocabDue > 0 ? 'var(--red)' : 'var(--green)'}">${vocabDue > 0 ? ICO.calendar : ICO.check}</div>
    <div class="dash-hero-num${vocabDue > 0 ? ' accent-red' : ''}">${vocabDue}</div>
    <div class="dash-hero-lbl">Due for Review</div>
    <div class="dash-hero-sub">${vocabMastered} mastered</div>
    ${vocabDue > 0 ? `<button class="dash-hero-action" onclick="startFrequencyPractice({ids:${idsArg(getFreqReviewIds())},mode:'due'})" type="button">Review now →</button>` : ''}
  </div>
</div>`;

  // ── 2. Practice Velocity Chart (14 days) ──────
  const velocityDays = days.slice(0, 14).reverse(); // oldest first, last 14 days
  const velData = velocityDays.map(d => {
    const newWords = d.vocabLearnedCount || 0;
    const reps = d.frequencyPracticeCount || 0;
    const total = reps + newWords;
    return { label: d.shortLabel, total, reps, newWords, key: d.key };
  });
  const maxReps = Math.max(...velData.map(v => v.total), 1);
  const velChartW = 600, velChartH = 120;
  const velBarW = Math.max(16, (velChartW / velData.length) * 0.55);
  const velGap = (velChartW - velBarW * velData.length) / (velData.length + 1);

  const velBars = velData.map((d, i) => {
    const x = velGap + i * (velBarW + velGap);
    if (d.total === 0) {
      return `<rect x="${x}" y="${velChartH - 4}" width="${velBarW}" height="4" rx="2" fill="var(--border-strong)" opacity="0.35"/>
        <text x="${x + velBarW / 2}" y="${velChartH + 14}" text-anchor="middle" fill="var(--text-3)" font-size="9" font-weight="500">${d.label}</text>`;
    }
    const h = Math.max(6, (d.total / maxReps) * (velChartH - 22));
    const y = velChartH - h;
    return `<rect x="${x}" y="${y}" width="${velBarW}" height="${h}" rx="3" fill="var(--accent)" opacity="0.8"/>
      <text x="${x + velBarW / 2}" y="${y - 5}" text-anchor="middle" fill="var(--accent)" font-size="10" font-weight="700">${d.total}</text>
      <text x="${x + velBarW / 2}" y="${velChartH + 14}" text-anchor="middle" fill="var(--text-3)" font-size="9" font-weight="500">${d.label}</text>`;
  }).join('');

  const totalReps14 = velData.reduce((s, v) => s + v.reps, 0);
  const totalNew14 = velData.reduce((s, v) => s + v.newWords, 0);
  const activePracticeDays14 = velData.filter(v => v.total > 0).length;

  const velocityChartHtml = `<div class="svg-chart-wrap">
  <svg class="svg-chart" viewBox="0 0 ${velChartW} ${velChartH + 20}" preserveAspectRatio="none">
    ${velBars}
  </svg>
  <div class="svg-chart-footer">
    <span><strong>${totalReps14}</strong> reviews · <strong>${totalNew14}</strong> new words</span>
    <span><strong>${activePracticeDays14}</strong> active days</span>
  </div>
</div>`;

  // ── 3. Retention Trend Chart (14 days) ───────
  const retentionDays = days.slice(0, 14).reverse(); // oldest first, last 14 days
  const retData = retentionDays.map(d => {
    const dayAttempts = d.frequencyAttempts ? d.frequencyAttempts.filter(a => a.result !== 'skip') : [];
    const dayGot = dayAttempts.filter(a => a.result === 'good' || a.result === 'easy').length;
    const dayFail = dayAttempts.filter(a => a.result === 'again' || a.result === 'hard').length;
    const total = dayGot + dayFail;
    return { label: d.shortLabel, pct: total ? pct(dayGot, total) : -1, total, key: d.key };
  });
  const retChartH = 120, retChartW = 600;
  const retBarW = Math.max(16, (retChartW / retData.length) * 0.55);
  const retGap = (retChartW - retBarW * retData.length) / (retData.length + 1);

  const retBars = retData.map((d, i) => {
    const x = retGap + i * (retBarW + retGap);
    if (d.pct < 0) {
      return `<rect x="${x}" y="${retChartH - 4}" width="${retBarW}" height="4" rx="2" fill="var(--border-strong)" opacity="0.4"/>
        <text x="${x + retBarW / 2}" y="${retChartH + 14}" text-anchor="middle" fill="var(--text-3)" font-size="9" font-weight="500">${d.label}</text>`;
    }
    const h = Math.max(6, (d.pct / 100) * (retChartH - 20));
    const y = retChartH - h;
    const color = d.pct >= 80 ? 'var(--green)' : d.pct >= 60 ? 'var(--amber)' : 'var(--red)';
    return `<rect x="${x}" y="${y}" width="${retBarW}" height="${h}" rx="3" fill="${color}" opacity="0.75"/>
      <text x="${x + retBarW / 2}" y="${y - 5}" text-anchor="middle" fill="${color}" font-size="10" font-weight="700">${d.pct}%</text>
      <text x="${x + retBarW / 2}" y="${retChartH + 14}" text-anchor="middle" fill="var(--text-3)" font-size="9" font-weight="500">${d.label}</text>`;
  }).join('');

  // Target line at 80%
  const targetY = retChartH - (80 / 100) * (retChartH - 20);
  const retTargetLine = `<line x1="0" y1="${targetY}" x2="${retChartW}" y2="${targetY}" stroke="var(--accent)" stroke-width="1" stroke-dasharray="6,4" opacity="0.5"/>
    <text x="${retChartW - 4}" y="${targetY - 4}" text-anchor="end" fill="var(--accent)" font-size="9" font-weight="600" opacity="0.7">80% target</text>`;

  const retentionChartHtml = `<div class="svg-chart-wrap">
  <svg class="svg-chart" viewBox="0 0 ${retChartW} ${retChartH + 20}" preserveAspectRatio="none">
    ${retTargetLine}
    ${retBars}
  </svg>
  <div class="svg-chart-footer">
    <span>Overall: <strong class="${retention >= 80 ? 'c-green' : retention >= 60 ? 'c-amber' : 'c-red'}">${retention}%</strong> retention</span>
    <span><span class="ret-legend-dot good"></span>≥80% <span class="ret-legend-dot ok"></span>60-79% <span class="ret-legend-dot bad"></span>&lt;60%</span>
  </div>
</div>`;

  // ── 4. Activity Heatmap (30 days) ────────────
  const maxActivity = Math.max(...days.map(d => d.activityCount), 1);
  const heatChrono = [...days].reverse();
  const heatCells = heatChrono.map(d => {
    const level = d.activityCount === 0 ? 0 : Math.max(1, Math.min(4, Math.ceil(d.activityCount / maxActivity * 4)));
    const detail = d.activityCount ? `${d.vocabLearnedCount} new · ${d.frequencyPracticeCount} reps` : 'No activity';
    return `<button class="history-heat-cell level-${level}${d.isToday ? ' today' : ''}" onclick="navHistoryDay('${d.key}')" title="${esc(d.fullDateStr)}: ${esc(detail)}" type="button">${d.date.getDate()}</button>`;
  }).join('');
  const heatmapHtml = `<div class="history-heatmap">${heatCells}</div>
<div class="heatmap-legend">
  <span>Less</span>
  <span class="heatmap-legend-cell level-0"></span>
  <span class="heatmap-legend-cell level-1"></span>
  <span class="heatmap-legend-cell level-2"></span>
  <span class="heatmap-legend-cell level-3"></span>
  <span class="heatmap-legend-cell level-4"></span>
  <span>More</span>
</div>`;

  // ── 5. Leech / Hard Words ────────────────────
  const leechHtml = leechIds.length ? `<div class="attention-list">${leechIds.slice(0, 8).map(id => {
    const e = freqById(id); if (!e) return '';
    const lapses = (DB.freqSrs[id] || {}).lapses || 0;
    return `<div class="attention-item"><div><span class="attention-word" lang="de">${esc(e.german)}</span><span class="attention-sub">${esc(e.english)}</span></div><div style="display:flex;gap:8px;align-items:center"><span class="attention-badge">${ICO.alert} ${lapses}× forgotten</span><button class="attention-btn" onclick="startFrequencyPractice({ids:['${id}'],mode:'free'})" type="button">Practice</button></div></div>`;
  }).join('')}</div>` : `<div class="progress-empty"><div class="progress-empty-icon">${ICO.check}</div>No problem words yet. Keep it up!</div>`;

  // ── Assemble ─────────────────────────────────
  return `<div class="progress-dashboard">
${heroHtml}
${sectionCard('Practice Velocity', { text: `${totalReps14} reviews` }, velocityChartHtml, 'Last 14 days')}
${sectionCard('Retention Trend', retention ? { text: `${retention}% overall`, cls: retention >= 80 ? '' : retention >= 60 ? 'warn' : 'danger' } : null, retentionChartHtml, 'Last 14 days')}
${sectionCard('Activity Map', { text: 'last 30 days' }, heatmapHtml, 'Click any day for details')}
${sectionCard('Review Forecast', null, forecastChart(DB.freqSrs), 'Next 7 days')}
${sectionCard('Needs Attention', leechIds.length ? { text: `${leechIds.length} hard word${leechIds.length !== 1 ? 's' : ''}`, cls: 'warn' } : null, leechHtml)}
<div class="progress-section">
  <div class="progress-section-hdr"><div class="progress-section-title">Data & Backup</div></div>
  <div class="progress-section-body"><div class="progress-data-actions">
    <button class="btn btn-secondary" onclick="exportData()" type="button">${ICO.upload} Export backup</button>
    <button class="btn btn-secondary" onclick="importData()" type="button">${ICO.download} Import backup</button>
  </div></div>
</div>
</div>`;
}


// ══════════════════════════════════════════════
// ACTIONS
// ══════════════════════════════════════════════
function toggleReveal(id) {
  const en = document.getElementById('en-' + id), hn = document.getElementById('hn-' + id), rd = document.getElementById('rd-' + id), card = document.getElementById('sc-' + id);
  if (!en) return;
  if (en.classList.contains('hid')) {
    en.hidden = false;
    en.setAttribute('aria-hidden', 'false');
    en.classList.remove('hid');
    if (hn) hn.style.display = 'none';
    if (rd) rd.style.display = 'block';
    if (card) card.querySelectorAll('.reveal-btn').forEach(btn => btn.setAttribute('aria-expanded', 'true'));
  } else {
    en.classList.add('hid');
    en.hidden = true;
    en.setAttribute('aria-hidden', 'true');
    if (hn) hn.style.display = 'block';
    if (rd) rd.style.display = 'none';
    if (card) card.querySelectorAll('.reveal-btn').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
  }
}

function toggleLearned(id) {
  const was = DB.learned.has(id);
  if (was) {
    unmarkSentenceLearned(id);
  }
  else {
    markSentenceLearned(id, 'manual');
  }
  const card = document.getElementById('sc-' + id);
  if (card) {
    card.classList.toggle('lrn', DB.learned.has(id));
    const btn = document.getElementById('lrn-btn-' + id);
    if (btn) { btn.className = DB.learned.has(id) ? 'act-btn is-learned' : 'act-btn'; btn.innerHTML = ICO.check + (DB.learned.has(id) ? ' Learned' : ' Mark done'); }
    const badge = card.querySelector('.lrn-badge');
    if (DB.learned.has(id) && !badge) { const top = card.querySelector('.sc-top'); if (top) { const s = document.createElement('span'); s.className = 'lrn-badge'; s.innerHTML = ICO.check + ' Learned'; top.appendChild(s); } }
    else if (!DB.learned.has(id) && badge) badge.remove();
  }
  updateHeader();
}

function toggleFav(id) {
  DB.favorites.has(id) ? DB.favorites.delete(id) : DB.favorites.add(id); save();
  const card = document.getElementById('sc-' + id);
  if (card) {
    card.classList.toggle('fav', DB.favorites.has(id));
    const btn = document.getElementById('fav-btn-' + id);
    if (btn) { btn.className = DB.favorites.has(id) ? 'act-btn is-fav' : 'act-btn'; btn.innerHTML = ICO.star + (DB.favorites.has(id) ? ' Saved' : ' Save'); }
  }
}

function toggleUnderstood(id) {
  if (DB.understood.has(id)) {
    DB.understood.delete(id);
    delete DB.patternSrs[id];
  } else {
    DB.understood.add(id);
    if (!DB.patternSrs[id]) DB.patternSrs[id] = initialSrsState();
    recordPatternAttempt({ id, result: 'got', intervalBefore: 0, intervalAfter: DB.patternSrs[id].interval, wasDue: false });
    recordStudy();
  }
  save();
  const card = document.getElementById('pc-' + id);
  if (card) {
    card.classList.toggle('und', DB.understood.has(id));
    const btn = card.querySelector('.act-btn');
    if (btn) { btn.className = DB.understood.has(id) ? 'act-btn is-learned' : 'act-btn'; btn.innerHTML = ICO.check + (DB.understood.has(id) ? ' Understood' : ' Mark understood'); }
  }
}

function setFilter(f) { V.filter = VALID_FILTERS.has(f) ? f : 'all'; commitState(); }
function setQuery(q) {
  V.query = q;
  V.freqPage = 1;
  clearTimeout(window._qt);
  window._qt = setTimeout(() => {
    const activeEl = document.activeElement;
    const isSearchInput = activeEl && activeEl.classList && activeEl.classList.contains('search-input');
    const selStart = isSearchInput ? activeEl.selectionStart : null;
    const selEnd = isSearchInput ? activeEl.selectionEnd : null;
    render();
    if (isSearchInput) {
      const input = document.querySelector('.search-input');
      if (input) {
        input.focus();
        if (selStart !== null && selEnd !== null) {
          try { input.setSelectionRange(selStart, selEnd); } catch (_) {}
        }
      }
    }
  }, 300);
}
function refreshQueue() { DB.dailyQueueDate = null; save(); nav('today'); }

// ─── TTS ─────────────────────────────────────
// ── TTS Engine ──────────────────────────────────────────────────────────────
// Strategy:
//   Use external German TTS on desktop by default, falling back to browser
//   Web Speech when remote audio is unavailable. Mobile stays on Web Speech.

const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
// Brave exposes navigator.brave (an object with .isBrave())
const isBrave = !!(navigator.brave);

let _ttsAudio = null;
let _bestVoice = null;
let _voicesLoaded = false;
let _ttsRunId = 0;

// Pick the best available German voice
function pickBestGermanVoice() {
  if (!window.speechSynthesis) return null;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;

  const deVoices = voices.filter(v => v.lang.startsWith('de'));
  if (!deVoices.length) return null;

  const priority = [
    v => /google/i.test(v.name) && /deutsch|german|de/i.test(v.name),
    v => /microsoft.*katja|microsoft.*hedda|microsoft.*stefan/i.test(v.name),
    v => /microsoft/i.test(v.name) && deVoices.includes(v),
    v => /neural|natural|premium|enhanced/i.test(v.name) && deVoices.includes(v),
    v => /anna|german|deutsch/i.test(v.name) && deVoices.includes(v),
    v => deVoices.includes(v),
  ];

  for (const test of priority) {
    const match = deVoices.find(test);
    if (match) return match;
  }
  return deVoices[0];
}

// Pre-load voices; also retry on voiceschanged (Chrome fires it async)
function _initVoices() {
  const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  _bestVoice = pickBestGermanVoice();
  _voicesLoaded = voices.length > 0;
}
if (window.speechSynthesis) {
  speechSynthesis.onvoiceschanged = _initVoices;
  _initVoices(); // synchronous browsers (Firefox, some mobile)
}

// External TTS API cascade. Local file mode keeps the direct browser behavior,
// while deployed HTTPS pages use the same-origin Vercel proxy first.
const TTS_AUDIO_START_TIMEOUT_MS = 3500;
const WEB_SPEECH_VOICE_WAIT_MS = 450;
const TTS_LOCAL_ENGINES = [
  (text) => `https://api.streamelements.com/kappa/v2/speech?voice=de-DE-Wavenet-C&text=${encodeURIComponent(text)}`,
  (text) => `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=de&client=gtx`,
];
const TTS_HOSTED_ENGINES = [
  (text) => `/api/tts?text=${encodeURIComponent(text)}`,
];

function isLocalFilePage() {
  return !window.location || window.location.protocol === 'file:';
}

function ttsEnginesForCurrentPage() {
  return isLocalFilePage() ? TTS_LOCAL_ENGINES : TTS_HOSTED_ENGINES;
}

function waitForGermanVoice(callback) {
  if (!window.speechSynthesis) { callback(); return; }
  _bestVoice = pickBestGermanVoice();
  if (_bestVoice || _voicesLoaded) { callback(); return; }

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (speechSynthesis.removeEventListener) speechSynthesis.removeEventListener('voiceschanged', finish);
    _bestVoice = pickBestGermanVoice();
    _voicesLoaded = true;
    callback();
  };
  const timer = setTimeout(finish, WEB_SPEECH_VOICE_WAIT_MS);
  if (speechSynthesis.addEventListener) {
    speechSynthesis.addEventListener('voiceschanged', finish, { once: true });
  } else {
    const previous = speechSynthesis.onvoiceschanged;
    speechSynthesis.onvoiceschanged = () => {
      if (typeof previous === 'function') previous();
      finish();
    };
  }
}

function speak(text, id) {
  // Toggle off if same sentence is already playing
  if (V.speaking === id) {
    _ttsRunId++;
    if (_ttsAudio) { _ttsAudio.pause(); _ttsAudio = null; }
    else if (window.speechSynthesis) speechSynthesis.cancel();
    V.speaking = null; updateSpeakBtns(); return;
  }

  // Cancel whatever is playing
  const runId = ++_ttsRunId;
  if (_ttsAudio) { _ttsAudio.pause(); _ttsAudio = null; }
  if (window.speechSynthesis) speechSynthesis.cancel();
  V.speaking = id; updateSpeakBtns();

  let finished = false;
  const done = () => {
    if (finished || runId !== _ttsRunId) return;
    finished = true;
    V.speaking = null; updateSpeakBtns(); _ttsAudio = null;
  };

  function speakWithWebSpeech() {
    if (!window.speechSynthesis) { done(); return; }
    waitForGermanVoice(() => {
      if (runId !== _ttsRunId) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'de-DE';
      u.rate = 0.82;
      u.pitch = 1;
      u.volume = 1;
      if (_bestVoice) u.voice = _bestVoice;
      u.onend = done;
      u.onerror = done;
      speechSynthesis.speak(u);
    });
  }

  if (isLocalFilePage() && isMobile) {
    speakWithWebSpeech();
    return;
  }

  // ── Desktop: try external APIs, fall back to Web Speech ─────────────────
  function tryEngine(idx) {
    const engines = ttsEnginesForCurrentPage();
    if (idx >= engines.length) {
      speakWithWebSpeech();
      return;
    }
    const audio = new Audio();
    _ttsAudio = audio;
    let errored = false;
    let startTimer = null;
    const clearStartTimer = () => {
      if (startTimer) clearTimeout(startTimer);
      startTimer = null;
    };
    const fail = () => {
      if (errored || finished || runId !== _ttsRunId) return;
      errored = true;
      clearStartTimer();
      _ttsAudio = null;
      tryEngine(idx + 1);
    };
    audio.onplaying = clearStartTimer;
    audio.onended = () => { clearStartTimer(); done(); };
    audio.onerror = fail;
    audio.src = engines[idx](text);
    audio.playbackRate = 0.85;
    startTimer = setTimeout(fail, TTS_AUDIO_START_TIMEOUT_MS);
    audio.play().then(clearStartTimer).catch(fail);
  }
  tryEngine(0);
}
function practiceFav(id) {
  DB.favorites.has(id) ? DB.favorites.delete(id) : DB.favorites.add(id);
  save();
  const btn = document.getElementById('prac-fav-' + id);
  if (btn) {
    const on = DB.favorites.has(id);
    btn.className = 'prac-fav-btn' + (on ? ' on' : '');
    btn.title = on ? 'Remove from saved' : 'Save sentence';
  }
}

function updateSpeakBtns() {
  document.querySelectorAll('.speak-btn').forEach(btn => {
    const id = btn.dataset.id;
    if (V.speaking === id) { btn.className = 'act-btn is-playing speak-btn'; btn.innerHTML = ICO.speak + '<span class="pulse"> Playing…</span>'; }
    else { btn.className = 'act-btn speak-btn'; btn.innerHTML = ICO.speak + ' Listen'; }
  });
}

function openGoalModal() {
  const title = document.getElementById('goal-modal-title');
  const subtitle = document.getElementById('goal-modal-sub');
  if (title) title.textContent = 'Set Daily Goal';
  if (subtitle) subtitle.textContent = 'How many new sentences to learn each day?';
  document.getElementById('goal-opts').innerHTML = [5, 8, 10, 12, 15, 20, 25, 30].map(v => `<button class="goal-opt${DB.dailyGoal === v ? ' sel' : ''}" onclick="setGoal(${v})" aria-pressed="${DB.dailyGoal === v}" type="button">${v}</button>`).join('');
  document.getElementById('goal-modal').style.display = 'flex';
  const selected = document.querySelector('.goal-opt.sel');
  if (selected) selected.focus();
}
function openFreqGoalModal() {
  const title = document.getElementById('goal-modal-title');
  const subtitle = document.getElementById('goal-modal-sub');
  if (title) title.textContent = 'Set Vocabulary Goal';
  if (subtitle) subtitle.textContent = 'How many new words to learn each day?';
  document.getElementById('goal-opts').innerHTML = [5, 10, 15, 20, 25, 30, 40, 50, 60].map(v => `<button class="goal-opt${DB.freqDailyGoal === v ? ' sel' : ''}" onclick="setFreqGoal(${v})" aria-pressed="${DB.freqDailyGoal === v}" type="button">${v}</button>`).join('');
  document.getElementById('goal-modal').style.display = 'flex';
  const selected = document.querySelector('.goal-opt.sel');
  if (selected) selected.focus();
}
function closeGoalModal(e) { if (!e || e.target === document.getElementById('goal-modal')) document.getElementById('goal-modal').style.display = 'none'; render(); }
function setGoal(n) {
  DB.dailyGoal = n; DB.dailyQueueDate = null; _sessionGotIt = new Set(); save();
  document.querySelectorAll('.goal-opt').forEach(el => {
    const selected = parseInt(el.textContent) === n;
    el.classList.toggle('sel', selected);
    el.setAttribute('aria-pressed', String(selected));
  });
}

// ==============================
// PRACTICE MODE
// ==============================
let P = { active: false, queue: [], idx: 0, revealed: false, got: 0, again: 0, skipped: 0, isSRS: false, dir: 'de2en', dirChoice: true, answered: {}, missedIds: [], typedFeedback: null };
let PP = { active: false, queue: [], idx: 0, revealed: false, got: 0, again: 0, skipped: 0, answered: {} };
let FP = { active: false, queue: [], idx: 0, revealed: false, again: 0, hard: 0, good: 0, easy: 0, skipped: 0, mode: 'replay', answered: {}, missedIds: [], ratingById: {} };

function startPractice(opts) {
  const ids = Array.isArray(opts) ? opts : opts.ids;
  const isSRS = Array.isArray(opts) ? false : (opts.isSRS || false);
  const skipSessionFilter = Array.isArray(opts) ? false : (opts.skipSessionFilter || false);
  let sents = ids.map(id => SENTENCES.find(s => s.id === id)).filter(Boolean);
  // Filter out cards already mastered ("Got it") in this session
  if (!isSRS && !skipSessionFilter) sents = sents.filter(s => !_sessionGotIt.has(s.id));
  if (!sents.length) {
    // All cards already done in this session
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:var(--green);color:white;padding:10px 20px;border-radius:99px;font-size:13px;font-weight:600;z-index:400;box-shadow:0 4px 12px rgba(0,0,0,0.15)';
    toast.textContent = 'All cards mastered this session. Review saved phrases or start a new batch when ready.';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
    return;
  }
  P = { active: true, queue: shuffle([...sents]), idx: 0, revealed: false, got: 0, again: 0, skipped: 0, isSRS, dir: 'de2en', dirChoice: true, answered: {}, missedIds: [], typedFeedback: null };
  renderPractice();
}

function setPracticeDir(dir) {
  P.dir = dir;
  P.dirChoice = false;
  renderPractice();
}

function isRecognitionSentence(sentence) {
  return Boolean(sentence && (sentence.recognitionOnly || (sentence.learn && sentence.learn.mode === 'recognition')));
}

function effectivePracticeDirection(sentence) {
  return isRecognitionSentence(sentence) ? 'de2en' : P.dir;
}

// Shared fragments for the practice overlay cards.
function practiceTopicLabel(topic, s, gram) {
  if (!topic) return '';
  return `<div class="practice-topic-lbl">${esc(topic.name)}<span class="lvl-tag l${s.lv}">${s.lv}</span>${gram ? `<span class="gram-tag">${esc(gram.t)}</span>` : ''}</div>`;
}
function practiceFavButton(s) {
  const on = DB.favorites.has(s.id);
  return `<button class="prac-fav-btn${on ? ' on' : ''}" id="prac-fav-${s.id}" onclick="practiceFav('${s.id}')" type="button" aria-pressed="${on}" title="${on ? 'Remove from saved' : 'Save sentence'}">${ICO.star}</button>`;
}
function practicePatternHint(s) {
  const mp = findMatchingPattern(s);
  if (!mp) return '';
  const others = mp.examples.filter(e => e.de !== s.de).slice(0, 2);
  return `<div class="prac-pattern-hint">
    <div class="prac-pattern-hint-title">Pattern · ${esc(mp.template)}</div>
    <div class="prac-pattern-hint-meaning">${esc(mp.meaning)}</div>
    ${others.map(e => `<div class="prac-pattern-hint-ex"><strong lang="de">${esc(e.de)}</strong> — ${esc(e.en)}</div>`).join('')}
  </div>`;
}
function practiceSpeakButton(s, safeDE, label) {
  return `<div class="practice-speak-row">
      <button class="act-btn speak-btn" data-id="prac-${s.id}" onclick="speak(${safeDE},'prac-${s.id}')" type="button">
        ${ICO.speak} <span id="prac-speak-lbl">${label}</span>
      </button>
    </div>`;
}

function renderPractice() {
  const existing = document.getElementById('practice-overlay');
  if (existing) existing.remove();
  if (!P.active) return;

  const ov = document.createElement('div');
  ov.id = 'practice-overlay';
  ov.className = 'practice-overlay';

  // ── Direction choice screen ──────────────────
  if (P.dirChoice) {
    const total = P.queue.length;
    ov.innerHTML = `
  <div class="practice-hdr">
    <button class="practice-exit" onclick="closePractice()">Exit</button>
    <div style="font-size:15px;font-weight:700;color:var(--text)">${total} card${total !== 1 ? 's' : ''} ready</div>
    <div style="width:44px"></div>
  </div>
  <div class="practice-body">
    <div class="dir-choice-wrap">
      <div class="dir-choice-title">Choose practice mode</div>
      <div class="dir-choice-sub">How do you want to drill these cards?</div>
      <button class="dir-btn primary" onclick="setPracticeDir('de2en')">
        <span class="dir-btn-icon">DE</span>
        <div>
          <div class="dir-btn-title">German → English</div>
          <div class="dir-btn-sub">See German, recall the translation</div>
        </div>
      </button>
      <button class="dir-btn" onclick="setPracticeDir('en2de')">
        <span class="dir-btn-icon">EN</span>
        <div>
          <div class="dir-btn-title">English → German</div>
          <div class="dir-btn-sub">See English, recall the German sentence</div>
        </div>
      </button>
      <button class="dir-btn" onclick="setPracticeDir('type')">
        <span class="dir-btn-icon">${ICO.keyboard}</span>
        <div>
          <div class="dir-btn-title">Type German</div>
          <div class="dir-btn-sub">Write the sentence and get quick feedback</div>
        </div>
      </button>
    </div>
  </div>`;
    document.body.appendChild(ov);
    return;
  }

  // ── Completed screen ─────────────────────────
  if (P.idx >= P.queue.length) {
    const total = P.queue.length;
    const answeredCount = Object.keys(P.answered).length;
    const pct = answeredCount ? Math.round(P.got / answeredCount * 100) : 0;
    const title = pct >= 80 ? 'Excellent work' : pct >= 50 ? 'Good progress' : 'Keep practicing';
    const retryIds = JSON.stringify(P.queue.map(s => s.id)).replace(/"/g, "'");
    const missedIds = [...new Set(P.missedIds)];
    const missedBtn = missedIds.length ? `<button class="prac-sum-retry" onclick="startPractice({ids:${idsArg(missedIds)},skipSessionFilter:true})">Review misses</button>` : '';
    const srsMsg = P.isSRS ? `<div class="prac-sum-note">Review intervals updated — next reviews scheduled.</div>` : '';
    const modeTag = `<div class="prac-mode-tag">${P.dir === 'type' ? 'Typed recall' : P.dir === 'en2de' ? 'English → German' : 'German → English'}</div>`;
    ov.innerHTML = `
  <div class="practice-hdr"><span style="font-size:16px;font-weight:600;color:var(--text)">Practice complete</span></div>
  <div class="practice-body">
    <div class="prac-summary">
      <div class="prac-sum-icon">${ICO.trophy}</div>
      <div class="prac-sum-title">${title}</div>
      <div class="prac-sum-sub">You reviewed ${total} sentence${total !== 1 ? 's' : ''}</div>
      ${modeTag}
      ${srsMsg}
      <div class="prac-sum-stats">
        <div class="prac-sum-stat"><div class="prac-sum-n">${P.got}</div><div class="prac-sum-l">Got it</div></div>
        <div class="prac-sum-stat"><div class="prac-sum-n">${P.again}</div><div class="prac-sum-l">Still learning</div></div>
        <div class="prac-sum-stat"><div class="prac-sum-n">${P.skipped}</div><div class="prac-sum-l">Skipped</div></div>
      </div>
      <div class="prac-sum-actions">
        ${missedBtn}
        <button class="prac-sum-retry" onclick="startPractice({ids:${retryIds},isSRS:${P.isSRS}})">Practice again</button>
        <button class="prac-sum-done" onclick="closePractice()">Done</button>
      </div>
    </div>
  </div>`;
  } else {
    // ── Active card ──────────────────────────────
    const s = P.queue[P.idx];
    const topic = TOPICS.find(t => t.id === s.t);
    const total = P.queue.length;
    const pct = Math.round(P.idx / total * 100);
    const gram = grammarTag(s.de);
    const safeDE = jsArg(s.de);
    const recognitionMode = isRecognitionSentence(s);
    const effectiveDir = effectivePracticeDirection(s);

    const dirLabel = `<span class="prac-tag">${recognitionMode ? 'Recognition' : P.dir === 'type' ? 'Type' : P.dir === 'en2de' ? 'EN → DE' : 'DE → EN'}</span>`;

    let cardBody;
    if (effectiveDir === 'de2en') {
      // Front: German + phonetics. Back: English + usage
      const recognitionReply = recognitionMode && s.learn
        ? `<div class="practice-use"><strong>You can answer:</strong> ${esc(s.learn.learnerReply || s.learn.expectedReply)}</div>`
        : '';
      cardBody = `
    <div class="practice-card">
      ${practiceFavButton(s)}
      ${practiceTopicLabel(topic, s, gram)}
      <div class="practice-de" lang="de">${esc(s.de)}</div>
      <div class="practice-ph">${ICO.speak} ${esc(s.ph)}</div>
      ${P.revealed
          ? `<div class="practice-en">${esc(s.en)}</div><div class="practice-use">${esc(s.use)}</div>${recognitionReply}${practicePatternHint(s)}${renderRevealDetails(s, true, 'pgd-')}`
          : `<button class="practice-reveal-hint" onclick="practiceReveal()" type="button">${recognitionMode ? 'Tap to reveal meaning and response' : 'Tap to reveal translation'}</button>`}
    </div>
    ${practiceSpeakButton(s, safeDE, 'Listen')}
    ${P.revealed ? `
      <div class="practice-btns">
        <button class="prac-again-btn" onclick="practiceAnswer(false)">Still learning</button>
        <button class="prac-got-btn" onclick="practiceAnswer(true)">Got it</button>
      </div>` : ''}
    <div class="kbd-hint">
      <span class="kbd">Space</span> show/hide &nbsp;
      <span class="kbd">←</span> prev &nbsp;
      <span class="kbd">→</span> skip
    </div>`;
    } else if (effectiveDir === 'en2de') {
      // en2de — Front: English. Back: German + phonetics + usage
      cardBody = `
    <div class="practice-card">
      ${practiceFavButton(s)}
      ${practiceTopicLabel(topic, s, gram)}
      <div class="practice-de practice-prompt-en">${esc(s.en)}</div>
      ${P.revealed
          ? `<div class="practice-ph">${ICO.speak} ${esc(s.ph)}</div><div class="practice-answer-de" lang="de">${esc(s.de)}</div><div class="practice-use">${esc(s.use)}</div>${practicePatternHint(s)}${renderRevealDetails(s, true, 'pgd-')}`
          : `<button class="practice-reveal-hint" onclick="practiceReveal()" type="button">Tap to reveal German</button>`}
    </div>
    ${practiceSpeakButton(s, safeDE, P.revealed ? 'Listen' : 'Audio hint')}
    ${P.revealed ? `
      <div class="practice-btns">
        <button class="prac-again-btn" onclick="practiceAnswer(false)">Still learning</button>
        <button class="prac-got-btn" onclick="practiceAnswer(true)">Got it</button>
      </div>` : ''}
    <div class="kbd-hint">
      <span class="kbd">Space</span> show/hide &nbsp;
      <span class="kbd">←</span> prev &nbsp;
      <span class="kbd">→</span> skip
    </div>`;
    } else {
      const feedback = P.typedFeedback ? `<div class="typed-feedback ${P.typedFeedback.ok ? 'ok' : 'warn'}">${P.typedFeedback.messages.map(esc).join('<br>')}</div>` : '';
      cardBody = `
    <div class="practice-card">
      ${practiceFavButton(s)}
      ${practiceTopicLabel(topic, s, gram)}
      <div class="practice-de practice-prompt-en">${esc(s.en)}</div>
      ${P.revealed
          ? `${feedback}<div class="practice-ph">${ICO.speak} ${esc(s.ph)}</div><div class="practice-answer-de" lang="de">${esc(s.de)}</div><div class="practice-use">${esc(s.use)}</div>${renderRevealDetails(s, true, 'pgd-')}`
          : `<input id="typed-answer" class="typed-answer" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type the German sentence…" onkeydown="if(event.key==='Enter') checkTypedAnswer()" autofocus>
             <button class="practice-reveal-hint practice-reveal-block" onclick="checkTypedAnswer()" type="button">Check answer</button>
             <button class="practice-skip-reveal" onclick="practiceReveal()" type="button">Reveal without typing</button>`}
    </div>
    ${practiceSpeakButton(s, safeDE, P.revealed ? 'Listen' : 'Audio hint')}
    ${P.revealed ? `
      <div class="practice-btns">
        <button class="prac-again-btn" onclick="practiceAnswer(false)">Still learning</button>
        <button class="prac-got-btn" onclick="practiceAnswer(true)">Got it</button>
      </div>` : ''}
    <div class="kbd-hint">
      <span class="kbd">Enter</span> check &nbsp;
      <span class="kbd">←</span> prev &nbsp;
      <span class="kbd">→</span> skip
    </div>`;
    }

    ov.innerHTML = `
  <div class="practice-hdr">
    <button class="practice-exit" onclick="closePractice()">Exit</button>
    <div class="practice-prog-wrap">
      <div class="practice-prog-bar"><div class="practice-prog-fill" style="width:${pct}%"></div></div>
      <div class="practice-prog-lbl">${P.idx + 1}/${total} · ${dirLabel} · Got ${P.got} · Learning ${P.again} · Skipped ${P.skipped}</div>
    </div>
  </div>
  <div class="practice-body">
    ${cardBody}
  </div>`;
  }
  document.body.appendChild(ov);

  // Auto-play audio for new card
  if (P.active && P.idx < P.queue.length && !P.revealed && !P.dirChoice) {
    const s = P.queue[P.idx];
    // German-front cards can safely auto-play. English-front cards keep audio as a hint.
    if (effectivePracticeDirection(s) === 'de2en') {
      if (isMobile) {
        speak(s.de, `prac-${s.id}`);
      } else {
        setTimeout(() => speak(s.de, `prac-${s.id}`), 150);
      }
    }
  }
  const input = document.getElementById('typed-answer');
  if (input) input.focus();
}

function practiceReveal() {
  P.revealed = !P.revealed;
  const currentDirection = P.idx < P.queue.length ? effectivePracticeDirection(P.queue[P.idx]) : P.dir;
  if (P.revealed && currentDirection === 'type' && !P.typedFeedback) {
    P.typedFeedback = { ok: false, messages: ['Revealed without a typed attempt.'] };
  }
  renderPractice();
  // Auto-play German audio when revealing in en2de mode
  if (P.revealed && P.idx < P.queue.length && currentDirection === 'en2de') {
    const s = P.queue[P.idx];
    setTimeout(() => speak(s.de, `prac-${s.id}`), 200);
  }
}

function normalizeTypedAnswerExact(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFC')
    .replace(/[.,!?;:"'()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeGermanNativeFold(text) {
  return normalizeTypedAnswerExact(text)
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss');
}

function normalizeGermanTransliterationFold(text) {
  return normalizeTypedAnswerExact(text)
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

function normalizeTypedAnswer(text) {
  return normalizeGermanNativeFold(text);
}

function hasCloseGermanSpelling(answer, expected) {
  const answerForms = new Set([
    normalizeTypedAnswerExact(answer),
    normalizeGermanNativeFold(answer),
    normalizeGermanTransliterationFold(answer),
  ]);
  return [
    normalizeTypedAnswerExact(expected),
    normalizeGermanNativeFold(expected),
    normalizeGermanTransliterationFold(expected),
  ].some(form => answerForms.has(form));
}

function germanSpellingMarks(text) {
  return [...new Set((String(text || '').match(/[äöüß]/gi) || []).map(ch => ch.toLowerCase()))];
}

function checkTypedAnswer() {
  if (!P.active || P.idx >= P.queue.length) return;
  const input = document.getElementById('typed-answer');
  const answer = input ? input.value : '';
  const expected = P.queue[P.idx].de;
  const exactAnswer = normalizeTypedAnswerExact(answer);
  const exactExpected = normalizeTypedAnswerExact(expected);
  const simpleAnswer = normalizeTypedAnswer(answer);
  const simpleExpected = normalizeTypedAnswer(expected);
  const messages = [];
  const ok = exactAnswer === exactExpected;
  const close = !ok && hasCloseGermanSpelling(answer, expected);
  if (ok) messages.push('Exact match.');
  else if (close) {
    const marks = germanSpellingMarks(expected);
    messages.push(`Close match. ${marks.length ? `Use the exact German spelling: ${marks.join(', ')}.` : 'Check the exact German spelling.'}`);
  }
  else {
    messages.push('Compare your answer with the sentence below.');
    const expectedWords = simpleExpected.split(' ');
    const answerWords = simpleAnswer.split(' ');
    const missingArticles = expectedWords.filter(w => ['der', 'die', 'das', 'den', 'dem', 'ein', 'eine', 'einen', 'einem'].includes(w) && !answerWords.includes(w));
    const missingModals = expectedWords.filter(w => ['kann', 'konnten', 'koennen', 'muss', 'mochte', 'moechte', 'soll', 'darf', 'wurde', 'wuerde'].includes(w) && !answerWords.includes(w));
    if (missingArticles.length) messages.push(`Check articles/cases: ${[...new Set(missingArticles)].join(', ')}.`);
    if (missingModals.length) messages.push(`Check modal verb: ${[...new Set(missingModals)].join(', ')}.`);
    if (expectedWords[0] && answerWords[0] && expectedWords[0] !== answerWords[0]) messages.push('Word order starts differently.');
  }
  P.typedFeedback = { ok, messages };
  P.revealed = true;
  renderPractice();
}

function practiceAnswer(got) {
  const currentCard = P.queue[P.idx];
  if (!currentCard) return;
  const attemptKey = String(P.idx);
  if (P.answered[attemptKey]) {
    P.idx++; P.revealed = false; P.typedFeedback = null; renderPractice();
    return;
  }

  const wasLearned = DB.learned.has(currentCard.id);
  const intervalBefore = DB.srs[currentCard.id] ? DB.srs[currentCard.id].interval || 0 : 0;
  const wasDue = Boolean(DB.srs[currentCard.id] && DB.srs[currentCard.id].nextReview && DB.srs[currentCard.id].nextReview <= today());
  let intervalAfter = intervalBefore;
  recordStudy();
  DB.dailyQueueDone.add(currentCard.id);

  if (got) {
    P.got++;
    P.answered[attemptKey] = 'got';
    _sessionGotIt.add(currentCard.id);
    if (wasLearned) intervalAfter = srsSchedule(currentCard.id, true).intervalAfter;
    else { markSentenceLearned(currentCard.id, 'practice'); intervalAfter = DB.srs[currentCard.id].interval; }
  } else {
    P.again++;
    P.answered[attemptKey] = 'again';
    P.missedIds.push(currentCard.id);
    if (wasLearned) intervalAfter = srsSchedule(currentCard.id, false).intervalAfter;
    if (!P.queue.slice(P.idx + 1).some(s => s.id === currentCard.id)) {
      const insertAt = Math.min(P.queue.length, P.idx + 3);
      P.queue.splice(insertAt, 0, currentCard);
    }
  }
  recordAttempt({ id: currentCard.id, result: got ? 'got' : 'again', mode: 'practice', direction: effectivePracticeDirection(currentCard), sentence: currentCard, intervalBefore, intervalAfter, wasDue });
  save();
  P.idx++; P.revealed = false; P.typedFeedback = null; renderPractice();
  updateHeader();
}

function practiceNext() {
  if (P.idx < P.queue.length) {
    const currentCard = P.queue[P.idx];
    const attemptKey = String(P.idx);
    if (currentCard && !P.answered[attemptKey]) {
      P.answered[attemptKey] = 'skip';
      P.skipped++;
      recordAttempt({ id: currentCard.id, result: 'skip', mode: 'practice', direction: effectivePracticeDirection(currentCard), sentence: currentCard });
      save();
    }
    P.idx++; P.revealed = false; P.typedFeedback = null; renderPractice();
  }
}

function practicePrev() {
  if (P.idx > 0) { P.idx--; P.revealed = false; P.typedFeedback = null; renderPractice(); }
}

function closePractice() { P.active = false; PP.active = false; FP.active = false; const ov = document.getElementById('practice-overlay'); if (ov) ov.remove(); render(); }

// ==============================
// FREQUENCY PRACTICE MODE
// ==============================

function isScheduledFrequencyPractice(mode) {
  return ['scheduled', 'due', 'new', 'session'].includes(mode);
}

function startFrequencyPractice(opts) {
  const ids = Array.isArray(opts) ? opts : opts.ids;
  const mode = Array.isArray(opts) ? 'replay' : String(opts.mode || (opts.isSRS ? 'due' : 'replay'));
  const entries = ids.map(id => freqById(id)).filter(Boolean);
  if (!entries.length) return;
  P.active = false;
  PP.active = false;
  FP = { active: true, queue: shuffle([...entries]), idx: 0, revealed: false, wordMeaningRevealed: false, again: 0, hard: 0, good: 0, easy: 0, skipped: 0, mode, answered: {}, missedIds: [], ratingById: {} };
  renderFrequencyPractice();
}
function renderFrequencyPractice() {
  const existing = document.getElementById('practice-overlay');
  if (existing) existing.remove();
  if (!FP.active) return;

  const ov = document.createElement('div');
  ov.id = 'practice-overlay';
  ov.className = 'practice-overlay';

  if (FP.idx >= FP.queue.length) {
    const total = FP.queue.length;
    const answeredCount = Object.keys(FP.answered).filter(key => FP.answered[key] !== 'skip').length;
    const strong = FP.good + FP.easy;
    const pct = answeredCount ? Math.round(strong / answeredCount * 100) : 0;
    const sessionRatedIds = Object.keys(FP.ratingById);
    const sessionRatingIds = rating => sessionRatedIds.filter(id => FP.ratingById[id] === rating);
    const difficultIds = [...sessionRatingIds('again'), ...sessionRatingIds('hard')];
    const difficultAction = difficultIds.length
      ? `<button class="prac-sum-retry" onclick="startFrequencyPractice({ids:${idsArg(difficultIds)},mode:'replay'})" type="button">Review difficult <span>${difficultIds.length}</span></button>`
      : '';
    const dueLeft = getFreqReviewIds().length;
    const scheduleNote = isScheduledFrequencyPractice(FP.mode)
      ? 'Review intervals updated — next reviews scheduled.'
      : 'Practice-only replay — your review schedule is unchanged.';
    ov.innerHTML = `
  <div class="practice-hdr"><span class="practice-hdr-title">Session complete</span></div>
  <div class="practice-body">
    <div class="prac-summary">
      <div class="prac-sum-icon">${ICO.vocab}</div>
      <div class="prac-sum-title">${pct >= 80 ? 'Strong recall' : pct >= 50 ? 'Good progress' : 'Keep reviewing'}</div>
      <div class="prac-sum-sub">You answered ${answeredCount} of ${total} card${total !== 1 ? 's' : ''}</div>
      <div class="prac-mode-tag">German → English</div>
      <div class="prac-sum-stats vocab-sum-stats">
        <div class="prac-sum-stat"><div class="prac-sum-n" style="color:var(--red)">${FP.again}</div><div class="prac-sum-l">Again</div></div>
        <div class="prac-sum-stat"><div class="prac-sum-n" style="color:var(--amber)">${FP.hard}</div><div class="prac-sum-l">Hard</div></div>
        <div class="prac-sum-stat"><div class="prac-sum-n" style="color:var(--green)">${FP.good}</div><div class="prac-sum-l">Good</div></div>
        <div class="prac-sum-stat"><div class="prac-sum-n">${FP.easy}</div><div class="prac-sum-l">Easy</div></div>
      </div>
      <div class="prac-sum-note">${scheduleNote} ${dueLeft ? `${dueLeft} card${dueLeft !== 1 ? 's' : ''} still due today.` : ''}</div>
      <div class="prac-sum-actions">
        <div class="prac-sum-action-main">
          ${difficultAction}
          <button class="prac-sum-done" onclick="closePractice()" type="button">Done</button>
        </div>
        ${sessionRatedIds.length ? `<button class="prac-sum-replay-all" onclick="startFrequencyPractice({ids:${idsArg(sessionRatedIds)},mode:'replay'})" type="button">Review all ${sessionRatedIds.length} cards</button>` : ''}
      </div>
    </div>
  </div>`;
    document.body.appendChild(ov);
    return;
  }

  const entry = FP.queue[FP.idx];
  const id = String(entry.rank);
  const total = FP.queue.length;
  const pct = Math.round(FP.idx / total * 100);
  const isNew = !DB.freqLearned.has(id);
  const speakText = entry.germanSentence || entry.german;
  const frontHtml = `<div class="practice-de freq-practice-word" lang="de">${esc(freqDisplay(entry))}</div>`;
  const backHtml = `<div class="practice-en freq-practice-en">${esc(entry.english)}</div>`;
  ov.innerHTML = `
  <div class="practice-hdr">
    <button class="practice-exit" onclick="closePractice()" type="button">Exit</button>
      <div class="practice-prog-wrap">
      <div class="practice-prog-bar"><div class="practice-prog-fill" style="width:${pct}%"></div></div>
      <div class="practice-prog-lbl">${FP.idx + 1}/${total} · Again ${FP.again} · Hard ${FP.hard} · Good ${FP.good} · Easy ${FP.easy}</div>
    </div>
  </div>
  <div class="practice-body">
    <div class="practice-card freq-practice-card">
      <div class="practice-topic-lbl">Rank #${entry.rank} · ${esc(freqPosLabel(entry))} ${isNew ? '<span class="card-state-tag is-new">New</span>' : '<span class="card-state-tag">Review</span>'}</div>
      ${frontHtml}
      ${FP.revealed ? `
        <div class="freq-practice-sentence" lang="de">${freqSentenceWithHighlight(entry)}</div>
        <button class="practice-use freq-practice-en" onclick="frequencyPracticeRevealWordMeaning()" type="button" aria-label="Toggle English word meaning of ${esc(freqDisplay(entry))}">${esc(entry.englishSentence)}</button>
        ${FP.wordMeaningRevealed ? `<div class="freq-practice-word-meaning"><span style="font-size:12px;font-weight:600;color:var(--text-3);display:block;margin-bottom:2px">Word Meaning</span>${backHtml}</div>` : ''}
      ` : `<button class="practice-reveal-hint" onclick="frequencyPracticeReveal()" type="button">Tap to reveal the answer</button>`}
    </div>
    <div style="display:flex;justify-content:center;margin:10px 0">
      <button class="act-btn speak-btn" data-id="fprac-${id}" onclick="speak(${jsArg(speakText)},'fprac-${id}')" style="font-size:13px;padding:8px 18px" type="button">
        ${ICO.speak} Listen
      </button>
    </div>
    ${FP.revealed ? `
      <div class="vocab-rating-btns">
        <button class="vocab-rate again" onclick="frequencyPracticeAnswer('again')" type="button">Again</button>
        <button class="vocab-rate hard" onclick="frequencyPracticeAnswer('hard')" type="button">Hard</button>
        <button class="vocab-rate good" onclick="frequencyPracticeAnswer('good')" type="button">Good</button>
        <button class="vocab-rate easy" onclick="frequencyPracticeAnswer('easy')" type="button">Easy</button>
      </div>` : ''}
  </div>`;
  document.body.appendChild(ov);
  if (!FP.revealed) {
    if (isMobile) speak(speakText, `fprac-${id}`);
    else setTimeout(() => speak(speakText, `fprac-${id}`), 150);
  }
}
function frequencyPracticeReveal() {
  FP.revealed = true;
  renderFrequencyPractice();
}
function frequencyPracticeRevealWordMeaning() {
  if (!FP.revealed) return;
  FP.wordMeaningRevealed = !FP.wordMeaningRevealed;
  renderFrequencyPractice();
}
function frequencyPracticeAnswer(rating) {
  const current = FP.queue[FP.idx];
  if (!current) return;
  const attemptKey = String(FP.idx);
  if (FP.answered[attemptKey]) {
    FP.idx++;
    FP.revealed = false;
    renderFrequencyPractice();
    return;
  }
  const id = String(current.rank);
  const isNew = !DB.freqLearned.has(id);
  const intervalBefore = DB.freqSrs[id] ? DB.freqSrs[id].interval || 0 : 0;
  const scheduledMode = isScheduledFrequencyPractice(FP.mode);
  const scheduled = scheduledMode
    ? scheduleFreq(id, rating)
    : { intervalBefore, intervalAfter: intervalBefore, wasDue: false, learned: DB.freqLearned.has(id) };
  recordFreqRating(id, rating);
  FP.answered[attemptKey] = rating;
  FP.ratingById[id] = rating;
  if (rating === 'again') FP.again++;
  else if (rating === 'hard') FP.hard++;
  else if (rating === 'easy') FP.easy++;
  else FP.good++;

  if (rating === 'again') {
    FP.missedIds.push(id);
    if (!FP.queue.slice(FP.idx + 1).some(e => String(e.rank) === id)) {
      FP.queue.splice(Math.min(FP.queue.length, FP.idx + 3), 0, current);
    }
  }
  recordFreqAttempt({ id, result: rating, intervalBefore, intervalAfter: scheduled.intervalAfter, wasDue: scheduled.wasDue, isNew: isNew && scheduled.learned });
  save();
  FP.idx++;
  FP.revealed = false;
  FP.wordMeaningRevealed = false;
  renderFrequencyPractice();
  updateHeader();
}
function frequencyPracticeNext() {
  if (FP.idx < FP.queue.length) {
    const current = FP.queue[FP.idx];
    const attemptKey = String(FP.idx);
    if (current && !FP.answered[attemptKey]) {
      FP.answered[attemptKey] = 'skip';
      FP.skipped++;
      recordFreqAttempt({ id: String(current.rank), result: 'skip', intervalBefore: 0, intervalAfter: 0, wasDue: false });
      save();
    }
    FP.idx++;
    FP.revealed = false;
    FP.wordMeaningRevealed = false;
    renderFrequencyPractice();
  }
}

// ==============================
// PATTERN PRACTICE MODE
// ==============================
function startPatternPractice(opts) {
  const ids = Array.isArray(opts) ? opts : opts.ids;
  const pats = ids.map(id => PATTERNS.find(p => p.id === id)).filter(Boolean);
  if (!pats.length) return;
  PP = { active: true, queue: shuffle([...pats]), idx: 0, revealed: false, got: 0, again: 0, skipped: 0, answered: {} };
  renderPatternPractice();
}

function renderPatternPractice() {
  const existing = document.getElementById('practice-overlay');
  if (existing) existing.remove();
  if (!PP.active) return;

  const ov = document.createElement('div');
  ov.id = 'practice-overlay';
  ov.className = 'practice-overlay';

  // ── Completed screen ─────────────────────────
  if (PP.idx >= PP.queue.length) {
    const total = PP.queue.length;
    const answeredCount = Object.keys(PP.answered).length;
    const pct = answeredCount ? Math.round(PP.got / answeredCount * 100) : 0;
    const title = pct >= 80 ? 'Pattern master' : pct >= 50 ? 'Good progress' : 'Keep practicing';
    const retryIds = JSON.stringify(PP.queue.map(p => p.id)).replace(/"/g, "'");
    ov.innerHTML = `
  <div class="practice-hdr"><span class="practice-hdr-title">Pattern practice complete</span></div>
  <div class="practice-body">
    <div class="prac-summary">
      <div class="prac-sum-icon">${ICO.trophy}</div>
      <div class="prac-sum-title">${title}</div>
      <div class="prac-sum-sub">You reviewed ${total} pattern${total !== 1 ? 's' : ''}</div>
      <div class="prac-mode-tag">Pattern practice</div>
      <div class="prac-sum-stats">
        <div class="prac-sum-stat"><div class="prac-sum-n" style="color:var(--green)">${PP.got}</div><div class="prac-sum-l">Got it</div></div>
        <div class="prac-sum-stat"><div class="prac-sum-n" style="color:var(--amber)">${PP.again}</div><div class="prac-sum-l">Still learning</div></div>
        <div class="prac-sum-stat"><div class="prac-sum-n" style="color:var(--text-3)">${PP.skipped}</div><div class="prac-sum-l">Skipped</div></div>
      </div>
      <div class="prac-sum-actions">
        <button class="prac-sum-retry" onclick="startPatternPractice({ids:${retryIds}})">Practice again</button>
        <button class="prac-sum-done" onclick="closePractice()">Done</button>
      </div>
    </div>
  </div>`;
  } else {
    // ── Active pattern card ──────────────────────
    const p = PP.queue[PP.idx];
    const cat = PAT_CATS.find(c => c.id === p.cat);
    const total = PP.queue.length;
    const pct = Math.round(PP.idx / total * 100);
    const tpl = esc(p.template).replace(/\[([^\]]+)\]/g, '<span class="pat-blank">[$1]</span>');
    const safeDE = jsArg(p.examples[0].de);

    ov.innerHTML = `
  <div class="practice-hdr">
    <button class="practice-exit" onclick="closePractice()">Exit</button>
    <div class="practice-prog-wrap">
      <div class="practice-prog-bar"><div class="practice-prog-fill" style="width:${pct}%"></div></div>
      <div class="practice-prog-lbl">${PP.idx + 1}/${total} · <span class="prac-tag">Patterns</span> · Got ${PP.got} · Learning ${PP.again}</div>
    </div>
  </div>
  <div class="practice-body">
    <div class="practice-card">
      ${cat ? `<div class="practice-topic-lbl">${esc(cat.label)}</div>` : ''}
      <div class="pat-prac-question">What German pattern would you use for this situation?</div>
      <div class="pat-prac-meaning">${esc(p.meaning)}</div>
      ${PP.revealed
        ? `<div class="practice-reveal-block">
	            <div class="pat-prac-tpl" lang="de">${tpl}</div>
	            <div class="pat-prac-sub">${esc(p.meaning)}</div>
	            <div class="pat-prac-ex-lbl">Examples</div>
	            <div class="pat-prac-ex-list">
	              ${p.examples.map((e, ei) => `<div class="pat-ex"><div class="pat-de" lang="de"><button class="pat-ex-speak" onclick="event.stopPropagation();speak(${jsArg(e.de)},'ppex-${p.id}-${ei}')" title="Listen" aria-label="Listen" type="button">${ICO.speak}</button> ${esc(e.de)}</div><div class="pat-en">${esc(e.en)}</div></div>`).join('')}
	            </div>
	          </div>`
        : `<button class="practice-reveal-hint" onclick="patternPracticeReveal()" type="button">Tap to reveal the pattern</button>`}
    </div>
    ${PP.revealed ? `
      <div class="practice-speak-row">
        <button class="act-btn speak-btn" data-id="pprac-${p.id}" onclick="speak(${safeDE},'pprac-${p.id}')" type="button">
          ${ICO.speak} Listen to example
        </button>
      </div>
      <div class="practice-btns">
        <button class="prac-again-btn" onclick="patternPracticeAnswer(false)">Still learning</button>
        <button class="prac-got-btn" onclick="patternPracticeAnswer(true)">Got it</button>
      </div>` : ''}
    <div class="kbd-hint">
      <span class="kbd">Space</span> show/hide &nbsp;
      <span class="kbd">←</span> prev &nbsp;
      <span class="kbd">→</span> skip
    </div>
  </div>`;
  }
  document.body.appendChild(ov);
}

function patternPracticeReveal() {
  PP.revealed = !PP.revealed;
  renderPatternPractice();
  // Auto-play the first example when revealing
  if (PP.revealed && PP.idx < PP.queue.length) {
    const p = PP.queue[PP.idx];
    setTimeout(() => speak(p.examples[0].de, `pprac-${p.id}`), 200);
  }
}

function patternPracticeAnswer(got) {
  const p = PP.queue[PP.idx];
  if (!p) return;
  if (PP.answered[p.id]) { PP.idx++; PP.revealed = false; renderPatternPractice(); return; }
  const scheduled = schedulePattern(p.id, got);
  recordStudy();
  if (got) {
    PP.got++;
    PP.answered[p.id] = 'got';
    DB.understood.add(p.id);
  } else {
    PP.again++;
    PP.answered[p.id] = 'again';
    DB.understood.delete(p.id);
  }
  recordPatternAttempt({ id: p.id, result: got ? 'got' : 'again', ...scheduled });
  save();
  PP.idx++; PP.revealed = false; renderPatternPractice();
}

function patternPracticeNext() {
  if (PP.idx < PP.queue.length) {
    const p = PP.queue[PP.idx];
    if (p && !PP.answered[p.id]) {
      PP.answered[p.id] = 'skip';
      PP.skipped++;
      recordPatternAttempt({ id: p.id, result: 'skip' });
      save();
    }
    PP.idx++; PP.revealed = false; renderPatternPractice();
  }
}

function patternPracticePrev() {
  if (PP.idx > 0) { PP.idx--; PP.revealed = false; renderPatternPractice(); }
}

// ─── KEYBOARD SHORTCUTS ───────────────────────
document.addEventListener('keydown', e => {
  const tag = document.activeElement ? document.activeElement.tagName : '';
  const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement && document.activeElement.isContentEditable);
  if (isTyping) return;

  const isSpace = e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar' || e.keyCode === 32;

  if (e.key === 'Escape' && document.getElementById('review-reminder')) { dismissReviewReminder(); return; }

  // Pattern practice keyboard shortcuts
  if (PP.active) {
    if (e.key === 'Escape') { closePractice(); return; }
    if (PP.idx >= PP.queue.length) return;
    if (isSpace) {
      e.preventDefault();
      if (!PP.revealed) patternPracticeReveal();
      else patternPracticeNext();
      return;
    }
    if (e.code === 'ArrowRight') { e.preventDefault(); patternPracticeNext(); return; }
    if (e.code === 'ArrowLeft') { e.preventDefault(); patternPracticePrev(); return; }
    return;
  }

  // Vocab flashcard keyboard shortcuts
  if (FP.active) {
    if (e.key === 'Escape') { closePractice(); return; }
    if (FP.idx >= FP.queue.length) return;
    if (isSpace) {
      e.preventDefault();
      frequencyPracticeReveal();
      return;
    }
    if (e.code === 'ArrowRight') { e.preventDefault(); frequencyPracticeNext(); return; }
    if (FP.revealed && ['1', '2', '3', '4'].includes(e.key)) {
      e.preventDefault();
      frequencyPracticeAnswer({ 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' }[e.key]);
      return;
    }
    return;
  }

  // Sentence practice keyboard shortcuts
  if (P.active) {
    if (e.key === 'Escape') { closePractice(); return; }
    if (P.idx >= P.queue.length) return;
    if (isSpace) {
      e.preventDefault();
      if (!P.revealed) {
        practiceReveal();
      } else {
        const currentCard = P.queue[P.idx];
        const attemptKey = String(P.idx);
        if (currentCard && !P.answered[attemptKey]) {
          practiceAnswer(true);
        } else {
          practiceNext();
        }
      }
      return;
    }
    if (e.code === 'ArrowRight') { e.preventDefault(); practiceNext(); return; }
    if (e.code === 'ArrowLeft') { e.preventDefault(); practicePrev(); return; }
    return;
  }

  // Main feed flashcard keyboard shortcut
  if (isSpace) {
    e.preventDefault();
    const activeEl = document.activeElement;
    const activeCard = activeEl ? activeEl.closest('.sc, .fc') : null;

    if (activeEl && activeEl.tagName === 'BUTTON') {
      activeEl.blur();
    }

    const cards = Array.from(document.querySelectorAll('.sc, .fc'));
    if (!cards.length) return;

    let targetIdx = activeCard ? cards.indexOf(activeCard) : -1;

    if (targetIdx === -1) {
      targetIdx = cards.findIndex(card => {
        const rect = card.getBoundingClientRect();
        return rect.bottom > 100 && rect.top < window.innerHeight;
      });
    }

    if (targetIdx === -1) targetIdx = 0;

    const currentCardEl = cards[targetIdx];
    if (!currentCardEl || !currentCardEl.id) return;

    const rawId = currentCardEl.id;
    if (rawId.startsWith('sc-')) toggleReveal(rawId.replace('sc-', ''));
    else if (rawId.startsWith('fc-')) toggleFreqReveal(rawId.replace('fc-', ''));
  }
});

function showAppToast(message, ok = true) {
  const toast = document.createElement('div');
  toast.style.cssText = `position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:${ok ? '#16A34A' : '#DC2626'};color:white;padding:10px 20px;border-radius:99px;font-size:13px;font-weight:600;z-index:400;box-shadow:0 4px 12px rgba(0,0,0,0.15);max-width:calc(100vw - 32px);text-align:center`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function exportData() {
  const data = backupExportObj();
  const json = JSON.stringify(data, null, 2);

  const existing = document.getElementById('dd-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'dd-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Export Progress');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:300;display:flex;align-items:center;justify-content:center;padding:16px';
  modal.innerHTML = `
<div class="data-modal">
  <div class="data-modal-hdr">
    <div class="data-modal-title">Export progress</div>
    <button class="data-modal-close" onclick="document.getElementById('dd-modal').remove()" aria-label="Close">×</button>
  </div>
  <div class="data-modal-sub">Download as a file <strong>or</strong> copy the JSON text to paste anywhere.</div>
  <textarea id="export-ta" class="data-modal-ta" readonly></textarea>
  <div class="btn-row">
    <button class="btn btn-primary" style="flex:1" onclick="
      const json = document.getElementById('export-ta').value;
      const blob = new Blob([json],{type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'deutschdaily-backup-${new Date().toISOString().slice(0, 10)}.json';
      a.click(); URL.revokeObjectURL(a.href);
    ">Download file</button>
    <button id="copy-export-btn" class="btn btn-secondary" style="flex:1" onclick="
      const btn = document.getElementById('copy-export-btn');
      navigator.clipboard.writeText(document.getElementById('export-ta').value)
        .then(()=>{ if(btn) btn.textContent='Copied'; setTimeout(()=>{ const b=document.getElementById('copy-export-btn'); if(b) b.textContent='Copy text'; },2000); })
        .catch(()=>{ document.getElementById('export-ta').select(); document.execCommand('copy'); if(btn) btn.textContent='Copied'; setTimeout(()=>{ const b=document.getElementById('copy-export-btn'); if(b) b.textContent='Copy text'; },2000); });
    ">Copy text</button>
  </div>
</div>`;
  document.body.appendChild(modal);
  document.getElementById('export-ta').value = json;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function importData() {
  const existing = document.getElementById('dd-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'dd-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Import Progress');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:300;display:flex;align-items:center;justify-content:center;padding:16px';
  modal.innerHTML = `
<div class="data-modal">
  <div class="data-modal-hdr">
    <div class="data-modal-title">Import progress</div>
    <button class="data-modal-close" onclick="document.getElementById('dd-modal').remove()" aria-label="Close">×</button>
  </div>
  <div class="data-modal-sub">Pick a backup file <strong>or</strong> paste JSON text directly below. Your current progress will be <strong>merged</strong> (not overwritten).</div>
  <textarea id="import-ta" class="data-modal-ta" placeholder="Paste your backup JSON here..."></textarea>
  <div id="import-err" class="data-modal-err"></div>
  <div class="btn-row">
    <button class="btn btn-secondary" style="flex:1" onclick="document.getElementById('dd-file-input').click()">Choose file</button>
    <button class="btn btn-primary" style="flex:1" onclick="applyImport(document.getElementById('import-ta').value)">Import</button>
  </div>
  <input id="dd-file-input" type="file" accept=".json,application/json" style="display:none" onchange="
    const file = this.files[0]; if(!file) return;
    const r = new FileReader();
    r.onload = ev => { document.getElementById('import-ta').value = ev.target.result; };
    r.readAsText(file);
  ">
</div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function laterDateKey(a, b) {
  const na = normalizeDateKey(a);
  const nb = normalizeDateKey(b);
  if (!na) return nb || null;
  if (!nb) return na;
  return na >= nb ? na : nb;
}

function srsDateRank(card) {
  if (!card || typeof card !== 'object') return '';
  return normalizeDateKey(card.lastReview) || normalizeDateKey(card.nextReview) || '';
}

function compareSrsCards(a, b) {
  const dateComparison = srsDateRank(a).localeCompare(srsDateRank(b));
  if (dateComparison) return dateComparison;
  const nextReviewComparison = String(normalizeDateKey(a.nextReview) || '').localeCompare(String(normalizeDateKey(b.nextReview) || ''));
  if (nextReviewComparison) return nextReviewComparison;
  return (Number(a.interval) || 0) - (Number(b.interval) || 0)
    || (Number(a.level) || 0) - (Number(b.level) || 0)
    || (Number(a.ease) || 0) - (Number(b.ease) || 0);
}

function mergeSrsMaps(currentMap = {}, importedMap = {}) {
  const merged = {};
  [...new Set([...Object.keys(importedMap || {}), ...Object.keys(currentMap || {})])].forEach(id => {
    const current = currentMap[id];
    const imported = importedMap[id];
    if (!current) merged[id] = imported;
    else if (!imported) merged[id] = current;
    else merged[id] = compareSrsCards(imported, current) > 0 ? imported : current;
  });
  return merged;
}

function mergeFreqRatingStates(currentMap = {}, importedMap = {}) {
  const merged = {};
  [...new Set([...Object.keys(importedMap || {}), ...Object.keys(currentMap || {})])].forEach(id => {
    const current = currentMap[id];
    const imported = importedMap[id];
    if (!current) merged[id] = imported;
    else if (!imported) merged[id] = current;
    else merged[id] = Date.parse(String(imported.updatedAt || '')) > Date.parse(String(current.updatedAt || '')) ? imported : current;
  });
  return merged;
}

function mergeAttempts(currentAttempts = [], importedAttempts = []) {
  const byKey = new Map();
  [...importedAttempts, ...currentAttempts].forEach(a => {
    if (!a || typeof a !== 'object') return;
    const key = [
      a.date || '',
      a.id || '',
      a.mode || '',
      a.direction || '',
      a.result || '',
      a.wasDue ? 'due' : 'notdue',
      a.isNew ? 'isnew' : 'notnew',
      a.intervalBefore || 0,
      a.intervalAfter || 0,
    ].join('|');
    byKey.set(key, a);
  });
  return [...byKey.entries()]
    .sort(([aKey, a], [bKey, b]) => String(a.date || '').localeCompare(String(b.date || '')) || aKey.localeCompare(bKey))
    .slice(-1000)
    .map(([, attempt]) => attempt);
}

function applyImport(text) {
  const errEl = document.getElementById('import-err');
  const show = msg => { if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; } };
  if (!text.trim()) { show('Nothing to import — paste or load a file first.'); return; }
  let parsed;
  try { parsed = JSON.parse(text); } catch (e) { show('Invalid JSON. Make sure you copied the full text without changes.'); return; }
  if (!parsed || typeof parsed !== 'object' || (!Array.isArray(parsed.learned) && !Array.isArray(parsed.freqLearned) && !parsed.streak && !parsed.srs && !parsed.freqSrs && !parsed.freqRatingState && !parsed.attempts && !parsed.freqAttempts)) { show('This doesn\'t look like a DeutschDaily backup file.'); return; }
  const imported = normalizeDb(parsed);
  const current = dbToObj();
  const mergeHistoryWords = (a, b) => {
    const out = Object.assign({}, a || {});
    Object.entries(b || {}).forEach(([k, arr]) => { out[k] = [...new Set([...(out[k] || []), ...arr])]; });
    return out;
  };
  const merged = {
    learned: [...new Set([...current.learned, ...imported.learned])],
    favorites: [...new Set([...current.favorites, ...imported.favorites])],
    understood: [...new Set([...current.understood, ...imported.understood])],
    streak: Math.max(current.streak || 0, imported.streak || 0),
    lastStudy: laterDateKey(current.lastStudy, imported.lastStudy),
    dailyGoal: DB.dailyGoal,
    dailyQueue: DB.dailyQueue,
    dailyQueueDate: DB.dailyQueueDate,
    dailyQueueDone: [...new Set([...current.dailyQueueDone, ...imported.dailyQueueDone])],
    history: Object.assign({}, imported.history, current.history),
    historyWords: mergeHistoryWords(imported.historyWords, current.historyWords),
    srs: mergeSrsMaps(current.srs, imported.srs),
    patternSrs: mergeSrsMaps(current.patternSrs, imported.patternSrs),
    freqLearned: [...new Set([...current.freqLearned, ...imported.freqLearned])],
    freqFavorites: [...new Set([...current.freqFavorites, ...imported.freqFavorites])],
    freqSrs: mergeSrsMaps(current.freqSrs, imported.freqSrs),
    freqRatingState: mergeFreqRatingStates(current.freqRatingState, imported.freqRatingState),
    freqAttempts: mergeAttempts(current.freqAttempts, imported.freqAttempts),
    freqDailyGoal: DB.freqDailyGoal,
    freqDailyQueue: DB.freqDailyQueue,
    freqDailyQueueDate: DB.freqDailyQueueDate,
    freqDailyQueueDone: [...new Set([...current.freqDailyQueueDone, ...imported.freqDailyQueueDone])],
    reviewPromptDate: DB.reviewPromptDate,
    attempts: mergeAttempts(current.attempts, imported.attempts),
    patternAttempts: mergeAttempts(current.patternAttempts, imported.patternAttempts),
    settings: current.settings,
  };
  objToDB(merged);
  save();
  render();
  document.getElementById('dd-modal').remove();
  // Show success toast
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#16A34A;color:white;padding:10px 20px;border-radius:99px;font-size:13px;font-weight:600;z-index:400;box-shadow:0 4px 12px rgba(0,0,0,0.15)';
  toast.textContent = `Imported ${merged.freqLearned.length} vocab words · ${merged.learned.length} sentences`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}




// ─── HISTORY ─────────────────────────────────
function historySentence(id) {
  return SENTENCES.find(s => s.id === id) || null;
}

function historyPattern(id) {
  return PATTERN_BY_ID[id] || PATTERNS.find(p => p.id === id) || null;
}

function historyValidSentenceIds(ids) {
  const validIds = validSentenceIdSet();
  const out = [];
  (ids || []).forEach(id => {
    const sid = String(id);
    if (validIds.has(sid) && !out.includes(sid)) out.push(sid);
  });
  return out;
}

function historyValidPatternIds(ids) {
  const validIds = validPatternIdSet();
  const out = [];
  (ids || []).forEach(id => {
    const sid = String(id);
    if (validIds.has(sid) && !out.includes(sid)) out.push(sid);
  });
  return out;
}

function historyIsPracticeResult(result) {
  return result === 'got' || result === 'again';
}

function getHistoryDaySummary(key, dayIndex = 0) {
  const d = parseDateKey(key) || parseDateKey(today());
  const isToday = key === today();
  const isYesterday = key === addDaysISO(-1);
  const sentenceIds = historyValidSentenceIds(DB.historyWords[key] || []);
  const sentenceAttempts = DB.attempts.filter(a => a.date === key);
  const patternAttempts = DB.patternAttempts.filter(a => a.date === key);
  const frequencyAttempts = DB.freqAttempts.filter(a => a.date === key);
  const answeredSentenceAttempts = sentenceAttempts.filter(a => a.mode === 'practice' && historyIsPracticeResult(a.result));
  const answeredPatternAttempts = patternAttempts.filter(a => historyIsPracticeResult(a.result));
  const answeredAttempts = [...answeredSentenceAttempts, ...answeredPatternAttempts];
  const answeredFrequencyAttempts = frequencyAttempts.filter(a => a.result !== 'skip');
  const got = answeredAttempts.filter(a => a.result === 'got').length;
  const again = answeredAttempts.filter(a => a.result === 'again').length;
  const skipped = [...sentenceAttempts, ...patternAttempts, ...frequencyAttempts].filter(a => a.result === 'skip').length;
  const reviews = [...sentenceAttempts, ...patternAttempts, ...frequencyAttempts].filter(a => a.wasDue && a.result !== 'skip').length;
  const attemptSentenceIds = historyValidSentenceIds(sentenceAttempts.map(a => a.id));
  const missedSentenceIds = historyValidSentenceIds(sentenceAttempts.filter(a => a.result === 'again').map(a => a.id));

  // Vocab metrics for date key
  const vocabLearnedIds = [];
  frequencyAttempts.forEach(a => {
    if (a.isNew && !vocabLearnedIds.includes(a.id)) vocabLearnedIds.push(a.id);
  });
  const vocabLearnedEntries = vocabLearnedIds.map(id => freqById(id)).filter(Boolean);
  const vocabGot = answeredFrequencyAttempts.filter(a => a.result === 'good' || a.result === 'easy').length;
  const vocabAgain = answeredFrequencyAttempts.filter(a => a.result === 'again' || a.result === 'hard').length;
  const vocabAccuracy = vocabGot + vocabAgain ? pct(vocabGot, vocabGot + vocabAgain) : 0;

  const vocabPracticedMap = {};
  answeredFrequencyAttempts.forEach(a => {
    if (!vocabPracticedMap[a.id]) vocabPracticedMap[a.id] = { word: freqById(a.id), got: 0, again: 0 };
    if (a.result === 'good' || a.result === 'easy') vocabPracticedMap[a.id].got++;
    else if (a.result === 'again' || a.result === 'hard') vocabPracticedMap[a.id].again++;
  });
  const vocabPracticedEntries = Object.values(vocabPracticedMap).filter(v => v.word);

  const topicCounts = {};
  [...sentenceIds, ...attemptSentenceIds].forEach(id => {
    const s = historySentence(id);
    if (!s) return;
    topicCounts[s.t] = (topicCounts[s.t] || 0) + 1;
  });

  const topTopics = Object.entries(topicCounts)
    .map(([id, count]) => ({ topic: TOPICS.find(t => t.id === id), count }))
    .filter(r => r.topic)
    .sort((a, b) => b.count - a.count || a.topic.name.localeCompare(b.topic.name));

  return {
    key,
    date: d,
    label: isToday ? 'Today' : isYesterday ? 'Yesterday' : d.toLocaleDateString('en-DE', { weekday: 'long' }),
    shortLabel: isToday ? 'Today' : isYesterday ? 'Yest' : d.toLocaleDateString('en-DE', { weekday: 'short' }),
    dateStr: d.toLocaleDateString('en-DE', { day: 'numeric', month: 'long' }),
    fullDateStr: d.toLocaleDateString('en-DE', { weekday: 'long', day: 'numeric', month: 'long' }),
    isToday,
    dayIndex,
    sentenceIds,
    sentenceAttempts,
    patternAttempts,
    frequencyAttempts,
    vocabLearnedIds,
    vocabLearnedEntries,
    vocabLearnedCount: vocabLearnedEntries.length,
    vocabPracticedEntries,
    vocabGot,
    vocabAgain,
    vocabAccuracy,
    practiceCount: answeredAttempts.length + answeredFrequencyAttempts.length,
    sentencePracticeCount: answeredSentenceAttempts.length,
    patternPracticeCount: answeredPatternAttempts.length,
    frequencyPracticeCount: answeredFrequencyAttempts.length,
    got,
    again,
    skipped,
    reviews,
    accuracy: pct(got, got + again),
    activityCount: vocabLearnedEntries.length + sentenceIds.length + answeredAttempts.length + answeredFrequencyAttempts.length + skipped,
    missedSentenceIds,
    topTopics,
  };
}

function getHistoryDays(count = 30) {
  return Array.from({ length: count }, (_, i) => getHistoryDaySummary(addDaysISO(-i), i));
}

function historyRecentMissedIds(daysBack = 14, limit = 12) {
  const minKey = addDaysISO(-(daysBack - 1));
  const validIds = validSentenceIdSet();
  const out = [];
  [...DB.attempts].reverse().forEach(a => {
    if (a.date < minKey || a.result !== 'again' || !validIds.has(a.id) || out.includes(a.id)) return;
    out.push(a.id);
  });
  return out.slice(0, limit);
}

function historyRecentMissedPatternIds(daysBack = 14, limit = 8) {
  const minKey = addDaysISO(-(daysBack - 1));
  const validIds = validPatternIdSet();
  const out = [];
  [...DB.patternAttempts].reverse().forEach(a => {
    if (a.date < minKey || a.result !== 'again' || !validIds.has(a.id) || out.includes(a.id)) return;
    out.push(a.id);
  });
  return out.slice(0, limit);
}

function historyTopicPills(topTopics, max = 3) {
  const topics = topTopics.slice(0, max);
  if (!topics.length) return '';
  return `<div class="history-topic-pills">${topics.map(({ topic, count }) => `<span class="history-topic-pill" style="--topic-color:${esc(topic.color)}">${esc(topic.name)}${count > 1 ? ` ${count}` : ''}</span>`).join('')}</div>`;
}

function renderHistoryStat(label, value, sub, color = 'var(--text)') {
  return `<div class="history-stat">
    <div class="history-stat-label">${esc(label)}</div>
    <div class="history-stat-value" style="color:${color}">${esc(value)}</div>
    <div class="history-stat-sub">${esc(sub)}</div>
  </div>`;
}

function renderHistoryHeatmap(days) {
  const chronological = [...days].reverse();
  const maxActivity = Math.max(...days.map(d => d.activityCount), 1);
  const cells = chronological.map(d => {
    const level = d.activityCount === 0 ? 0 : Math.max(1, Math.min(4, Math.ceil(d.activityCount / maxActivity * 4)));
    const detail = d.activityCount
      ? `${d.sentenceIds.length} new, ${d.practiceCount} practice`
      : 'No activity';
    return `<button class="history-heat-cell level-${level}${d.isToday ? ' today' : ''}" onclick="navHistoryDay('${d.key}')" title="${esc(d.fullDateStr)}: ${esc(detail)}" type="button">${d.date.getDate()}</button>`;
  }).join('');
  return `<div class="history-panel">
    <div class="history-panel-title"><strong>30-day activity map</strong><span>Darker days had more learning or practice</span></div>
    <div class="history-heatmap">${cells}</div>
  </div>`;
}

function renderHistoryQuickActions() {
  const dueIds = getSrsReviewIds();
  const patternDueIds = getPatternReviewIds();
  const frequencyDueIds = getFreqReviewIds();
  const missedIds = historyRecentMissedIds();
  const missedPatternIds = historyRecentMissedPatternIds();
  const learnedIds = [...DB.learned];
  const actions = [];

  if (dueIds.length) {
    actions.push(`<button class="history-action primary" onclick="startPractice({ids:${idsArg(dueIds)},isSRS:true,skipSessionFilter:true})" type="button"><strong>Review ${dueIds.length} due sentence${dueIds.length !== 1 ? 's' : ''}</strong><span>Scheduled by spaced repetition</span></button>`);
  }
  if (patternDueIds.length) {
    actions.push(`<button class="history-action" onclick="startPatternPractice({ids:${idsArg(patternDueIds)}})" type="button"><strong>Review ${patternDueIds.length} due pattern${patternDueIds.length !== 1 ? 's' : ''}</strong><span>Keep sentence patterns fresh</span></button>`);
  }
  if (frequencyDueIds.length) {
    actions.push(`<button class="history-action" onclick="startFrequencyPractice({ids:${idsArg(frequencyDueIds)},mode:'due'})" type="button"><strong>Review ${frequencyDueIds.length} due vocab word${frequencyDueIds.length !== 1 ? 's' : ''}</strong><span>Scheduled vocabulary review</span></button>`);
  }
  if (missedIds.length) {
    actions.push(`<button class="history-action" onclick="startPractice({ids:${idsArg(missedIds)},skipSessionFilter:true})" type="button"><strong>Retry ${missedIds.length} missed sentence${missedIds.length !== 1 ? 's' : ''}</strong><span>From the last 14 days</span></button>`);
  }
  if (missedPatternIds.length) {
    actions.push(`<button class="history-action" onclick="startPatternPractice({ids:${idsArg(missedPatternIds)}})" type="button"><strong>Retry ${missedPatternIds.length} hard pattern${missedPatternIds.length !== 1 ? 's' : ''}</strong><span>Recent pattern misses</span></button>`);
  }
  if (learnedIds.length && actions.length < 4) {
    actions.push(`<button class="history-action" onclick="startPractice({ids:${idsArg(learnedIds)},skipSessionFilter:true})" type="button"><strong>Practice all learned</strong><span>${learnedIds.length} sentence${learnedIds.length !== 1 ? 's' : ''} available</span></button>`);
  }

  if (!actions.length) {
    return `<div class="history-action-grid">
      <button class="history-action primary" onclick="nav('today')" type="button"><strong>Start today's practice</strong><span>Build history from your daily queue</span></button>
      <button class="history-action" onclick="nav('browse')" type="button"><strong>Browse sentences</strong><span>Pick a topic and mark useful phrases learned</span></button>
    </div>`;
  }
  return `<div class="history-action-grid">${actions.slice(0, 4).join('')}</div>`;
}

function renderHistoryTopicFocus(days) {
  const topicCounts = {};
  days.forEach(day => {
    day.topTopics.forEach(({ topic, count }) => {
      topicCounts[topic.id] = (topicCounts[topic.id] || 0) + count;
    });
  });
  const rows = Object.entries(topicCounts)
    .map(([id, count]) => ({ topic: TOPICS.find(t => t.id === id), count }))
    .filter(r => r.topic)
    .sort((a, b) => b.count - a.count || a.topic.name.localeCompare(b.topic.name))
    .slice(0, 5);
  if (!rows.length) return '';
  const max = Math.max(...rows.map(r => r.count), 1);
  return `<div class="history-panel">
    <div class="history-panel-title"><strong>Recent focus</strong><span>Topics touched in the last 30 days</span></div>
    ${rows.map(r => `<div class="history-topic-row">
      <div class="history-topic-label">${esc(r.topic.name)}</div>
      <div class="history-topic-bar"><div class="history-topic-fill" style="--topic-color:${esc(r.topic.color)};width:${Math.max(8, Math.round(r.count / max * 100))}%"></div></div>
      <div class="history-topic-count">${r.count}</div>
    </div>`).join('')}
  </div>`;
}

function renderHistoryDayRow(day) {
  const isVocabMode = V.progressType === 'vocab';
  const previewIds = day.sentenceIds.length
    ? day.sentenceIds
    : historyValidSentenceIds(day.sentenceAttempts.filter(a => historyIsPracticeResult(a.result)).map(a => a.id));

  const preview = isVocabMode
    ? (day.vocabLearnedEntries.length ? day.vocabLearnedEntries : day.vocabPracticedEntries.map(r => r.word)).slice(0, 4).map(w => w.german).join(' · ')
    : previewIds.slice(0, 3).map(id => {
        const s = historySentence(id);
        return s ? s.de : '';
      }).filter(Boolean).join(' · ');

  const hasAccuracy = day.got + day.again > 0;
  const hasVocabAccuracy = day.vocabGot + day.vocabAgain > 0;

  const metricHtml = isVocabMode
    ? (day.activityCount
        ? `<div class="history-row-metrics">
            ${day.vocabLearnedCount ? `<span class="history-pill green">${day.vocabLearnedCount} new words</span>` : ''}
            ${day.frequencyPracticeCount ? `<span class="history-pill blue">${day.frequencyPracticeCount} practiced</span>` : ''}
            ${hasVocabAccuracy ? `<span class="history-pill${day.vocabAccuracy < 70 ? ' red' : ''}">${day.vocabAccuracy}% recall</span>` : ''}
            ${day.reviews ? `<span class="history-pill amber">${day.reviews} reviews</span>` : ''}
          </div>`
        : `<div class="history-row-metrics"><span class="history-pill">No vocab activity recorded</span></div>`)
    : (day.activityCount
        ? `<div class="history-row-metrics">
            ${day.sentenceIds.length ? `<span class="history-pill green">${day.sentenceIds.length} new</span>` : ''}
            ${day.sentencePracticeCount + day.patternPracticeCount ? `<span class="history-pill blue">${day.sentencePracticeCount + day.patternPracticeCount} practiced</span>` : ''}
            ${day.reviews ? `<span class="history-pill amber">${day.reviews} reviews</span>` : ''}
            ${hasAccuracy ? `<span class="history-pill${day.accuracy < 70 ? ' red' : ''}">${day.accuracy}% recall</span>` : ''}
            ${day.skipped ? `<span class="history-pill">${day.skipped} skipped</span>` : ''}
          </div>`
        : `<div class="history-row-metrics"><span class="history-pill">No activity recorded</span></div>`);

  return `<button class="history-day-row${day.isToday ? ' today' : ''}" onclick="navHistoryDay('${day.key}')" type="button">
    <span class="history-day-top">
      <span>
        <span class="history-day-title">${esc(day.label)}</span>
        <span class="history-day-date">${esc(day.dateStr)}</span>
      </span>
      <span class="history-day-score">${day.activityCount}<span>actions</span></span>
    </span>
    ${metricHtml}
    ${preview ? `<span class="history-preview">${esc(preview)}${(isVocabMode ? day.vocabLearnedEntries.length > 4 : previewIds.length > 3) ? ' ...' : ''}</span>` : ''}
    ${historyTopicPills(day.topTopics)}
  </button>`;
}

function renderHistoryPracticeRows(day) {
  const rowsById = {};
  day.sentenceAttempts.filter(a => a.mode === 'practice').forEach(a => {
    if (!rowsById[a.id]) rowsById[a.id] = { got: 0, again: 0, skip: 0, due: false };
    if (a.result === 'got') rowsById[a.id].got++;
    else if (a.result === 'again') rowsById[a.id].again++;
    else if (a.result === 'skip') rowsById[a.id].skip++;
    rowsById[a.id].due = rowsById[a.id].due || Boolean(a.wasDue);
  });

  const rows = Object.entries(rowsById)
    .map(([id, r]) => ({ sentence: historySentence(id), ...r, total: r.got + r.again, accuracy: pct(r.got, r.got + r.again) }))
    .filter(r => r.sentence)
    .sort((a, b) => b.again - a.again || b.total - a.total || a.sentence.de.localeCompare(b.sentence.de));
  if (!rows.length) return '';

  return `<div class="history-panel">
    <div class="history-panel-title"><strong>Sentence practice</strong><span>${rows.length} unique sentence${rows.length !== 1 ? 's' : ''}</span></div>
    ${rows.map(r => `<div class="history-practice-row">
      <div class="history-practice-text">
        <strong lang="de">${esc(r.sentence.de)}</strong>
        <span>${esc(r.sentence.en)}</span>
      </div>
      <div class="history-practice-meta">
        ${r.got ? `<span class="history-pill green">${r.got} got</span>` : ''}
        ${r.again ? `<span class="history-pill red">${r.again} again</span>` : ''}
        ${r.skip ? `<span class="history-pill">${r.skip} skip</span>` : ''}
        ${r.total ? `<span class="history-pill">${r.accuracy}%</span>` : ''}
        ${r.due ? `<span class="history-pill amber">review</span>` : ''}
      </div>
    </div>`).join('')}
  </div>`;
}

function renderHistoryPatternRows(day) {
  const rowsById = {};
  day.patternAttempts.forEach(a => {
    if (!rowsById[a.id]) rowsById[a.id] = { got: 0, again: 0, skip: 0, due: false };
    if (a.result === 'got') rowsById[a.id].got++;
    else if (a.result === 'again') rowsById[a.id].again++;
    else if (a.result === 'skip') rowsById[a.id].skip++;
    rowsById[a.id].due = rowsById[a.id].due || Boolean(a.wasDue);
  });

  const rows = Object.entries(rowsById)
    .map(([id, r]) => ({ pattern: historyPattern(id), ...r, total: r.got + r.again, accuracy: pct(r.got, r.got + r.again) }))
    .filter(r => r.pattern)
    .sort((a, b) => b.again - a.again || b.total - a.total || a.pattern.template.localeCompare(b.pattern.template));
  if (!rows.length) return '';

  return `<div class="history-panel">
    <div class="history-panel-title"><strong>Pattern practice</strong><span>${rows.length} pattern${rows.length !== 1 ? 's' : ''}</span></div>
    ${rows.map(r => `<div class="history-practice-row">
      <div class="history-practice-text">
        <strong lang="de">${esc(r.pattern.template)}</strong>
        <span>${esc(r.pattern.meaning)}</span>
      </div>
      <div class="history-practice-meta">
        ${r.got ? `<span class="history-pill green">${r.got} got</span>` : ''}
        ${r.again ? `<span class="history-pill red">${r.again} again</span>` : ''}
        ${r.skip ? `<span class="history-pill">${r.skip} skip</span>` : ''}
        ${r.total ? `<span class="history-pill">${r.accuracy}%</span>` : ''}
        ${r.due ? `<span class="history-pill amber">review</span>` : ''}
      </div>
    </div>`).join('')}
  </div>`;
}

function navHistoryDay(dateKey) {
  V.historyDay = normalizeDateKey(dateKey);
  V.view = V.historyDay ? 'history-day' : 'progress';
  commitState({ scroll: true });
}

function backToActivity() {
  V.historyDay = null;
  V.progressTab = 'activity';
  V.view = 'progress';
  commitState({ scroll: true });
}

function setProgressTab(tab) {
  V.progressTab = normalizeProgressTab(tab);
  commitState({ scroll: false });
}

function renderProgress() {
  return `<div style="padding-top:14px">
    <h2 class="page-title">Progress</h2>
    <p class="page-sub">Your learning analytics at a glance</p>
    ${renderProgressDashboard()}
  </div>`;
}

function renderHistoryDayStatsDashboard(day) {
  const freqAttempts = day.frequencyAttempts.filter(a => a.result !== 'skip');
  const counts = [
    { r: 'easy', n: freqAttempts.filter(a => a.result === 'easy').length, color: 'var(--accent)' },
    { r: 'good', n: freqAttempts.filter(a => a.result === 'good').length, color: 'var(--green)' },
    { r: 'hard', n: freqAttempts.filter(a => a.result === 'hard').length, color: 'var(--amber)' },
    { r: 'again', n: freqAttempts.filter(a => a.result === 'again').length, color: 'var(--red)' },
  ];
  const totalRatings = counts.reduce((sum, c) => sum + c.n, 0);

  const ratingBreakdownHtml = totalRatings ? `<div class="history-panel">
    <div class="history-panel-title"><strong>Vocabulary performance breakdown</strong><span>${totalRatings} rating${totalRatings !== 1 ? 's' : ''}</span></div>
    <div class="rating-breakdown">
      ${counts.map(c => `<div class="prog-row">
        <div class="prog-lbl" style="min-width:60px;text-transform:capitalize">${c.r}</div>
        <div class="prog-bar"><div class="prog-fill" style="width:${pct(c.n, totalRatings)}%;background:${c.color}"></div></div>
        <div class="prog-pct">${pct(c.n, totalRatings)}%</div>
        <div class="prog-cnt">${c.n}</div>
      </div>`).join('')}
    </div>
    <div class="retention-callout" style="margin-top:14px">
      <div class="retention-pct">${day.vocabAccuracy}%</div>
      <div>
        <div class="retention-label">Day retention rate</div>
        <div class="retention-sub">Good + Easy recall accuracy across ${totalRatings} rating${totalRatings !== 1 ? 's' : ''}</div>
      </div>
    </div>
  </div>` : '';

  const sentenceAttempts = [...day.sentenceAttempts, ...day.patternAttempts].filter(a => a.result !== 'skip');
  const sentenceTotal = sentenceAttempts.length;
  const sentenceSectionHtml = sentenceTotal ? `<div class="history-panel">
    <div class="history-panel-title"><strong>Sentence & Pattern summary</strong><span>${sentenceTotal} action${sentenceTotal !== 1 ? 's' : ''}</span></div>
    <div class="srs-grid">
      <div class="srs-cell">
        <div class="srs-cell-val">${day.sentenceIds.length}</div>
        <div class="srs-cell-lbl">Sentences learned</div>
        <div class="srs-cell-sub">added on this day</div>
      </div>
      <div class="srs-cell">
        <div class="srs-cell-val">${day.sentencePracticeCount + day.patternPracticeCount}</div>
        <div class="srs-cell-lbl">Practice reps</div>
        <div class="srs-cell-sub">sentences & patterns</div>
      </div>
      <div class="srs-cell">
        <div class="srs-cell-val">${day.accuracy}%</div>
        <div class="srs-cell-lbl">Sentence recall</div>
        <div class="srs-cell-sub">${day.got} got · ${day.again} again</div>
      </div>
    </div>
  </div>` : '';

  return `${ratingBreakdownHtml}${sentenceSectionHtml}`;
}

function renderHistoryDay() {
  const key = normalizeDateKey(V.historyDay);
  if (!key) { V.progressTab = 'activity'; return renderProgress(); }

  const day = getHistoryDaySummary(key);
  const sents = day.sentenceIds.map(id => historySentence(id)).filter(Boolean);
  const missedPatternIds = historyValidPatternIds(day.patternAttempts.filter(a => a.result === 'again').map(a => a.id));
  const hasActivity = day.activityCount > 0 || day.sentenceAttempts.length > 0 || day.patternAttempts.length > 0 || day.frequencyAttempts.length > 0 || day.vocabLearnedCount > 0;
  const accuracyLabel = day.got + day.again ? `${day.accuracy}%` : '0%';
  const vocabAccuracyLabel = day.vocabGot + day.vocabAgain ? `${day.vocabAccuracy}%` : '0%';

  const dayActions = [
    day.vocabLearnedEntries.length ? `<button class="history-inline-btn primary" onclick="startFrequencyPractice({ids:${idsArg(day.vocabLearnedIds)},mode:'free'})" type="button">Practice day's vocab (${day.vocabLearnedEntries.length})</button>` : '',
    sents.length ? `<button class="history-inline-btn primary" onclick="startPractice({ids:${idsArg(day.sentenceIds)},skipSessionFilter:true})" type="button">Practice day's sentences (${sents.length})</button>` : '',
    day.missedSentenceIds.length ? `<button class="history-inline-btn" onclick="startPractice({ids:${idsArg(day.missedSentenceIds)},skipSessionFilter:true})" type="button">Retry misses (${day.missedSentenceIds.length})</button>` : '',
    missedPatternIds.length ? `<button class="history-inline-btn" onclick="startPatternPractice({ids:${idsArg(missedPatternIds)}})" type="button">Retry patterns (${missedPatternIds.length})</button>` : '',
  ].filter(Boolean).join('');

  const hero = `<div class="history-day-hero">
    <div class="history-day-hero-label">${esc(day.label)}</div>
    <div class="history-day-hero-title">${esc(day.fullDateStr)}</div>
    <div class="history-row-metrics">
      ${day.vocabLearnedCount ? `<span class="history-pill green">${day.vocabLearnedCount} vocab learned</span>` : ''}
      ${day.frequencyPracticeCount ? `<span class="history-pill blue">${day.frequencyPracticeCount} vocab reps</span>` : ''}
      ${day.sentenceIds.length ? `<span class="history-pill green">${day.sentenceIds.length} sents learned</span>` : ''}
      ${day.sentencePracticeCount ? `<span class="history-pill blue">${day.sentencePracticeCount} sents reps</span>` : ''}
      ${day.reviews ? `<span class="history-pill amber">${day.reviews} reviews</span>` : ''}
      ${day.vocabGot + day.vocabAgain > 0 ? `<span class="history-pill${day.vocabAccuracy < 70 ? ' red' : ''}">${vocabAccuracyLabel} vocab recall</span>` : ''}
      ${day.got + day.again > 0 ? `<span class="history-pill${day.accuracy < 70 ? ' red' : ''}">${accuracyLabel} sentence recall</span>` : ''}
    </div>
    ${historyTopicPills(day.topTopics, 5)}
  </div>`;

  if (!hasActivity) {
    return `<button class="back-btn" onclick="backToActivity()">← Progress</button>
      ${hero}
      <div class="empty-state"><div class="empty-icon">${ICO.inbox}</div>No activity recorded for this day.</div>`;
  }

  return `<button class="back-btn" onclick="backToActivity()">← Progress</button>
    ${hero}
    ${dayActions ? `<div class="history-day-actions">${dayActions}</div>` : ''}
    ${renderHistoryDayStatsDashboard(day)}`;
}

if (window.addEventListener) {
  window.addEventListener('popstate', () => { applyUrlState(); render(); });
}

// Static chrome (sidebar, header, mobile nav) declares icons via data-icon.
function hydrateIcons(scope = document) {
  scope.querySelectorAll('[data-icon]').forEach(el => {
    const markup = ICO[el.dataset.icon];
    if (markup) el.innerHTML = markup;
  });
}

// ─── DAILY REVIEW REMINDER ───────────────────
function dismissReviewReminder() {
  markReviewPromptSeen();
  const el = document.getElementById('review-reminder');
  if (el) el.remove();
}

function startReviewFromReminder() {
  markReviewPromptSeen();
  const el = document.getElementById('review-reminder');
  if (el) el.remove();
  startFrequencyPractice({ ids: getFreqReviewIds(), mode: 'due' });
}

function maybeShowReviewReminder() {
  if (!shouldPromptReview()) return;
  const dueCount = getFreqReviewIds().length;
  const ov = document.createElement('div');
  ov.id = 'review-reminder';
  ov.className = 'modal-overlay';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-labelledby', 'review-reminder-title');
  ov.innerHTML = `<div class="modal-box">
  <div class="modal-title" id="review-reminder-title">${dueCount} word${dueCount !== 1 ? 's' : ''} due for review</div>
  <div class="modal-sub">Spaced repetition works best when you clear the queue every day. This reminder only shows once per day.</div>
  <div class="btn-row">
    <button class="btn btn-primary" onclick="startReviewFromReminder()" type="button">${ICO.target} Practice now</button>
    <button class="btn btn-ghost" onclick="dismissReviewReminder()" type="button">Not today</button>
  </div>
</div>`;
  ov.addEventListener('click', e => { if (e.target === ov) dismissReviewReminder(); });
  document.body.appendChild(ov);
  const btn = ov.querySelector('.btn-primary');
  if (btn) btn.focus();
}

if (!window.__DD_SKIP_AUTO_INIT) {
  hydrateIcons();
  load().then(() => { applyUrlState(); commitState({ replace: true }); maybeShowReviewReminder(); });
}
