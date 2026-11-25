/*
 * PadKey - bridge (isolated content script).
 * Passes settings from chrome.storage to the page script, and lets the
 * popup read state / send commands to the page.
 */
(function () {
  'use strict';
  const EXT = 'padkey-ext';
  const PAGE = 'padkey-page';
  const DEFAULTS = { autoOn: true, mode: 'racing', mouseSens: 0.15, hud: true };

  let lastState = { on: false, mode: 'racing', stream: false };

  const toPage = (msg) => window.postMessage(Object.assign({ src: EXT }, msg), location.origin);

  function sendSettings() {
    chrome.storage.sync.get(DEFAULTS, (s) => toPage({ type: 'settings', settings: s }));
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.src !== PAGE) return;
    if (e.data.type === 'state') lastState = e.data.state;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') sendSettings();
  });

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (!msg || !msg.type) return;
    if (msg.type === 'toggle' || msg.type === 'setMode') {
      toPage(msg);
      setTimeout(() => reply(lastState), 120);
      return true;
    }
    if (msg.type === 'getState') {
      toPage({ type: 'getState' });
      setTimeout(() => reply(lastState), 60);
      return true;
    }
  });

  sendSettings();
  // The page script may start after us on slow loads; resend once.
  setTimeout(sendSettings, 1500);
})();
