// Virtual clock for frame-by-frame recording. Injected before any page script runs.
// Replaces performance.now, Date.now, timers and requestAnimationFrame with versions that only move
// when the recorder calls window.__vt.step(ms). CSS transitions and animations are paused and seeked
// to the same clock (window.__vt.syncCss). So every recorded frame is exact, however slow the
// software-rendered WebGL is in the recording container.
(() => {
  const realNow = performance.now.bind(performance);
  const realDateNow = Date.now;
  const dateBase = realDateNow();
  let now = 0; // virtual ms since page start
  let seq = 1;
  const timers = new Map(); // id -> { at, fn, args, every }
  let rafQ = new Map();

  performance.now = () => now;
  Date.now = () => dateBase + Math.round(now);

  const addTimer = (fn, ms, args, every) => {
    const id = seq++;
    const d = Math.max(0, Number(ms) || 0);
    timers.set(id, { at: now + d, fn, args, every: every ? Math.max(1, d) : 0, order: id });
    return id;
  };
  window.setTimeout = (fn, ms, ...args) => addTimer(fn, ms, args, false);
  window.setInterval = (fn, ms, ...args) => addTimer(fn, ms, args, true);
  window.clearTimeout = (id) => void timers.delete(id);
  window.clearInterval = (id) => void timers.delete(id);
  window.requestAnimationFrame = (cb) => {
    const id = seq++;
    rafQ.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = (id) => void rafQ.delete(id);

  const call = (fn, args) => {
    try {
      if (typeof fn === 'function') fn(...(args || []));
    } catch (e) {
      console.error('[vclock] callback threw', e);
    }
  };

  /** Run every timer due at or before `until`, in time order, moving the clock as we go. */
  const runTimers = (until) => {
    for (let guard = 0; guard < 10000; guard++) {
      let next = null;
      for (const [id, t] of timers) if (t.at <= until && (!next || t.at < next[1].at || (t.at === next[1].at && t.order < next[1].order))) next = [id, t];
      if (!next) break;
      const [id, t] = next;
      now = Math.max(now, t.at);
      if (t.every) {
        t.at += t.every;
        t.order = seq++;
      } else timers.delete(id);
      call(t.fn, t.args);
    }
    now = Math.max(now, until);
  };

  // deck.gl draws from luma.gl's AnimationLoop callback ("bound _animationFrame"). The recorder runs the
  // app's own callbacks on every 60 Hz tick but lets deck.gl draw once per recorded frame, after React
  // has committed, so the canvas and the DOM overlays (labels, dots) always show the same instant.
  const isDraw = (cb) => typeof cb === 'function' && /_animationFrame/.test(cb.name || '');
  const runRaf = (want) => {
    let n = 0;
    const keep = new Map();
    const q = rafQ;
    rafQ = new Map();
    for (const [id, cb] of q) {
      if (want(cb)) {
        call(cb, [now]);
        n++;
      } else keep.set(id, cb);
    }
    for (const [id, cb] of rafQ) keep.set(id, cb); // registered while running
    rafQ = keep;
    return n;
  };

  const seen = new WeakMap();
  window.__vt = {
    get now() {
      return now;
    },
    realNow,
    /** Advance the clock by ms, firing due timers, then run the app's animation-frame callbacks. */
    step(ms) {
      runTimers(now + ms);
      return runRaf((cb) => !isDraw(cb));
    },
    /** Let deck.gl draw the current state (no clock change). */
    draw() {
      return runRaf(isDraw);
    },
    /** Run every queued callback at the current time (boot only). */
    raf() {
      return runRaf(() => true);
    },
    /** Pause every CSS transition/animation and seek it to the virtual clock. */
    syncCss() {
      for (const a of document.getAnimations()) {
        let t0 = seen.get(a);
        if (t0 === undefined) {
          t0 = now;
          seen.set(a, t0);
        }
        try {
          if (a.playState !== 'paused') a.pause();
          a.currentTime = now - t0;
        } catch {
          /* finished animations can refuse; ignore */
        }
      }
    },
    pending() {
      return { timers: timers.size, raf: rafQ.size };
    },
  };
})();
