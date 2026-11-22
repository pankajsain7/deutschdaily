(() => {
  const button = document.getElementById('app-install');
  const dialog = document.getElementById('app-install-dialog');
  if (!window.isSecureContext || !navigator.serviceWorker || typeof dialog.showModal !== 'function') return;

  const workers = navigator.serviceWorker;
  const status = document.getElementById('app-offline-status');
  const retry = document.getElementById('app-offline-retry');
  const guide = document.getElementById('app-install-guide');
  const steps = document.getElementById('app-install-steps');
  const install = document.getElementById('app-install-native');
  const backupNote = document.getElementById('app-backup-note');
  const fileInput = document.getElementById('app-backup-file');
  const backupError = document.getElementById('app-backup-error');
  const standalone = window.matchMedia('(display-mode: standalone)');
  const appleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/.test(navigator.userAgent);

  /** @type {ServiceWorkerRegistration | undefined} */
  let registration;
  /** @type {(Event & { prompt(): Promise<unknown>, userChoice: Promise<{ outcome: string }> }) | null} */
  let installPrompt = null;
  let installed = false;
  let requestId = 0;

  const appMode = () => standalone.matches || navigator.standalone === true;

  function updateInstallGuide() {
    const app = appMode();
    guide.hidden = app || installed;
    install.hidden = !installPrompt || guide.hidden;
    button.textContent = guide.hidden ? 'Offline-App' : 'App installieren';
    steps.textContent = appleMobile
      ? 'In Safari „Teilen“ und „Zu Home-Bildschirm hinzufügen“ wählen. Falls angezeigt, „Als Web-App öffnen“ aktivieren. Öffne die App einmal online und prüfe unter „Offline-App“, ob sie bereit ist.'
      : installPrompt
        ? 'Installiere DeutschDaily und öffne die App einmal online. Unter „Offline-App“ siehst du, wann du offline üben kannst.'
        : android
          ? 'Wähle im Chrome-Menü „App installieren“ oder „Zum Startbildschirm hinzufügen“. Öffne die App einmal online und prüfe den Download unter „Offline-App“.'
          : 'Wähle im Browsermenü „App installieren“. In Safari auf dem Mac findest du „Zum Dock hinzufügen“ im Menü „Ablage“.';
    backupNote.textContent = appleMobile && !app
      ? 'Speichere deinen bisherigen Lernstand als Datei und importiere sie nach der Installation in der App.'
      : 'Dein Lernstand wird auf diesem Gerät gespeichert. Mit einer Sicherung kannst du ihn übertragen oder wiederherstellen.';
  }

  function offlineStatus(text, { ready = false, canRetry = false } = {}) {
    status.textContent = text;
    status.toggleAttribute('data-ready', ready);
    retry.hidden = !canRetry;
  }

  const preparing = () => offlineStatus('Offline-Inhalte werden vorbereitet …');
  const failed = () => offlineStatus('Offline-Inhalte konnten nicht geladen werden. Prüfe deine Internetverbindung und versuche es erneut.', { canRetry: true });

  /** @param {ServiceWorker} worker @param {boolean} repair @returns {Promise<boolean>} */
  function checkCache(worker, repair) {
    return new Promise(resolve => {
      const { port1, port2 } = new MessageChannel();
      const finish = ready => {
        clearTimeout(timeout);
        port1.close();
        resolve(ready === true);
      };
      const timeout = setTimeout(() => finish(false), repair ? 30_000 : 1_500);
      port1.onmessage = event => finish(event.data);
      try {
        worker.postMessage(repair ? 'dd-offline-repair' : 'dd-offline-status', [port2]);
      } catch {
        port2.close();
        finish(false);
      }
    });
  }

  async function refreshOffline(repair = false) {
    const id = ++requestId;
    const worker = workers.controller;
    const available = worker ? await checkCache(worker, repair) : false;
    if (id !== requestId) return;
    if (registration?.waiting && worker) {
      offlineStatus(available
        ? 'Offline bereit. Öffne DeutschDaily erneut, sobald alle DeutschDaily-Fenster geschlossen sind, um das Update zu übernehmen.'
        : 'Offline-Inhalte geladen. Schließe alle DeutschDaily-Fenster und öffne die App erneut, um sie zu aktivieren.', { ready: available });
    } else if (available) {
      offlineStatus('Offline bereit. Alle 310 Fragen mit Bildern und der Probetest sind gespeichert.', { ready: true });
    } else if ((registration?.installing && registration.installing.state !== 'redundant')
      || (!worker && registration?.active?.state === 'activating')) {
      preparing();
    } else {
      failed();
    }
  }

  /** @type {WeakSet<ServiceWorker>} */
  const watchedWorkers = new WeakSet();

  function watchInstall() {
    const worker = registration?.installing;
    if (!worker || watchedWorkers.has(worker)) return;
    watchedWorkers.add(worker);
    worker.addEventListener('statechange', () => {
      if (['installed', 'activated', 'redundant'].includes(worker.state)) void refreshOffline();
    });
  }

  async function prepareOffline(repair = false) {
    preparing();
    try {
      if (!registration || (repair && !registration.active && !registration.waiting)) {
        registration = await workers.register('/sw.js', { updateViaCache: 'none' });
        registration.addEventListener('updatefound', watchInstall);
      }
      if (repair && !registration.installing && !registration.waiting && registration.active) {
        // A retry can restore missing assets from the current worker even if checking for an update fails.
        void registration.update().catch(() => {});
      }
      watchInstall();
      await refreshOffline(repair);
    } catch {
      failed();
    }
  }

  function requestPersistentStorage() {
    void navigator.storage?.persist?.().catch(() => {});
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    updateInstallGuide();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    installPrompt = null;
    updateInstallGuide();
    requestPersistentStorage();
  });
  standalone.addEventListener?.('change', () => {
    updateInstallGuide();
    if (appMode()) requestPersistentStorage();
  });
  workers.addEventListener('controllerchange', () => { void refreshOffline(); });

  button.addEventListener('click', () => {
    dialog.showModal();
    if (status.hasAttribute('data-ready')) void refreshOffline();
  });
  retry.addEventListener('click', () => { void prepareOffline(true); });
  install.addEventListener('click', async () => {
    const prompt = installPrompt;
    if (!prompt) return;
    installPrompt = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') installed = true;
    } catch {
      // Some browsers withdraw the prompt. Leave the browser-menu instructions available.
    } finally {
      updateInstallGuide();
    }
  });

  document.getElementById('app-backup-export').addEventListener('click', () => {
    backupError.style.display = 'none';
    try {
      downloadBackupFile();
    } catch {
      backupError.textContent = 'Die Sicherungsdatei konnte nicht erstellt werden.';
      backupError.style.display = 'block';
    }
  });
  document.getElementById('app-backup-import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const [file] = fileInput.files;
    if (!file) return;
    backupError.style.display = 'none';
    try {
      if (await applyImport(await file.text(), backupError)) dialog.close();
    } catch {
      backupError.textContent = 'Die Sicherungsdatei konnte nicht gelesen oder gespeichert werden.';
      backupError.style.display = 'block';
    } finally {
      fileInput.value = '';
    }
  });

  updateInstallGuide();
  button.hidden = false;
  if (appMode()) requestPersistentStorage();
  void prepareOffline();
})();
