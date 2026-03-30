/**
 * Lightweight game audio via Web Audio API (no external files).
 * Requires a user gesture before browsers allow sound; unlock() runs on first tap.
 */
(function () {
  const STORAGE_KEY = "pgSoundOn";
  let ctx = null;
  let unlocked = false;

  function isOn() {
    return localStorage.getItem(STORAGE_KEY) !== "0";
  }

  function setOn(on) {
    localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
    window.dispatchEvent(new CustomEvent("pgsoundchange", { detail: { on } }));
  }

  function unlock() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    unlocked = true;
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  function tone(freq, duration, vol, type = "sine", when = 0) {
    if (!isOn() || !ctx) return;
    const t0 = now() + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + duration + 0.04);
  }

  function playQuestionStart() {
    if (!isOn() || !ctx) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.11, 0.11, "sine", i * 0.09));
  }

  function playAnswerTap() {
    tone(880, 0.06, 0.08, "triangle", 0);
  }

  function playAnswerLock() {
    if (!isOn() || !ctx) return;
    tone(392, 0.08, 0.1, "sine", 0);
    tone(523.25, 0.12, 0.09, "sine", 0.07);
  }

  function playTimerPing(secondsLeftCeil) {
    const base = 600 + (4 - Math.min(3, Math.max(1, secondsLeftCeil))) * 180;
    tone(base, 0.07, 0.09, "square", 0);
  }

  function playReveal() {
    if (!isOn() || !ctx) return;
    [392, 493.88, 587.33, 783.99, 987.77].forEach((f, i) => tone(f, 0.14, 0.1, "sine", i * 0.1));
  }

  function playTimeUp() {
    if (!isOn() || !ctx) return;
    tone(196, 0.2, 0.12, "sawtooth", 0);
    tone(147, 0.25, 0.1, "sawtooth", 0.12);
  }

  window.GameAudio = {
    isOn,
    setOn,
    unlock,
    playQuestionStart,
    playAnswerTap,
    playAnswerLock,
    playTimerPing,
    playReveal,
    playTimeUp,
    get unlocked() {
      return unlocked;
    },
  };

  document.addEventListener(
    "click",
    () => {
      unlock();
    },
    { once: true, capture: true }
  );
  document.addEventListener(
    "touchstart",
    () => {
      unlock();
    },
    { once: true, capture: true }
  );
})();
