// These tests exercise page logic with DOM/audio doubles. They do not replace
// real-browser keyboard, screen-reader, touch, or visual checks.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

function pageContext(file, response = { ok: true, json: async () => require('../schedule.json') }) {
  const elements = new Map();
  const classes = new Map();
  const context = { console, Intl, Date, fetch: async () => response };
  const document = {
    activeElement: null,
    getElementById: id => elements.get(id),
    querySelector: selector => classes.get(selector)?.[0],
    querySelectorAll: selector => classes.get(selector) || [],
    createElement: tag => new Element(tag)
  };
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase();
      this.attributes = {};
      this.children = [];
      this.listeners = {};
      this.innerHTML = '';
      this.textContent = '';
      this.style = {};
      this.open = false;
      this.hidden = false;
      const values = new Set();
      this.classList = {
        add: value => values.add(value), remove: value => values.delete(value),
        contains: value => values.has(value),
        toggle: (value, on) => on ? values.add(value) : values.delete(value)
      };
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name]; }
    appendChild(child) { this.children.push(child); }
    replaceChildren() { this.children = []; }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    emit(name, event = {}) { for (const fn of this.listeners[name] || []) fn(event); }
    focus() { document.activeElement = this; }
    click() { this.emit('click'); }
    querySelector(selector) { return document.querySelector(selector); }
    showModal() { this.open = true; this.shownModally = true; }
    close() { this.open = false; this.emit('close'); }
  }
  for (const id of ['overlay', 'modal-body', 'modal-inner', 'modal-play', 'modal-icon', 'audio-status', 'chant-list', 'call-list', 'step2-cards', 'next-match-banner', 'next-match-banner-body', 'next-card', 'schedule-list', 'schedule-updated', 'panel-chants', 'panel-calls', 'tab-chants', 'tab-calls']) {
    const el = new Element(id === 'overlay' ? 'dialog' : 'div');
    el.id = id;
    elements.set(id, el);
  }
  for (const name of ['.modal', '.close-btn', '.audio-row', '.tabs']) classes.set(name, [new Element()]);
  classes.set('.tab', [elements.get('tab-chants'), elements.get('tab-calls')]);
  classes.set('.tab-panel', [elements.get('panel-chants'), elements.get('panel-calls')]);
  document.documentElement = new Element('html');
  context.document = document;
  context.audioInstances = [];
  context.Audio = class {
    constructor(src) { this.src = src; this.currentTime = 0; context.audioInstances.push(this); }
    play() { return new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; }); }
    pause() { this.paused = true; }
  };
  vm.createContext(context);
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  for (const script of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g)) {
    const source = script[1] ? fs.readFileSync(path.join(root, script[1]), 'utf8') : script[2];
    vm.runInContext(source, context);
  }
  return { context, elements, document, run: code => vm.runInContext(code, context), html };
}
const settle = async () => { await new Promise(resolve => setImmediate(resolve)); };

test('both chant pages render native buttons and labelled native dialogs', () => {
  for (const [file, list, count] of [['index.html', 'chant-list', 14], ['intro.html', 'step2-cards', 3]]) {
    const page = pageContext(file);
    const rows = page.elements.get(list).children;
    assert.equal(rows.length, count);
    assert.ok(rows.every(row => row.tagName === 'BUTTON' && row.type === 'button' && row.attributes['aria-haspopup'] === 'dialog'));
    assert.match(page.html, /<dialog[^>]+aria-labelledby="modal-title"/);
    assert.match(page.html, /aria-label="閉じる" autofocus/);
    assert.doesNotMatch(page.html, /touchend|swipeY/);
    rows[0].click();
    assert.equal(page.elements.get('overlay').shownModally, true);
    assert.equal(page.document.activeElement, page.document.querySelector('.close-btn'));
    assert.equal(page.document.documentElement.classList.contains('dialog-open'), true);
    page.context.closeModal();
    assert.equal(page.elements.get('overlay').open, false);
    assert.equal(page.document.documentElement.classList.contains('dialog-open'), false);
  }
});

test('all player calls are buttons and tab selection updates accessibility state', () => {
  const page = pageContext('index.html');
  assert.equal(page.elements.get('call-list').children.length, 20);
  assert.ok(page.elements.get('call-list').children.every(row => row.tagName === 'BUTTON'));
  page.context.switchTab('calls', page.elements.get('tab-calls'));
  assert.equal(page.elements.get('tab-calls').attributes['aria-selected'], 'true');
  assert.equal(page.elements.get('tab-chants').attributes['aria-selected'], 'false');
  assert.equal(page.elements.get('tab-calls').tabIndex, 0);
  assert.equal(page.elements.get('tab-chants').tabIndex, -1);
  assert.equal(page.elements.get('panel-chants').hidden, true);
  assert.equal(page.elements.get('panel-calls').hidden, false);
});

test('arrow, Home, and End keys navigate tabs with wraparound', () => {
  const page = pageContext('index.html');
  const tabs = page.document.querySelectorAll('.tab');
  tabs.forEach((tab, i) => tab.addEventListener('click', () => page.context.switchTab(i ? 'calls' : 'chants', tab)));
  tabs[0].focus();
  for (const [key, expected] of [['ArrowLeft', 1], ['ArrowRight', 0], ['End', 1], ['Home', 0]]) {
    let prevented = false;
    page.document.querySelector('.tabs').emit('keydown', { key, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(page.document.activeElement, tabs[expected]);
    assert.equal(tabs[expected].attributes['aria-selected'], 'true');
  }
});

function audioPage() {
  const page = pageContext('index.html');
  page.run('openModalChant({ title: "Test", lines: ["Test"], audio: "test.mp3" })');
  return page;
}

test('audio controls remain hidden for unconfigured audio', () => {
  const page = pageContext('index.html');
  page.elements.get('chant-list').children[0].click();
  assert.equal(page.document.querySelector('.audio-row').hidden, true);
  assert.equal(page.elements.get('modal-play').disabled, true);
});

test('audio shows loading then playing, and resets after ending', async () => {
  const page = audioPage();
  assert.equal(page.document.querySelector('.audio-row').hidden, false);
  const pending = page.context.toggleAudio();
  assert.equal(page.elements.get('audio-status').textContent, '読み込み中…');
  page.context.audioInstances[0].resolve();
  await pending;
  assert.equal(page.elements.get('audio-status').textContent, '再生中');
  page.context.audioInstances[0].onended();
  assert.equal(page.elements.get('audio-status').textContent, 'タップして再生');
  assert.equal(page.elements.get('modal-play').attributes['aria-label'], '音源を再生');
});

test('rejected audio play resets controls and allows retry', async () => {
  const page = audioPage();
  const pending = page.context.toggleAudio();
  page.context.audioInstances[0].reject(new Error('media unavailable'));
  await pending;
  assert.match(page.elements.get('audio-status').textContent, /再生できませんでした/);
  assert.equal(page.elements.get('modal-play').classList.contains('playing'), false);
  const retry = page.context.toggleAudio();
  page.context.audioInstances[1].resolve();
  await retry;
  assert.equal(page.elements.get('audio-status').textContent, '再生中');
});

test('close while audio is loading ignores the late play result', async () => {
  const page = audioPage();
  const pending = page.context.toggleAudio();
  page.context.closeModal();
  const audio = page.context.audioInstances[0];
  assert.equal(audio.paused, true);
  audio.resolve();
  await pending;
  assert.equal(page.elements.get('modal-play').classList.contains('playing'), false);
  assert.equal(page.elements.get('overlay').open, false);
});

test('repeat tap cancels pending audio; opening another chant stops old audio', async () => {
  const page = audioPage();
  const pending = page.context.toggleAudio();
  await page.context.toggleAudio();
  page.context.audioInstances[0].resolve();
  await pending;
  assert.equal(page.context.audioInstances.length, 1);
  assert.equal(page.elements.get('modal-play').classList.contains('playing'), false);
  const next = page.context.toggleAudio();
  page.elements.get('chant-list').children[0].click();
  page.context.audioInstances[1].reject(new Error('aborted'));
  await next;
  assert.equal(page.document.querySelector('.audio-row').hidden, true);
  assert.equal(page.elements.get('audio-status').textContent, '音源準備中');
});

test('native dialog close event (including Escape) stops audio and unlocks scroll', async () => {
  const page = audioPage();
  const pending = page.context.toggleAudio();
  page.context.audioInstances[0].resolve();
  await pending;
  page.elements.get('overlay').close();
  assert.equal(page.context.audioInstances[0].paused, true);
  assert.equal(page.document.documentElement.classList.contains('dialog-open'), false);
});

test('schedule displays unknown time without null and preserves known results', async () => {
  const fixture = { season: '2026-27', updated: '2026-10-16', matches: [
    { node: 1, date: '2000-01-01', time: null, result: null, opponent: 'Old' },
    { node: 2, date: '2099-01-01', time: null, result: null, opponent: 'Future' },
    { node: 3, date: '2000-01-02', result: '○ 3-2', note: 'Old note', opponent: 'Played' }
  ] };
  const page = pageContext('next-match.html', { ok: true, json: async () => fixture });
  await settle();
  const card = page.elements.get('next-card').innerHTML;
  assert.match(card, /第2節/);
  assert.match(card, /開始時刻未定/);
  assert.doesNotMatch(card, /null KO|undefined KO/);
  const rows = page.elements.get('schedule-list').children;
  assert.match(rows[0].innerHTML, /結果未更新/);
  assert.match(rows[2].innerHTML, /○ 3-2/);
  assert.match(page.context.buildPostText(fixture.matches[1], fixture.season), /開始時刻未定/);
  await page.context.loadSchedule();
  assert.equal(page.elements.get('schedule-list').children.length, 3);
});

test('empty future schedule does not incorrectly declare the season finished', async () => {
  const page = pageContext('next-match.html', { ok: true, json: async () => ({ matches: [], final_season: { period: 'TBD', venues: [] } }) });
  await settle();
  assert.match(page.elements.get('next-card').innerHTML, /今後の試合日程は未登録/);
  assert.doesNotMatch(page.elements.get('next-card').innerHTML, /シーズン終了/);
});

test('HTTP failure offers retry and does not render a broken schedule', async () => {
  const page = pageContext('next-match.html', { ok: false });
  await settle();
  assert.match(page.elements.get('next-card').innerHTML, /role="alert"/);
  assert.match(page.elements.get('next-card').innerHTML, /再読み込み/);
  assert.equal(page.elements.get('schedule-list').children.length, 0);
});
