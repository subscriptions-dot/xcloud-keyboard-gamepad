'use strict';

const DEFAULTS = { autoOn: true, mode: 'racing', mouseSens: 0.15, hud: true };
const XBOX_URL = /^https:\/\/(play\.xbox\.com\/|www\.xbox\.com\/[^/]+\/play)/;

const KEYS = {
  racing: [
    [['W', '↑'], 'Gas'],
    [['S', '↓'], 'Brake / reverse'],
    [['A', 'D', '←', '→'], 'Steer'],
    [['Space', 'Enter'], 'A · handbrake'],
    [['Backspace'], 'B · back'],
    [['E'], 'Y · rewind'],
    [['Q'], 'X'],
    [['Shift', 'Ctrl'], 'RB / LB'],
    [['Tab'], 'Pause menu'],
    [['I', 'J', 'K', 'L'], 'D-pad'],
  ],
  shooter: [
    [['W', 'A', 'S', 'D'], 'Move'],
    [['Mouse'], 'Look (click game first)'],
    [['L-click', 'R-click'], 'Fire / aim (RT / LT)'],
    [['Space'], 'A · jump'],
    [['C'], 'B · crouch'],
    [['R'], 'X · reload'],
    [['E'], 'Y'],
    [['Q', 'F'], 'LB / RB'],
    [['Shift', 'V'], 'Sprint / melee (stick clicks)'],
    [['Tab'], 'Pause menu'],
  ],
};

const $ = (id) => document.getElementById(id);
let tabId = null;
let settings = { ...DEFAULTS };

// slider 1..10 <-> sensitivity 0.03..0.30
const toSens = (v) => +(v * 0.03).toFixed(2);
const fromSens = (s) => Math.min(10, Math.max(1, Math.round(s / 0.03)));

function renderKeys() {
  const mode = settings.mode;
  $('keysMode').textContent = mode === 'racing' ? 'Racing' : 'Shooter';
  const box = $('keys');
  box.textContent = '';
  for (const [caps, act] of KEYS[mode]) {
    const row = document.createElement('div');
    row.className = 'k';
    const c = document.createElement('span');
    c.className = 'caps';
    for (const cap of caps) {
      const k = document.createElement('kbd');
      k.textContent = cap;
      c.appendChild(k);
    }
    const a = document.createElement('span');
    a.className = 'act';
    a.textContent = act;
    row.append(c, a);
    box.appendChild(row);
  }
}

function renderSettings() {
  for (const b of document.querySelectorAll('.seg button')) {
    b.setAttribute('aria-checked', String(b.dataset.mode === settings.mode));
  }
  $('autoOn').checked = !!settings.autoOn;
  $('hud').checked = !!settings.hud;
  const v = fromSens(settings.mouseSens);
  $('sens').value = v;
  $('sensVal').textContent = v;
  $('sensRow').style.opacity = settings.mode === 'shooter' ? '1' : '.55';
  renderKeys();
}

function renderState(state) {
  const chip = $('chip');
  if (!state) {
    chip.textContent = tabId ? 'Reload tab' : 'Not on Xbox';
    chip.className = 'chip';
    return;
  }
  const on = !!state.on;
  chip.textContent = on ? 'Active' : 'Ready';
  chip.className = on ? 'chip on' : 'chip';
  $('power').setAttribute('aria-pressed', String(on));
  $('powerTitle').textContent = on ? 'Controller on' : 'Controller off';
  $('powerHint').innerHTML = on
    ? 'Keyboard is now a controller'
    : (state.stream ? 'Click to turn on, or press <kbd>`</kbd>' : 'Turns on when a game starts');
  if (state.mode && state.mode !== settings.mode) {
    settings.mode = state.mode;
    renderSettings();
  }
}

function ask(msg) {
  return new Promise((resolve) => {
    if (tabId == null) return resolve(null);
    try {
      chrome.tabs.sendMessage(tabId, msg, (res) => {
        if (chrome.runtime.lastError) return resolve(null);
        resolve(res || null);
      });
    } catch (e) {
      resolve(null);
    }
  });
}

function save(patch) {
  settings = { ...settings, ...patch };
  chrome.storage.sync.set(patch);
  renderSettings();
}

async function init() {
  settings = await chrome.storage.sync.get(DEFAULTS);
  renderSettings();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const onXbox = !!(tab && tab.url && XBOX_URL.test(tab.url));
  // tab.url is only visible on matching hosts without the "tabs" permission;
  // fall back to asking the content script.
  tabId = tab ? tab.id : null;
  const state = await ask({ type: 'getState' });
  const live = onXbox || !!state;
  $('live').classList.toggle('hidden', !live);
  $('away').classList.toggle('hidden', live);
  if (!live) tabId = null;
  renderState(live ? state : null);
}

$('power').addEventListener('click', async () => {
  const state = await ask({ type: 'toggle' });
  renderState(state);
});

for (const b of document.querySelectorAll('.seg button')) {
  b.addEventListener('click', async () => {
    save({ mode: b.dataset.mode });
    const state = await ask({ type: 'setMode', mode: b.dataset.mode });
    if (state) renderState(state);
  });
}

$('autoOn').addEventListener('change', (e) => save({ autoOn: e.target.checked }));
$('hud').addEventListener('change', (e) => save({ hud: e.target.checked }));
$('sens').addEventListener('input', (e) => {
  $('sensVal').textContent = e.target.value;
});
$('sens').addEventListener('change', (e) => save({ mouseSens: toSens(+e.target.value) }));

init();
