window.Hospital = window.Hospital || {};

Hospital.AudioManager = class {
  static icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="audio-waves" d="M16 8a6 6 0 0 1 0 8 M19 5a10 10 0 0 1 0 14"/><path class="audio-slash" d="m16 9 6 6 m0-6-6 6"/></svg>';

  static control(className = '') {
    return `<button type="button" class="audio-toggle ${className}" data-audio-toggle aria-label="Выключить звук" title="Выключить звук" aria-pressed="false">${this.icon}</button>`;
  }

  constructor() {
    this.unlocked = false;
    this.muted = false;
    try { this.muted = localStorage.getItem('hospital-bug-audio-muted') === 'true'; } catch { /* Sound still works without storage. */ }
    this.music = this.track('assets/audio/soundtrack.mp3', .24, true, 'metadata');
    this.windowSound = this.track('assets/audio/open-window.mp3', .55, false);
    // Start from a user gesture so browsers can allow music and later game effects.
    const unlockFromInput = event => {
      if (!event.target.closest?.('[data-audio-toggle]')) this.unlock();
    };
    document.addEventListener('pointerdown', unlockFromInput, true);
    document.addEventListener('keydown', unlockFromInput, true);
    document.addEventListener('visibilitychange', () => this.sync());
    window.addEventListener('pagehide', () => this.pauseAll());
    window.addEventListener('pageshow', () => this.sync());
    document.addEventListener('click', event => {
      if (event.target.closest?.('[data-audio-toggle]')) this.toggle();
    });
    this.refreshControls();
  }

  track(source, volume, loop, preload = 'auto') {
    const track = new Audio(source);
    track.preload = preload;
    track.volume = volume;
    track.loop = loop;
    return track;
  }

  play(track) {
    if (!this.unlocked || this.muted || document.hidden || !track.paused) return;
    try { track.play()?.catch(() => {}); } catch { /* An unavailable track must not stop the game. */ }
  }

  unlock() {
    this.unlocked = true;
    this.sync();
  }

  pauseAll() {
    for (const track of [this.music, this.windowSound]) track.pause();
  }

  sync() {
    if (!this.unlocked || this.muted || document.hidden) { this.pauseAll(); return; }
    this.play(this.music);
  }

  openWindow() {
    if (!this.unlocked || this.muted || document.hidden) return;
    this.windowSound.pause();
    this.windowSound.currentTime = 0;
    this.play(this.windowSound);
  }

  toggle() {
    this.muted = !this.muted;
    try { localStorage.setItem('hospital-bug-audio-muted', String(this.muted)); } catch { /* Keep the setting for this visit. */ }
    this.unlock();
    this.refreshControls();
  }

  refreshControls() {
    document.querySelectorAll('[data-audio-toggle]').forEach(button => {
      if (!button.querySelector('svg')) button.innerHTML = Hospital.AudioManager.icon;
      button.classList.toggle('audio-muted', this.muted);
      button.setAttribute('aria-pressed', String(this.muted));
      const label = this.muted ? 'Включить звук' : 'Выключить звук';
      button.setAttribute('aria-label', label);
      button.title = label;
    });
  }
};
