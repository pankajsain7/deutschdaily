// The session cookie is copied by Safari when it adds a new Home Screen web app.
const lidSync = (() => {
  const endpoint = '/api/lid-progress';
  const headers = { 'X-DeutschDaily-Sync': '1' };
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const pick = (base, local, remote) => equal(base, local) ? remote : local;
  const practices = data => [data.practice, ...data.parkedPractices].filter(Boolean);

  /** The rounds grow by ID. Only fields that can change in place need a local baseline. */
  function baselineOf({ practice, parkedPractices, exam, savedQuestionIds }) {
    return { practice, parkedPractices, exam, savedQuestionIds };
  }

  function mergePractices(base, local, remote) {
    const index = data => new Map(practices(data).map(practice => [practice.id, practice]));
    const original = index(base);
    const here = index(local);
    const there = index(remote);
    const localFirst = base.practice?.id !== local.practice?.id;
    const ids = new Set([...(localFirst ? here.keys() : there.keys()), ...here.keys(), ...there.keys()]);
    const candidates = [];
    for (const id of ids) {
      const localPractice = here.get(id);
      const remotePractice = there.get(id);
      const primary = pick(original.get(id), localPractice, remotePractice);
      if (!primary) continue;
      candidates.push(primary);
      // The other cursor can match a round with more answers merged from that copy.
      const alternate = primary === localPractice ? remotePractice : localPractice;
      if (alternate && !equal(primary, alternate)) candidates.push(alternate);
    }
    return candidates;
  }

  function mergeExam(base, local, remote) {
    if (!local || !remote || local.id !== remote.id) return pick(base, local, remote);
    const previous = base?.id === local.id ? base : null;
    return {
      ...remote,
      index: pick(previous?.index ?? 0, local.index, remote.index),
      selections: local.selections.map((choice, i) => pick(previous?.selections[i] ?? null, choice, remote.selections[i])),
    };
  }

  /** @param {ReturnType<typeof baselineOf>} base @param {LiDData} local @param {LiDData} remote */
  function mergeProgress(base, local, remote) {
    const previousBookmarks = new Set(base.savedQuestionIds);
    const currentBookmarks = new Set(local.savedQuestionIds);
    const added = local.savedQuestionIds.filter(id => !previousBookmarks.has(id));
    const retained = remote.savedQuestionIds.filter(id => !previousBookmarks.has(id) || currentBookmarks.has(id));
    const [practice, ...parkedPractices] = mergePractices(base, local, remote);
    return LiDLearning.readData({
      version: 1,
      rounds: LiDLearning.mergeRounds(remote.rounds, local.rounds),
      practice,
      parkedPractices,
      exam: mergeExam(base.exam, local.exam, remote.exam),
      savedQuestionIds: [...new Set([...added, ...retained])],
    });
  }

  let connected = false;
  let unavailable = false;
  let connecting = false;
  let pendingConnection = false;
  let runAgain = false;
  let timer;

  function status(message) {
    const element = document.getElementById('app-sync-status');
    element.textContent = message;
    element.hidden = !message;
  }

  function request(path, options) {
    return fetch(path, { ...options, cache: 'no-store', signal: AbortSignal.timeout(8000) });
  }

  async function exchange(create) {
    const response = await request(create ? endpoint + '?connect=1' : endpoint, { headers });
    if (response.status === 204) return;
    if (response.status === 503) {
      unavailable = true;
      status('Die Synchronisierung ist derzeit nicht verfügbar. Dein Lernstand bleibt auf diesem Gerät gespeichert.');
      return;
    }
    if (!response.ok) throw new Error('Lernstand konnte nicht geladen werden');
    connected = true;
    unavailable = false;
    const { profile, revision, data } = await response.json();
    const remote = data === null ? LiDLearning.blank() : LiDLearning.readData(data);
    if (!remote) throw new Error('Ungültiger Lernstand auf dem Server');
    const local = LiDStore.read();
    const cached = LiDStore.baseline();
    const base = revision && cached?.profile === profile ? cached.progress : baselineOf(LiDLearning.blank());
    const merged = mergeProgress(base, local, remote);

    if (!equal(remote, merged)) {
      const saved = await request(endpoint, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision, data: merged }),
      });
      if (saved.status === 409) return false;
      if (!saved.ok) throw new Error('Lernstand konnte nicht synchronisiert werden');
    }

    const synced = { profile, progress: baselineOf(merged) };
    const saved = await LiDStore.update(current => {
      const latest = mergeProgress(baselineOf(local), current, merged);
      return equal(current, latest) ? current : latest;
    }, { synced: equal(cached, synced) ? cached : synced });
    if (!equal(saved, merged)) runAgain = true;
    status('Der Lernstand wird zwischen Safari und der Home-Bildschirm-App synchronisiert.');
    return true;
  }

  async function sync() {
    if (connecting) {
      runAgain = true;
      return;
    }
    if (navigator.onLine === false) {
      if (connected || pendingConnection) status('Der Lernstand wird bei der nächsten Internetverbindung synchronisiert.');
      return;
    }
    connecting = true;
    const create = pendingConnection;
    pendingConnection = false;
    try {
      const run = async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          if (await exchange(create) !== false) return;
        }
        throw new Error('Der Lernstand wird gerade auf einem anderen Gerät aktualisiert');
      };
      if (navigator.locks?.request) await navigator.locks.request('dd-lid-sync', run);
      else await run();
    } catch {
      if (create && !connected) pendingConnection = true;
      if (connected || create) status('Synchronisierung unterbrochen. Dein Lernstand bleibt auf diesem Gerät gespeichert.');
    } finally {
      connecting = false;
      if (runAgain) {
        runAgain = false;
        schedule();
      }
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => { void sync(); }, 600);
  }

  function start() {
    window.addEventListener('dd-lid-change', () => {
      if (connected || pendingConnection) schedule();
    });
    window.addEventListener('online', () => { void sync(); });
    window.addEventListener('pageshow', () => { if (!unavailable) schedule(); });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !unavailable) schedule();
    });
    void sync();
  }

  function connect() {
    pendingConnection = true;
    status('Synchronisierung wird vorbereitet …');
    return sync();
  }

  return { start, connect, mergeProgress, baselineOf };
})();
