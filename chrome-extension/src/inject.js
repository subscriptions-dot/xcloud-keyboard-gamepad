/*
 * PadKey - page script (runs in the page's MAIN world at document_start).
 *
 * How the Xbox Cloud Gaming web client (play.xbox.com) reads controllers:
 *  - navigator.getGamepads() is patched to add a virtual "standard" pad.
 *  - The Xbox UI only tracks pads after a window 'focus' event, and the
 *    stream re-reads connected pads on focus, so focus is re-sent every 2s.
 *  - The stream (WebRtcStreamV1) does not poll: it listens for the
 *    'gamepadrawinputchanged' event, which is dispatched on every change
 *    and every frame.
 *  - Mapped keys are stopped so the Xbox page does not also act on them.
 *
 * Settings and commands arrive from bridge.js via window.postMessage.
 */
(function () {
  'use strict';
  if (window.__padkey) return;
  window.__padkey = true;

  const EXT = 'padkey-ext';
  const PAGE = 'padkey-page';
  const PAD_ID = 'Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)';
  const TOGGLE_KEYS = ['Backquote', 'IntlBackslash'];
  const MODE_KEY = 'Backslash';

  const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

  const COMMON = {
    Enter: B.A, Backspace: B.B, Tab: B.MENU, KeyG: B.VIEW,
    KeyI: B.UP, KeyK: B.DOWN, KeyJ: B.LEFT, KeyL: B.RIGHT,
  };
  const RACING = {
    KeyW: B.RT, ArrowUp: B.RT, KeyS: B.LT, ArrowDown: B.LT,
    Space: B.A, KeyQ: B.X, KeyE: B.Y,
    ShiftLeft: B.RB, ControlLeft: B.LB, KeyR: B.RS,
  };
  const SHOOTER = {
    Space: B.A, KeyC: B.B, KeyR: B.X, KeyE: B.Y, KeyQ: B.LB, KeyF: B.RB,
    ShiftLeft: B.LS, KeyV: B.RS,
  };
  const UP_KEYS = ['KeyW', 'ArrowUp'];
  const DOWN_KEYS = ['KeyS', 'ArrowDown'];
  const LEFT_KEYS = ['KeyA', 'ArrowLeft'];
  const RIGHT_KEYS = ['KeyD', 'ArrowRight'];
  const STICK_KEYS = [].concat(UP_KEYS, DOWN_KEYS, LEFT_KEYS, RIGHT_KEYS);

  const settings = { autoOn: true, mode: 'racing', mouseSens: 0.15, hud: true };
  const S = { on: false, mode: settings.mode, rx: 0, ry: 0, keys: new Set(), lmb: false, rmb: false };
  let userOff = false;

  const held = (list) => list.some((k) => S.keys.has(k));
  const table = () => Object.assign({}, COMMON, S.mode === 'racing' ? RACING : SHOOTER);
  const isMapped = (code) => code in table() || STICK_KEYS.includes(code);
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  const btn = (v) => ({ pressed: v > 0.5, touched: v > 0, value: v });
  const onStreamPage = () => /\/(stream|launch)\//.test(location.pathname);
  const modeLabel = () => (S.mode === 'racing' ? 'Racing' : 'Shooter');

  // ---------------- UI: HUD pill + toast ----------------
  const UI = {
    root: null, pill: null, toast: null, fadeT: 0, toastT: 0,
    ensure() {
      if (this.root || !document.body) return !!this.root;
      const host = document.createElement('div');
      host.id = 'padkey-ui';
      host.style.cssText = 'all:initial;position:fixed;inset:auto;z-index:2147483647;';
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = `
        <style>
          :host { all: initial; }
          .pill { position: fixed; left: 16px; bottom: 16px; display: flex; align-items: center; gap: 8px;
            padding: 7px 12px 7px 10px; border-radius: 999px; background: rgba(16,18,20,.82);
            border: 1px solid rgba(255,255,255,.12); color: #fff; font: 600 12px/1.2 -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
            letter-spacing: .2px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
            box-shadow: 0 6px 24px rgba(0,0,0,.35); transition: opacity .4s ease, transform .4s ease; pointer-events: none; }
          .pill.dim { opacity: .28; }
          .pill.hidden { opacity: 0; transform: translateY(8px); }
          .dot { width: 8px; height: 8px; border-radius: 50%; background: #6b7280; }
          .on .dot { background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.25); }
          .muted { color: rgba(255,255,255,.6); font-weight: 500; }
          .toast { position: fixed; left: 50%; bottom: 48px; transform: translate(-50%, 10px); opacity: 0;
            padding: 10px 16px; border-radius: 10px; background: #0f7a0f; color: #fff;
            font: 600 14px/1.3 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,.4);
            transition: opacity .25s ease, transform .25s ease; pointer-events: none; white-space: nowrap; }
          .toast.show { opacity: 1; transform: translate(-50%, 0); }
          .toast.off { background: #374151; }
          kbd { display: inline-block; min-width: 14px; padding: 1px 5px; margin: 0 2px; border-radius: 4px;
            background: rgba(255,255,255,.18); font: 600 12px ui-monospace, Menlo, monospace; text-align: center; }
        </style>
        <div class="pill hidden"><span class="dot"></span><span class="txt">PadKey</span></div>
        <div class="toast"></div>`;
      document.documentElement.appendChild(host);
      this.root = host;
      this.pill = shadow.querySelector('.pill');
      this.toast = shadow.querySelector('.toast');
      return true;
    },
    render() {
      if (!this.ensure()) return;
      const show = settings.hud && (S.on || onStreamPage());
      const sig = [show, S.on, S.mode].join();
      if (sig === this.sig) return; // unchanged: let the pill stay dimmed
      this.sig = sig;
      this.pill.classList.toggle('on', S.on);
      this.pill.classList.toggle('hidden', !show);
      this.pill.querySelector('.txt').innerHTML = S.on
        ? `PadKey <span class="muted">· ${modeLabel()}</span>`
        : 'PadKey <span class="muted">· off</span>';
      this.pill.classList.remove('dim');
      clearTimeout(this.fadeT);
      this.fadeT = setTimeout(() => this.pill.classList.add('dim'), 3000);
    },
    say(html, off) {
      if (!this.ensure()) return;
      this.toast.innerHTML = html;
      this.toast.classList.toggle('off', !!off);
      this.toast.classList.add('show');
      clearTimeout(this.toastT);
      this.toastT = setTimeout(() => this.toast.classList.remove('show'), 2600);
    },
  };

  // ---------------- virtual pad ----------------
  let ts = 0;
  function build(index) {
    const tb = table();
    const b = new Array(17).fill(0);
    S.keys.forEach((code) => { if (code in tb) b[tb[code]] = 1; });
    if (S.mode === 'shooter') { if (S.lmb) b[B.RT] = 1; if (S.rmb) b[B.LT] = 1; }

    let lx = (held(RIGHT_KEYS) ? 1 : 0) - (held(LEFT_KEYS) ? 1 : 0);
    let ly = (held(DOWN_KEYS) ? 1 : 0) - (held(UP_KEYS) ? 1 : 0);
    const m = Math.hypot(lx, ly);
    if (S.mode === 'shooter' && m > 1) { lx /= m; ly /= m; }

    return {
      __padkey: true,
      id: PAD_ID,
      index,
      connected: true,
      mapping: 'standard',
      timestamp: ++ts,
      axes: [lx, ly, clamp(S.rx), clamp(S.ry)],
      buttons: b.map(btn),
      vibrationActuator: {
        type: 'dual-rumble',
        playEffect: () => Promise.resolve('complete'),
        reset: () => Promise.resolve('complete'),
      },
      hapticActuators: [],
    };
  }

  const nativeGetGamepads = navigator.getGamepads.bind(navigator);
  function patchedGetGamepads() {
    const list = Array.from(nativeGetGamepads() || []);
    if (!S.on) return list;
    let i = list.findIndex((g) => !g);
    if (i < 0) i = list.length;
    list[i] = build(i);
    return list;
  }
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: patchedGetGamepads });

  function dispatchPad(type, pad) {
    const e = new Event(type);
    e.gamepad = pad || patchedGetGamepads().find((p) => p && p.__padkey) || build(0);
    window.dispatchEvent(e);
  }

  function push() {
    if (!S.on) return;
    try { dispatchPad('gamepadrawinputchanged'); } catch (e) { /* ignore */ }
  }

  function report() {
    window.postMessage({ src: PAGE, type: 'state', state: { on: S.on, mode: S.mode, stream: onStreamPage() } }, location.origin);
  }

  function setOn(v, quiet) {
    if (S.on === v) { report(); return; }
    S.on = v;
    S.keys.clear();
    S.lmb = S.rmb = false;
    S.rx = S.ry = 0;
    if (v) {
      try { window.dispatchEvent(new Event('focus')); } catch (e) { /* ignore */ }
      dispatchPad('gamepadconnected');
      push();
      if (!quiet) UI.say(`Controller ON · ${modeLabel()} &nbsp; <kbd>\`</kbd> off &nbsp; <kbd>\\</kbd> mode`);
    } else {
      if (document.pointerLockElement) document.exitPointerLock();
      const g = build(0);
      g.connected = false;
      dispatchPad('gamepaddisconnected', g);
      if (!quiet) UI.say('Controller OFF &nbsp; <kbd>`</kbd> to turn on', true);
    }
    UI.render();
    report();
  }

  function setMode(mode) {
    if (mode !== 'racing' && mode !== 'shooter') return;
    S.mode = mode;
    S.keys.clear();
    if (mode === 'racing' && document.pointerLockElement) document.exitPointerLock();
    if (S.on) UI.say(`Mode: ${modeLabel()}${mode === 'shooter' ? ' · click the game to use the mouse' : ''}`);
    push();
    UI.render();
    report();
  }

  // ---------------- settings / commands from the extension ----------------
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.src !== EXT) return;
    const d = e.data;
    if (d.type === 'settings' && d.settings) {
      const prevMode = settings.mode;
      Object.assign(settings, d.settings);
      if (settings.mode !== prevMode) setMode(settings.mode);
      UI.render();
    } else if (d.type === 'toggle') {
      setOn(!S.on);
      userOff = !S.on;
    } else if (d.type === 'setMode') {
      setMode(d.mode);
    } else if (d.type === 'getState') {
      report();
    }
  });

  // Auto ON on game pages (checked every 0.5s so the pad exists before the
  // game asks for it), and keep the stream aware of the pad: re-send focus
  // every 2s, plus 'gamepadconnected' for the first seconds of a stream.
  let tick = 0;
  let streamTicks = 0;
  setInterval(() => {
    tick++;
    if (!onStreamPage()) { userOff = false; streamTicks = 0; }
    else {
      streamTicks++;
      if (!S.on && !userOff && settings.autoOn) setOn(true);
    }
    if (S.on) {
      if (tick % 4 === 0) { try { window.dispatchEvent(new Event('focus')); } catch (e) { /* ignore */ } }
      if (streamTicks > 0 && streamTicks <= 40 && streamTicks % 4 === 0) {
        try { dispatchPad('gamepadconnected'); } catch (e) { /* ignore */ }
      }
    }
    if (tick % 4 === 0) UI.render();
  }, 500);

  // Coming back to the tab: reconnect at once instead of waiting.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && S.on) {
      try { window.dispatchEvent(new Event('focus')); dispatchPad('gamepadconnected'); } catch (e) { /* ignore */ }
    }
  });

  // ---------------- keyboard ----------------
  window.addEventListener('keydown', (e) => {
    if (TOGGLE_KEYS.includes(e.code) && !e.metaKey && !e.ctrlKey && !e.altKey) {
      setOn(!S.on);
      userOff = !S.on;
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (!S.on) return;
    if (e.code === MODE_KEY) {
      setMode(S.mode === 'racing' ? 'shooter' : 'racing');
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (e.metaKey) return; // keep Cmd shortcuts working
    if (isMapped(e.code)) {
      S.keys.add(e.code);
      e.preventDefault();
      e.stopImmediatePropagation();
      push();
    }
  }, true);

  window.addEventListener('keyup', (e) => {
    if (!S.on) return;
    if (isMapped(e.code)) {
      S.keys.delete(e.code);
      e.preventDefault();
      e.stopImmediatePropagation();
      push();
    }
  }, true);

  window.addEventListener('blur', () => { S.keys.clear(); S.lmb = S.rmb = false; push(); });

  // ---------------- mouse (shooter mode) ----------------
  window.addEventListener('mousedown', (e) => {
    if (!S.on || S.mode !== 'shooter') return;
    if (!document.pointerLockElement) {
      try { document.documentElement.requestPointerLock(); } catch (x) { /* ignore */ }
      return;
    }
    if (e.button === 0) S.lmb = true;
    else if (e.button === 2) S.rmb = true;
    e.preventDefault();
    e.stopImmediatePropagation();
    push();
  }, true);

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) S.lmb = false;
    else if (e.button === 2) S.rmb = false;
    push();
  }, true);

  window.addEventListener('contextmenu', (e) => {
    if (S.on && S.mode === 'shooter') e.preventDefault();
  }, true);

  window.addEventListener('mousemove', (e) => {
    if (!S.on || S.mode !== 'shooter' || !document.pointerLockElement) return;
    S.rx += e.movementX * settings.mouseSens;
    S.ry += e.movementY * settings.mouseSens;
  }, true);

  // ---------------- frame loop ----------------
  (function frame() {
    S.rx *= 0.6;
    S.ry *= 0.6;
    if (Math.abs(S.rx) < 0.01) S.rx = 0;
    if (Math.abs(S.ry) < 0.01) S.ry = 0;
    push();
    requestAnimationFrame(frame);
  })();

  report();
})();
