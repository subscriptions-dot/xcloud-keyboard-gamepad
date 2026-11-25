// ==UserScript==
// @name         xCloud Keyboard Gamepad
// @namespace    https://github.com/subscriptions-dot/xcloud-keyboard-gamepad
// @version      2.2.0
// @description  Play any Xbox Cloud Gaming game (play.xbox.com) with keyboard and mouse. Adds a virtual controller, no real gamepad needed.
// @license      MIT
// @match        https://play.xbox.com/*
// @match        https://www.xbox.com/*/play*
// @run-at       document-start
// @grant        none
// @homepageURL  https://github.com/subscriptions-dot/xcloud-keyboard-gamepad
// @downloadURL  https://raw.githubusercontent.com/subscriptions-dot/xcloud-keyboard-gamepad/main/xcloud-keyboard-gamepad.user.js
// @updateURL    https://raw.githubusercontent.com/subscriptions-dot/xcloud-keyboard-gamepad/main/xcloud-keyboard-gamepad.user.js
// ==/UserScript==

/*
 * How it works (play.xbox.com, 2026 client):
 *  1. navigator.getGamepads() is patched to also return a virtual
 *     "standard" Xbox 360 pad whose state comes from the keyboard/mouse.
 *  2. The Xbox UI only tracks gamepads for a window that got a 'focus'
 *     event, so one is dispatched when the pad is switched on.
 *  3. The stream client (WebRtcStreamV1) does NOT poll; it listens for
 *     Chrome's 'gamepadrawinputchanged' event. The script dispatches that
 *     event with the virtual pad on every key change and every frame.
 *  4. Mapped keys are stopped (stopImmediatePropagation) so the Xbox page
 *     does not also treat them as keyboard UI navigation.
 *
   * Auto ON when a game starts. Keys: ` (key left of 1, or §) = ON/OFF     \ (backslash) = racing / shooter mode
 */
(function () {
  'use strict';
  if (window.__xkgp) return;
  window.__xkgp = true;

  const PAD_ID = 'Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)';
  // ` key on US keyboards; § key (same place) on Indian/UK Mac keyboards
  const TOGGLE_KEYS = ['Backquote', 'IntlBackslash'];
  const MODE_KEY = 'Backslash';
  const MOUSE_SENS = 0.15;

  // Standard gamepad button indexes
  const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

  // Arrow keys work exactly like W A S D (left stick, and gas/brake in racing).
  // D-pad is on I J K L.
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
  const held = (list) => list.some((k) => S.keys.has(k));

  const S = { on: false, mode: 'racing', rx: 0, ry: 0, keys: new Set(), lmb: false, rmb: false };
  const table = () => Object.assign({}, COMMON, S.mode === 'racing' ? RACING : SHOOTER);
  const isMapped = (code) => code in table() || STICK_KEYS.includes(code);
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  const btn = (v) => ({ pressed: v > 0.5, touched: v > 0, value: v });

  // ---------- toast ----------
  function toast(msg) {
    try {
      let t = document.getElementById('__xkgp_toast');
      if (!t) {
        t = document.createElement('div');
        t.id = '__xkgp_toast';
        t.style.cssText = 'position:fixed;left:50%;bottom:40px;transform:translateX(-50%);background:#107c10;color:#fff;padding:10px 18px;border-radius:6px;font:600 15px "Segoe UI",Arial,sans-serif;z-index:2147483647;pointer-events:none;transition:opacity .3s';
        (document.body || document.documentElement).appendChild(t);
      }
      t.textContent = msg;
      t.style.opacity = '1';
      clearTimeout(t._h);
      t._h = setTimeout(() => { t.style.opacity = '0'; }, 2500);
    } catch (e) { /* ignore */ }
  }

  // ---------- virtual pad ----------
  let ts = 0;
  function build(index) {
    const tb = table();
    const b = new Array(17).fill(0);
    S.keys.forEach((code) => { if (code in tb) b[tb[code]] = 1; });
    if (S.mode === 'shooter') { if (S.lmb) b[B.RT] = 1; if (S.rmb) b[B.LT] = 1; }

    // Up/down also move the stick in racing mode, so menus work with W/S and arrows.
    let lx = (held(RIGHT_KEYS) ? 1 : 0) - (held(LEFT_KEYS) ? 1 : 0);
    let ly = (held(DOWN_KEYS) ? 1 : 0) - (held(UP_KEYS) ? 1 : 0);
    // Shooter: keep diagonal walk speed even. Racing: keep full steering
    // while gas/brake is held.
    const m = Math.hypot(lx, ly);
    if (S.mode === 'shooter' && m > 1) { lx /= m; ly /= m; }

    return {
      __xkgp: true,
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

  function currentPad() {
    return patchedGetGamepads().find((p) => p && p.__xkgp) || null;
  }

  function dispatchPad(type) {
    const g = currentPad() || build(0);
    const e = new Event(type);
    e.gamepad = g;
    window.dispatchEvent(e);
  }

  // Stream client reads input from this event only.
  function push() {
    if (!S.on) return;
    try { dispatchPad('gamepadrawinputchanged'); } catch (e) { /* ignore */ }
  }

  function setOn(v) {
    S.on = v;
    S.keys.clear();
    S.lmb = S.rmb = false;
    S.rx = S.ry = 0;
    if (v) {
      try { window.dispatchEvent(new Event('focus')); } catch (e) { /* ignore */ }
      dispatchPad('gamepadconnected');
      push();
      toast('Keyboard gamepad ON (' + S.mode + ')   ` = off   \\ = mode');
    } else {
      if (document.pointerLockElement) document.exitPointerLock();
      const g = build(0);
      g.connected = false;
      const e = new Event('gamepaddisconnected');
      e.gamepad = g;
      window.dispatchEvent(e);
      toast('Keyboard gamepad OFF');
    }
  }

  // The stream client re-reads connected pads on window 'focus'
  // (reconcileAndSend). A stream that starts after the pad was switched on
  // shows "Controller Disconnected" until that happens, so repeat it.
  // Also: switch ON automatically when a game stream page opens, unless the
  // user switched it OFF by hand on this stream.
  let userOff = false;
  const onStreamPage = () => /\/(stream|launch)\//.test(location.pathname);
  setInterval(() => {
    if (!onStreamPage()) { userOff = false; return; }
    if (!S.on && !userOff) setOn(true);
    if (!S.on) return;
    try { window.dispatchEvent(new Event('focus')); } catch (e) { /* ignore */ }
  }, 2000);

  // ---------- keyboard ----------
  window.addEventListener('keydown', (e) => {
    if (TOGGLE_KEYS.includes(e.code)) {
      setOn(!S.on);
      userOff = !S.on;
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (!S.on) return;
    if (e.code === MODE_KEY) {
      S.mode = S.mode === 'racing' ? 'shooter' : 'racing';
      S.keys.clear();
      if (S.mode === 'racing' && document.pointerLockElement) document.exitPointerLock();
      toast('Mode: ' + S.mode + (S.mode === 'shooter' ? '  (click screen = mouse look)' : ''));
      e.preventDefault();
      e.stopImmediatePropagation();
      push();
      return;
    }
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

  // ---------- mouse (shooter mode) ----------
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
    S.rx += e.movementX * MOUSE_SENS;
    S.ry += e.movementY * MOUSE_SENS;
  }, true);

  // ---------- frame loop: stick decay + keep stream fed ----------
  (function frame() {
    S.rx *= 0.6;
    S.ry *= 0.6;
    if (Math.abs(S.rx) < 0.01) S.rx = 0;
    if (Math.abs(S.ry) < 0.01) S.ry = 0;
    push();
    requestAnimationFrame(frame);
  })();
})();
