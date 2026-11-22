(() => {
  const button = document.getElementById('app-install');
  const dialog = document.getElementById('app-install-dialog');
  if (!window.isSecureContext || !navigator.serviceWorker || typeof dialog.showModal !== 'function') return;

  const workers = navigator.serviceWorker;
  const status = document.getElementById('app-offline-status');
  const retry = document.getElementById('app-offline-retry');
  const guide = document.getElementById('app-install-guide');
  const steps = document.getElementById('app-install-steps');
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
  let prompting = false;
  let requestId = 0;

  const appMode = () => standalone.matches || navigator.standalone === true;
  const canPrompt = () => !appleMobile && (typeof navigator.install === 'function' || Boolean(installPrompt));

  function updateInstallGuide() {
    const app = appMode();
    guide.hidden = app || installed;
    if (guide.hidden || !canPrompt()) button.setAttribute('aria-haspopup', 'dialog');
    else button.removeAttribute('aria-haspopup');
    button.textContent = guide.hidden ? 'Offline-App' : appleMobile ? 'Zum Home-Bildschirm' : 'App installieren';
    if (appleMobile) {
      steps.textContent = 'In Safari „Teilen“ und „Zu Home-Bildschirm hinzufügen“ wählen. Falls angezeigt, „Als Web-App öffnen“ aktivieren. Öffne die App einmal online und prüfe unter „Offline-App“, ob sie bereit ist.';
    } else if (android) {
      steps.textContent = 'Wähle im Chrome-Menü „App installieren“ oder „Zum Startbildschirm hinzufügen“. Öffne die App einmal online und prüfe den Download unter „Offline-App“.';
    } else {
      steps.textContent = 'Wähle im Browsermenü „App installieren“. In Safari auf dem Mac findest du „Zum Dock hinzufügen“ im Menü „Ablage“.';
    }
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

  function openOptions() {
    dialog.showModal();
    if (status.hasAttribute('data-ready')) void refreshOffline();
    if (appleMobile && !appMode()) void lidSync.connect();
  }

  button.addEventListener('click', async () => {
    if (prompting) return;
    if (appMode() || installed || !canPrompt()) {
      openOptions();
      return;
    }
    prompting = true;
    try {
      if (installPrompt) {
        const prompt = installPrompt;
        installPrompt = null;
        await prompt.prompt();
        installed = installed || (await prompt.userChoice).outcome === 'accepted';
      } else {
        await navigator.install();
        installed = true;
      }
    } catch (error) {
      if (error.name !== 'AbortError') openOptions();
    } finally {
      prompting = false;
      updateInstallGuide();
    }
  });
  retry.addEventListener('click', () => { void prepareOffline(true); });

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
  if (appleMobile) lidSync.start();
  if (appMode()) requestPersistentStorage();
  void prepareOffline();
})();
